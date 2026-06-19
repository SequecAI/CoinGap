"""
LabLogics 테이블 CRUD.

스키마:
  PK userId  (Google sub, 문자열)
  SK logicId (UUID v4, 문자열)
  속성: name, symbol, days, allocation_pct, fee_pct, slippage_pct,
        entry, takeProfit, stopLoss, backtest?, savedAt, updatedAt

정책:
  - 같은 name으로 저장 = 덮어쓰기 (slot 안 증가, savedAt은 최초값 유지)
  - 새 name인데 slot 가득 = 거부 (현재 보유 목록 반환 → 클라이언트가 어떤 걸 지울지 묻도록)
  - 슬롯 한도는 SLOT_LIMIT 상수 (출시 기본 3, 추후 사용자별 slot_count로 발전 가능)
"""
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key


SLOT_LIMIT = int(os.environ.get("LAB_SLOT_LIMIT", "3"))

_dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")
_table = _dynamodb.Table("LabLogics")


def list_my_logics(user_id: str) -> list:
    res = _table.query(KeyConditionExpression=Key("userId").eq(user_id))
    return res.get("Items", [])


def save_logic(user_id: str, logic: dict) -> dict:
    """저장. dict 형태로 결과 반환. 슬롯 초과면 {'error': 'slot_full', ...}."""
    name = (logic.get("name") or "").strip()
    if not name:
        return {"error": "name_required"}

    now = datetime.now(timezone.utc).isoformat()
    items = list_my_logics(user_id)
    existing = next((it for it in items if it.get("name") == name), None)

    if existing:
        # 덮어쓰기: logicId · savedAt 유지, 나머지 갱신
        item = {
            **existing,
            **logic,
            "name": name,
            "userId": user_id,
            "logicId": existing["logicId"],
            "savedAt": existing.get("savedAt", now),
            "updatedAt": now,
        }
        _table.put_item(Item=item)
        return {"ok": True, "mode": "overwritten", "logic": item}

    if len(items) >= SLOT_LIMIT:
        return {
            "error": "slot_full",
            "current_count": len(items),
            "limit": SLOT_LIMIT,
            "existing": [
                {"logicId": it["logicId"], "name": it.get("name"), "symbol": it.get("symbol")}
                for it in items
            ],
        }

    logic_id = str(uuid.uuid4())
    item = {
        **logic,
        "name": name,
        "userId": user_id,
        "logicId": logic_id,
        "savedAt": now,
        "updatedAt": now,
    }
    _table.put_item(Item=item)
    return {"ok": True, "mode": "created", "logic": item}


def delete_logic(user_id: str, logic_id: str) -> dict:
    _table.delete_item(Key={"userId": user_id, "logicId": logic_id})
    return {"ok": True}
