"""
EventBridge가 매일 호출하는 Lambda. 추적 종목들의 S3 캐시를 갱신한다.

동작:
  1. data_cache.TRACKED_MARKETS 순회
  2. 각 종목에 대해 update_cache(market) 호출
       - 캐시가 비어 있으면 1년치 거꾸로 페치 (한 호출당 ~40,000행 제한)
       - 있으면 마지막 시각 ~ 현재까지 증분
  3. 결과 요약 반환

  → 초기 적재(빈 캐시)는 한 번에 끝나지 않으므로 EventBridge가 매일 실행하면
    여러 날에 걸쳐 점진적으로 1년치를 채운다. 사용자가 빨리 채우고 싶으면
    수동으로 여러 번 invoke하면 된다.

이벤트 입력:
  {} (정기 실행, 모든 종목)
  {"markets": ["KRW-SOL"]} (특정 종목만)

응답:
  {"results": [{"market": "...", "added_rows": N, ...}, ...]}
"""
import json
import traceback

from data_cache import TRACKED_MARKETS, update_cache


def lambda_handler(event, context):
    markets = (event or {}).get("markets") or TRACKED_MARKETS

    results = []
    for market in markets:
        try:
            r = update_cache(market)
            results.append(r)
            print(f"[OK] {market}: {r}")
        except Exception as e:
            err = {"market": market, "error": str(e), "trace": traceback.format_exc()}
            results.append(err)
            print(f"[ERR] {market}: {e}")

    return {
        "statusCode": 200,
        "body": json.dumps({"results": results}, default=str),
    }
