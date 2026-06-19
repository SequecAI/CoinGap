"""
Upbit 1분봉을 받아 S3 parquet으로 캐싱한다.

설계 원칙:
  - 매 백테스트마다 페치하지 않는다. cache_updater Lambda가 정기적으로 증분 페치한다.
  - parquet은 단일 파일(종목 1개당 1개)로 누적된다. 1년치 = 약 525,600행 × 5컬럼.
  - 업비트 rate limit 준수: 초당 10회, 분당 600회.
  - Lambda 타임아웃을 넘기지 않도록 한 번 호출당 최대 페치 양을 제한한다.

S3 키 규칙:
  s3://{BUCKET}/candles/{MARKET}/1m.parquet
  예: s3://coingap-backtest-data/candles/KRW-SOL/1m.parquet
"""
import io
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import boto3
import pandas as pd


BUCKET = os.environ.get("BACKTEST_BUCKET", "coingap-backtest-data")
TRACKED_MARKETS = [
    "KRW-BTC", "KRW-ETH", "KRW-SOL", "KRW-XRP", "KRW-DOGE",
    "KRW-ADA", "KRW-TRX", "KRW-AVAX", "KRW-LINK", "KRW-POL",
]

UPBIT_BASE = "https://api.upbit.com/v1/candles/minutes/1"
PAGE_SIZE = 200  # Upbit API max per request
RATE_DELAY = 0.12  # seconds between requests (≈ 8.3 req/s, safely under 10/s limit)
MAX_REQUESTS_PER_CALL = 200  # cap per Lambda invocation (≈ 24s)

s3 = boto3.client("s3")


def _s3_key(market: str) -> str:
    return f"candles/{market}/1m.parquet"


def load_from_s3(market: str) -> pd.DataFrame:
    """S3에서 종목별 캐시 parquet을 읽는다. 없으면 빈 DataFrame. 인덱스는 항상 tz-aware(UTC)."""
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=_s3_key(market))
        df = pd.read_parquet(io.BytesIO(obj["Body"].read()))
        df.index = pd.to_datetime(df.index, utc=True)
        df.sort_index(inplace=True)
        return df
    except s3.exceptions.NoSuchKey:
        return pd.DataFrame()


def save_to_s3(df: pd.DataFrame, market: str) -> None:
    """DataFrame을 parquet으로 직렬화해 S3에 저장."""
    buf = io.BytesIO()
    df.to_parquet(buf, compression="snappy")
    buf.seek(0)
    s3.put_object(Bucket=BUCKET, Key=_s3_key(market), Body=buf.getvalue())


def _fetch_page(market: str, to_ts: datetime) -> list:
    """Upbit API 한 페이지(최대 200개) 페치. to_ts 이전의 분봉을 최신순으로 반환."""
    params = {
        "market": market,
        "count": PAGE_SIZE,
        "to": to_ts.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    url = f"{UPBIT_BASE}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "coingap-backtest/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status != 200:
            raise RuntimeError(f"Upbit HTTP {resp.status}")
        return json.loads(resp.read())


def _candles_to_df(candles: list) -> pd.DataFrame:
    """Upbit 응답을 backtest용 컬럼으로 변환. 인덱스는 tz-aware(UTC)."""
    if not candles:
        return pd.DataFrame()
    df = pd.DataFrame(candles)
    df["datetime"] = pd.to_datetime(df["candle_date_time_utc"], utc=True)
    df.set_index("datetime", inplace=True)
    df = df[["opening_price", "high_price", "low_price", "trade_price", "candle_acc_trade_volume"]]
    df.columns = ["open", "high", "low", "close", "volume"]
    df.sort_index(inplace=True)
    return df


def update_cache(market: str, target_days_back: int = 365) -> dict:
    """
    한 종목의 캐시를 갱신한다.

    동작 모드 (existing 상태에 따라 자동 선택):
      - 캐시가 비어 있음 → 초기 적재 (현재부터 거꾸로 target_days_back 일치까지)
      - 캐시는 있지만 가장 오래된 시각이 target_days_back보다 최근
        → 초기 적재가 미완료. 가장 오래된 시각부터 더 거꾸로 채움 (backfill)
      - 캐시 완전 (oldest <= target) + 최신은 부족 → 증분만
      - 캐시 최신이 거의 현재 → up-to-date 반환

    한 호출당 MAX_REQUESTS_PER_CALL 회로 제한 (≈ 40,000행, Lambda 시간 안에 안전).
    """
    existing = load_from_s3(market)
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    oldest_needed = now - timedelta(days=target_days_back)

    backfill_mode = False  # True면 과거로 거꾸로 채우는 모드
    skip_floor = None       # 증분 모드에서 "이미 가진 시각" 컷오프

    if existing.empty:
        # 초기 적재: 현재부터 거꾸로
        cursor = now
        backfill_mode = True
    else:
        existing_oldest = existing.index.min().to_pydatetime()
        existing_newest = existing.index.max().to_pydatetime()
        if existing_oldest.tzinfo is None:
            existing_oldest = existing_oldest.replace(tzinfo=timezone.utc)
        if existing_newest.tzinfo is None:
            existing_newest = existing_newest.replace(tzinfo=timezone.utc)

        if existing_oldest > oldest_needed:
            # 초기 적재 미완료: existing_oldest 시각부터 거꾸로 더 채움
            cursor = existing_oldest
            backfill_mode = True
        elif existing_newest >= now - timedelta(minutes=1):
            return {"market": market, "added_rows": 0, "reason": "up-to-date"}
        else:
            # 1년치는 다 있고 최근만 부족 → 증분 모드 (현재부터 거꾸로 existing_newest까지)
            cursor = now
            skip_floor = existing_newest

    new_chunks = []
    requests_made = 0

    while cursor > oldest_needed and requests_made < MAX_REQUESTS_PER_CALL:
        chunk = _fetch_page(market, cursor)
        requests_made += 1
        if not chunk:
            break
        chunk_df = _candles_to_df(chunk)
        new_chunks.append(chunk_df)

        # 다음 페이지: 가장 오래된 캔들 시각 이전을 요청
        cursor = chunk_df.index.min().to_pydatetime()
        if cursor.tzinfo is None:
            cursor = cursor.replace(tzinfo=timezone.utc)

        time.sleep(RATE_DELAY)

        # 증분 모드: 이미 가진 시각에 도달하면 종료
        if skip_floor is not None and cursor <= skip_floor:
            break

    if not new_chunks:
        return {"market": market, "added_rows": 0, "reason": "no new data"}

    new_df = pd.concat(new_chunks)
    new_df = new_df[~new_df.index.duplicated(keep="last")]

    if not existing.empty:
        combined = pd.concat([existing, new_df])
        combined = combined[~combined.index.duplicated(keep="last")]
        combined.sort_index(inplace=True)
        # 너무 오래된 데이터는 trim (target_days_back + 7일 이전)
        cutoff = now - timedelta(days=target_days_back + 7)
        combined = combined[combined.index >= cutoff]
        added = len(combined) - len(existing)
    else:
        combined = new_df.sort_index()
        added = len(combined)

    save_to_s3(combined, market)

    return {
        "market": market,
        "mode": "backfill" if backfill_mode else "incremental",
        "added_rows": added,
        "total_rows": len(combined),
        "oldest": str(combined.index.min()),
        "newest": str(combined.index.max()),
        "requests_made": requests_made,
        "complete": combined.index.min().to_pydatetime().replace(tzinfo=timezone.utc) <= oldest_needed + timedelta(hours=1),
    }
