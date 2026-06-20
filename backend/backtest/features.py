"""
S3 캐시(1분봉)로부터 백테스트용 피처를 계산한다.

원본 coinleakseeker의 features.py(CSV 기반)와 동일한 피처 정의를 사용한다:
- Z_SCORE: 타깃/BTC 비율의 롤링 z-score (창 720분 = 12h)
- DROP_3M/5M: 3·5분 전 종가 대비 하락률 %
- RSI_14: 14분 RSI
룩어헤드 방지를 위해 롤링 통계는 shift(1)로 과거 구간만 사용한다.
"""
from datetime import datetime, timedelta, timezone

import pandas as pd

from data_cache import load_from_s3


Z_WINDOW = 720  # 분 (12시간)
DEFAULT_DAYS = 365  # 백테스트 기본 기간

# 백테스트에서 제공하는 시장 변수 (진입/익절/손절 공통)
MARKET_VARS = [
    # 가격·기본
    "PRICE", "Z_SCORE", "RATIO", "VOLUME",
    # 가격 변동률 (시간대별 하락/상승)
    "DROP_1M", "DROP_3M", "DROP_5M", "DROP_10M", "DROP_30M", "DROP_60M",
    "RISE_3M", "RISE_5M", "RISE_10M",
    "RSI_14",
    # 이동평균 (Moving Average / Exponential MA)
    "MA_20", "MA_60", "MA_240", "EMA_12", "EMA_26", "PRICE_VS_MA60",
    # MACD
    "MACD", "MACD_SIGNAL", "MACD_HIST",
    # Bollinger Bands
    "BB_UPPER", "BB_LOWER", "BB_WIDTH", "BB_PCT",
]
# 보유 중에만 의미가 있는 포지션 변수 (익절/손절 전용)
POSITION_VARS = ["PNL_PCT", "HOLD_MIN", "ENTRY_PRICE"]

ENTRY_VARS = MARKET_VARS
EXIT_VARS = MARKET_VARS + POSITION_VARS


def _rsi(close, period=14):
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss
    return (100 - 100 / (1 + rs)).fillna(50)


def compute_features(df, *, trim=True):
    """
    target+base를 join한 df → 피처 DataFrame.
    df 컬럼: close, high, low, volume, base_close (모두 tz-aware index).

    trim=True (기본/백테스트): Z_WINDOW만큼 자르고 결측 제거.
    trim=False (실시간 evaluate): 마지막 행만 필요하므로 자르지 않고 그대로 반환.
    """
    out = pd.DataFrame(index=df.index)
    out["PRICE"] = df["close"]
    out["high"] = df["high"]
    out["low"] = df["low"]
    out["VOLUME"] = df["volume"]
    out["RATIO"] = df["close"] / df["base_close"]

    # Z-score: 과거 720분 통계 (shift(1)로 현재봉 제외 → 룩어헤드 방지)
    mu = out["RATIO"].rolling(Z_WINDOW).mean().shift(1)
    sigma = out["RATIO"].rolling(Z_WINDOW).std().shift(1)
    out["Z_SCORE"] = ((out["RATIO"] - mu) / sigma).where(sigma > 0, 0.0)

    # 하락률 % (현재 종가 / N분 전 종가 - 1).
    # 양수면 상승, 음수면 하락. RISE_*는 음수 부호를 뒤집어 가독성 위해 별도 제공.
    out["DROP_1M"] = (df["close"] / df["close"].shift(1) - 1.0) * 100.0
    out["DROP_3M"] = (df["close"] / df["close"].shift(3) - 1.0) * 100.0
    out["DROP_5M"] = (df["close"] / df["close"].shift(5) - 1.0) * 100.0
    out["DROP_10M"] = (df["close"] / df["close"].shift(10) - 1.0) * 100.0
    out["DROP_30M"] = (df["close"] / df["close"].shift(30) - 1.0) * 100.0
    out["DROP_60M"] = (df["close"] / df["close"].shift(60) - 1.0) * 100.0
    out["RISE_3M"] = -out["DROP_3M"]
    out["RISE_5M"] = -out["DROP_5M"]
    out["RISE_10M"] = -out["DROP_10M"]

    out["RSI_14"] = _rsi(df["close"], 14)

    # 이동평균. EMA는 adjust=False로 워밍업 첫 봉부터 값이 나옴 (재귀형).
    out["MA_20"] = df["close"].rolling(20).mean()
    out["MA_60"] = df["close"].rolling(60).mean()
    out["MA_240"] = df["close"].rolling(240).mean()
    out["EMA_12"] = df["close"].ewm(span=12, adjust=False).mean()
    out["EMA_26"] = df["close"].ewm(span=26, adjust=False).mean()
    # 현재가가 MA_60 대비 몇 % 위/아래인지 (+는 위, -는 아래)
    out["PRICE_VS_MA60"] = (out["PRICE"] / out["MA_60"] - 1.0) * 100.0

    # MACD: 12EMA - 26EMA, Signal=9EMA of MACD, Hist=MACD-Signal
    out["MACD"] = out["EMA_12"] - out["EMA_26"]
    out["MACD_SIGNAL"] = out["MACD"].ewm(span=9, adjust=False).mean()
    out["MACD_HIST"] = out["MACD"] - out["MACD_SIGNAL"]

    # Bollinger Bands (20 기간, ±2 표준편차)
    std_20 = df["close"].rolling(20).std()
    out["BB_UPPER"] = out["MA_20"] + 2.0 * std_20
    out["BB_LOWER"] = out["MA_20"] - 2.0 * std_20
    # 밴드 폭 (% — 평균 대비). 추세 확장/수축 감지
    out["BB_WIDTH"] = ((out["BB_UPPER"] - out["BB_LOWER"]) / out["MA_20"] * 100.0)
    # 밴드 내 위치 0~1 (0=하단, 1=상단). 폭이 0이면 0.5로 고정
    band_width = out["BB_UPPER"] - out["BB_LOWER"]
    out["BB_PCT"] = ((out["PRICE"] - out["BB_LOWER"]) / band_width).where(band_width > 0, 0.5)

    if trim:
        out = out.iloc[Z_WINDOW:]
        out = out.dropna(subset=["Z_SCORE", "DROP_3M", "DROP_5M"])
    return out


