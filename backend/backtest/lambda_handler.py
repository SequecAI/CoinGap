"""
백테스트 API의 메인 Lambda 진입점.

라우트:
  GET  /variables         변수 팔레트 (entry/exit/operators)
  GET  /logics/shared     공유 로직 시드 목록
  POST /validate          조건 수식 1개 유효성 검사 {expr, section}
  POST /backtest          룰셋 백테스트 실행 {ruleset, days?}

응답은 기존 lambda_function.py와 동일한 CORS_HEADERS · _response 패턴.
"""
import json
import traceback
from functools import lru_cache

from backtest_engine import run_backtest
from features import ENTRY_VARS, EXIT_VARS, build_features
from safe_eval import validate_condition
from seed_logics import SEED_LOGIC
from variables import OPERATORS, palette_for


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


@lru_cache(maxsize=10)
def _features_cached(market: str, base: str, days: int):
    """
    Lambda 인스턴스 워밍업 동안 같은 (market, base, days)는 한 번만 계산.
    Lambda 재시작 시 캐시 비워짐 (의도된 동작).
    """
    return build_features(market, base_market=base, days=days)


def handle_variables():
    return _response(200, {
        "entry": palette_for("entry"),
        "exit": palette_for("exit"),
        "operators": OPERATORS,
    })


def handle_shared_logics():
    return _response(200, {"logics": [SEED_LOGIC]})


def handle_validate(body):
    expr = body.get("expr", "")
    section = body.get("section", "exit")
    allowed = ENTRY_VARS if section == "entry" else EXIT_VARS
    err = validate_condition(expr, allowed)
    return _response(200, {"ok": err is None, "error": err})


def handle_backtest(body):
    ruleset = body.get("ruleset")
    if not ruleset:
        return _response(400, {"error": "ruleset is required"})

    symbol = ruleset.get("symbol", "KRW-SOL")
    base = ruleset.get("base_market", "KRW-BTC")
    days = int(body.get("days", 365))

    try:
        feats = _features_cached(symbol, base, days)
    except ValueError as e:
        return _response(400, {"error": str(e)})
    except Exception as e:
        print(f"[ERR] feature build: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"feature build failed: {e}"})

    try:
        result = run_backtest(ruleset, feats)
    except ValueError as e:
        return _response(400, {"error": str(e)})
    except Exception as e:
        print(f"[ERR] backtest: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"backtest failed: {e}"})

    # 응답 크기 절약: 개별 거래 내역은 최근 200건만
    result["trades"] = result["trades"][-200:]
    return _response(200, {"ok": True, "result": result})


def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "")
    path = event.get("rawPath") or event.get("path", "")

    if method == "OPTIONS":
        return _response(200, {"message": "OK"})

    try:
        if method == "GET" and path.endswith("/variables"):
            return handle_variables()

        if method == "GET" and path.endswith("/logics/shared"):
            return handle_shared_logics()

        if method == "POST" and path.endswith("/validate"):
            body = json.loads(event.get("body") or "{}")
            return handle_validate(body)

        if method == "POST" and path.endswith("/backtest"):
            body = json.loads(event.get("body") or "{}")
            return handle_backtest(body)

        return _response(404, {"error": "Not Found", "path": path, "method": method})

    except Exception as e:
        print(f"[ERR] router: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": str(e)})
