"""
백테스트 API의 메인 Lambda 진입점.

라우트:
  GET    /variables         변수 팔레트 (entry/exit/operators)
  GET    /logics/shared     공유 로직 시드 목록
  POST   /validate          조건 수식 1개 유효성 검사 {expr, section}
  POST   /backtest          룰셋 백테스트 실행 {ruleset, days?}

  POST   /logics            로직 저장 {userId, logic}
  GET    /logics/mine       내 로직 목록 ?userId=...
  DELETE /logics/{id}       내 로직 삭제 ?userId=...

응답은 기존 lambda_function.py와 동일한 CORS_HEADERS · _response 패턴.
"""
import decimal
import json
import traceback
from functools import lru_cache

import logics_store
import runs_store
import trades_store
import evaluate as evaluate_mod
from backtest_engine import run_backtest
from features import ENTRY_VARS, EXIT_VARS, build_features
from safe_eval import validate_condition
from variables import OPERATORS, palette_for


class _DecimalEncoder(json.JSONEncoder):
    """DynamoDB는 숫자를 Decimal로 돌려준다. JSON으로 직렬화할 때 변환.
    Decimal 외 직렬화 불가 타입은 str로 폴백 (datetime 등)."""
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return str(obj)


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False, cls=_DecimalEncoder),
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


def handle_validate(body):
    expr = body.get("expr", "")
    section = body.get("section", "exit")
    allowed = ENTRY_VARS if section == "entry" else EXIT_VARS
    err = validate_condition(expr, allowed)
    return _response(200, {"ok": err is None, "error": err})