def build_features(target_market, base_market="KRW-BTC", days=DEFAULT_DAYS):
    """
    S3 캐시에서 target/base 1분봉을 읽어 정렬·결합한 뒤 피처 DataFrame을 반환한다 (백테스트용).

    컬럼: PRICE, RATIO, Z_SCORE, DROP_3M(%), DROP_5M(%), RSI_14, VOLUME, high, low
    """
    tdf = load_from_s3(target_market)
    if tdf.empty:
        raise ValueError(f"No cached data for {target_market}. Run cache_updater first.")

    if base_market and base_market != target_market:
        bdf = load_from_s3(base_market)
        if bdf.empty:
            raise ValueError(f"No cached data for base {base_market}. Run cache_updater first.")
        bdf = bdf[["close"]].rename(columns={"close": "base_close"})
        df = tdf.join(bdf, how="inner")
    else:
        df = tdf.copy()
        df["base_close"] = df["close"]

    # 최근 N일치만 사용 (인덱스가 tz-aware라고 가정; load_from_s3가 보장)
    if days and days > 0:
        cutoff = df.index.max() - pd.Timedelta(days=days)
        df = df[df.index >= cutoff]

    return compute_features(df, trim=True)


def candles_to_df(candles):
    """
    Upbit 분봉 API 응답(또는 같은 모양의 JSON)을 features용 DataFrame으로 변환.
    candles: [{candle_date_time_utc, opening_price, high_price, low_price, trade_price, candle_acc_trade_volume}, ...]
    반환 컬럼: close, high, low, volume (tz-aware index).
    """
    if not candles:
        return pd.DataFrame()
    rows = []
    for c in candles:
        ts = c.get("candle_date_time_utc") or c.get("timestamp")
        rows.append({
            "ts": ts,
            "close": float(c.get("trade_price", c.get("close", 0))),
            "high": float(c.get("high_price", c.get("high", 0))),
            "low": float(c.get("low_price", c.get("low", 0))),
            "volume": float(c.get("candle_acc_trade_volume", c.get("volume", 0))),
        })
    df = pd.DataFrame(rows).set_index("ts")
    df.index = pd.to_datetime(df.index, utc=True)
    df = df.sort_index()
    df = df[~df.index.duplicated(keep="last")]
    return df


def build_features_from_candles(target_candles, base_candles):
    """
    PC 엔진이 매분 호출하는 evaluate용. Upbit 분봉 응답을 그대로 받아 features 마지막 행만 정확히 나오면 된다.

    target/base 모두 충분한 길이(>= Z_WINDOW+10)가 들어왔다고 가정.
    trim=False라서 결측 포함된 초기 구간도 그대로 살아있다 — 호출부가 .iloc[-1]만 사용해야 의미가 있다.
    """
    tdf = candles_to_df(target_candles)
    bdf = candles_to_df(base_candles)
    if tdf.empty:
        raise ValueError("target candles is empty")
    if bdf.empty:
        # base 없으면 target 자기 자신과의 ratio = 1 (Z_SCORE는 0이 됨)
        df = tdf.copy()
        df["base_close"] = df["close"]
    else:
        bdf = bdf[["close"]].rename(columns={"close": "base_close"})
        df = tdf.join(bdf, how="inner")
    return compute_features(df, trim=False)
