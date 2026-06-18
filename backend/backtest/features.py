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
MARKET_VARS = ["PRICE", "Z_SCORE", "RATIO", "DROP_3M", "DROP_5M", "RSI_14", "VOLUME"]
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


def build_features(target_market, base_market="KRW-BTC", days=DEFAULT_DAYS):
    """
    S3 캐시에서 target/base 1분봉을 읽어 정렬·결합한 뒤 피처 DataFrame을 반환한다.

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

    # 하락률 % (현재 종가 / N분 전 종가 - 1)
    out["DROP_3M"] = (df["close"] / df["close"].shift(3) - 1.0) * 100.0
    out["DROP_5M"] = (df["close"] / df["close"].shift(5) - 1.0) * 100.0

    out["RSI_14"] = _rsi(df["close"], 14)

    # 통계가 안정화된 이후 구간만 사용
    out = out.iloc[Z_WINDOW:]
    out = out.dropna(subset=["Z_SCORE", "DROP_3M", "DROP_5M"])
    return out