def handle_save_logic(body):
    user_id = body.get("userId")
    logic = body.get("logic")
    if not user_id:
        return _response(400, {"error": "userId is required"})
    if not isinstance(logic, dict):
        return _response(400, {"error": "logic must be an object"})

    try:
        result = logics_store.save_logic(user_id, logic)
    except Exception as e:
        print(f"[ERR] save_logic: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"save failed: {e}"})

    err = result.get("error")
    if err == "name_required":
        return _response(400, {"ok": False, "error": "name_required"})
    if err == "slot_full":
        return _response(409, {"ok": False, **result})

    return _response(200, result)


def handle_list_my_logics(params):
    user_id = (params or {}).get("userId")
    if not user_id:
        return _response(400, {"error": "userId is required"})
    try:
        items = logics_store.list_my_logics(user_id)
    except Exception as e:
        print(f"[ERR] list_my_logics: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"list failed: {e}"})
    return _response(200, {"logics": items, "limit": logics_store.SLOT_LIMIT})


def handle_delete_logic(logic_id, params):
    user_id = (params or {}).get("userId")
    if not user_id or not logic_id:
        return _response(400, {"error": "userId and logicId required"})
    try:
        logics_store.delete_logic(user_id, logic_id)
    except Exception as e:
        print(f"[ERR] delete_logic: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"delete failed: {e}"})
    return _response(200, {"ok": True})


def handle_put_run_state(body):
    user_id = body.get("userId")
    state = body.get("state")
    if not user_id:
        return _response(400, {"error": "userId is required"})
    if not isinstance(state, dict):
        return _response(400, {"error": "state must be an object"})
    try:
        result = runs_store.put_state(user_id, state)
    except Exception as e:
        print(f"[ERR] put_run_state: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"put failed: {e}"})
    return _response(200, result)


def handle_get_run_state(params):
    user_id = (params or {}).get("userId")
    if not user_id:
        return _response(400, {"error": "userId is required"})
    try:
        item = runs_store.get_state(user_id)
    except Exception as e:
        print(f"[ERR] get_run_state: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"get failed: {e}"})
    return _response(200, {"state": item})


def handle_delete_run_state(params):
    user_id = (params or {}).get("userId")
    if not user_id:
        return _response(400, {"error": "userId is required"})
    try:
        runs_store.delete_state(user_id)
    except Exception as e:
        print(f"[ERR] delete_run_state: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"delete failed: {e}"})
    return _response(200, {"ok": True})


def handle_set_control(body):
    """웹/모바일이 보내는 원격 명령. body: { userId, command: 'stop' | {action,logicId,...} }"""
    user_id = body.get("userId")
    command = body.get("command")
    if not user_id:
        return _response(400, {"error": "userId is required"})
    if command is None:
        return _response(400, {"error": "command is required"})
    try:
        runs_store.set_control_command(user_id, command)
    except Exception as e:
        print(f"[ERR] set_control: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"set failed: {e}"})
    return _response(200, {"ok": True})


def handle_pop_control(params):
    """PC가 매 tick에 폴링. 명령이 있으면 반환하고 즉시 클리어."""
    user_id = (params or {}).get("userId")
    if not user_id:
        return _response(400, {"error": "userId is required"})
    try:
        command = runs_store.pop_control_command(user_id)
    except Exception as e:
        print(f"[ERR] pop_control: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"pop failed: {e}"})
    return _response(200, {"command": command})


def handle_put_trade(body):
    user_id = body.get("userId")
    trade = body.get("trade")
    if not user_id:
        return _response(400, {"error": "userId is required"})
    if not isinstance(trade, dict) or not trade.get("time"):
        return _response(400, {"error": "trade with 'time' is required"})
    try:
        result = trades_store.put_trade(user_id, trade)
    except Exception as e:
        print(f"[ERR] put_trade: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"put failed: {e}"})
    return _response(200, result)


def handle_get_trades(params):
    user_id = (params or {}).get("userId")
    if not user_id:
        return _response(400, {"error": "userId is required"})
    # ISO8601 문자열로 between 조회 가능 (사전순=시간순). 누락 시 전체 범위.
    from_iso = (params or {}).get("from") or "0"
    to_iso = (params or {}).get("to") or "9999"
    try:
        items = trades_store.query_trades(user_id, from_iso, to_iso)
    except Exception as e:
        print(f"[ERR] get_trades: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"query failed: {e}"})
    return _response(200, {"trades": items, "from": from_iso, "to": to_iso})


def handle_evaluate(body):
    """
    PC 엔진의 1분 주기 호출.
      { ruleset, target_candles, base_candles?, position? }
    target_candles는 길이 >= Z_WINDOW + 10(==730) 권장. base는 비워두면 RATIO=1.
    """
    ruleset = body.get("ruleset")
    target = body.get("target_candles") or []
    base = body.get("base_candles") or []
    position = body.get("position")
    if not ruleset:
        return _response(400, {"error": "ruleset is required"})
    if not isinstance(target, list) or len(target) < 30:
        return _response(400, {"error": "target_candles too short (need 30+)"})

    try:
        result = evaluate_mod.evaluate(ruleset, target, base, position)
    except ValueError as e:
        return _response(400, {"error": str(e)})
    except Exception as e:
        print(f"[ERR] evaluate: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": f"evaluate failed: {e}"})
    return _response(200, result)


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

        if method == "GET" and path.endswith("/logics/mine"):
            params = event.get("queryStringParameters") or {}
            return handle_list_my_logics(params)

        if method == "POST" and path.endswith("/validate"):
            body = json.loads(event.get("body") or "{}")
            return handle_validate(body)

        if method == "POST" and path.endswith("/backtest"):
            # 백테스트 엔진은 float/numpy 기반. parse_float=Decimal을 쓰면
            # Decimal/float 산술 TypeError가 발생하므로 일반 float로 파싱.
            body = json.loads(event.get("body") or "{}")
            return handle_backtest(body)

        if method == "POST" and path.endswith("/evaluate"):
            # PC 엔진이 보낸 분봉 페이로드. /backtest와 같은 이유로 float 파싱.
            body = json.loads(event.get("body") or "{}")
            return handle_evaluate(body)

        if method == "PUT" and path.endswith("/runs/state"):
            # DynamoDB는 float을 거부하므로 Decimal로 파싱.
            body = json.loads(event.get("body") or "{}", parse_float=decimal.Decimal)
            return handle_put_run_state(body)

        if method == "GET" and path.endswith("/runs/state"):
            params = event.get("queryStringParameters") or {}
            return handle_get_run_state(params)

        if method == "DELETE" and path.endswith("/runs/state"):
            params = event.get("queryStringParameters") or {}
            return handle_delete_run_state(params)

        if method == "PUT" and path.endswith("/runs/control"):
            body = json.loads(event.get("body") or "{}", parse_float=decimal.Decimal)
            return handle_set_control(body)

        if method == "GET" and path.endswith("/runs/control"):
            params = event.get("queryStringParameters") or {}
            return handle_pop_control(params)

        if method == "POST" and path.endswith("/trades"):
            body = json.loads(event.get("body") or "{}", parse_float=decimal.Decimal)
            return handle_put_trade(body)

        if method == "GET" and path.endswith("/trades"):
            params = event.get("queryStringParameters") or {}
            return handle_get_trades(params)

        if method == "POST" and path.endswith("/logics"):
            # DynamoDB는 float을 거부하므로 저장 라우트에서만 Decimal로 파싱.
            body = json.loads(event.get("body") or "{}", parse_float=decimal.Decimal)
            return handle_save_logic(body)

        if method == "DELETE" and "/logics/" in path:
            logic_id = path.rsplit("/", 1)[-1]
            params = event.get("queryStringParameters") or {}
            return handle_delete_logic(logic_id, params)

        return _response(404, {"error": "Not Found", "path": path, "method": method})

    except Exception as e:
        print(f"[ERR] router: {e}\n{traceback.format_exc()}")
        return _response(500, {"error": str(e)})
