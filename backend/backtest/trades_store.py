"""
LabTrades 테이블: 사용자의 모든 거래(진입/익절/손절)를 영구 저장.

스키마:
  PK userId (S, Google sub)
  SK time   (S, ISO8601 UTC) — 정렬 가능하므로 between으로 범위 쿼리

속성: tradeId, action(ENTER/EXIT_TP/EXIT_SL), price, qty, krw, fees,
      pnlKrw?, pnlPct?, reason?, orderUuid?, mode(live/paper),
      symbol, logicName, logicId
"""
import uuid

import boto3
from boto3.dynamodb.conditions import Key


_dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")
_table = _dynamodb.Table("LabTrades")


def put_trade(user_id: str, trade: dict) -> dict:
    if not isinstance(trade, dict) or not trade.get("time"):
        raise ValueError("trade.time required")
    item = {
        **trade,
        "userId": user_id,
        "tradeId": str(uuid.uuid4()),
    }
    _table.put_item(Item=item)
    return {"ok": True, "tradeId": item["tradeId"]}


def query_trades(user_id: str, from_iso: str, to_iso: str, limit: int = 500):
    res = _table.query(
        KeyConditionExpression=Key("userId").eq(user_id) & Key("time").between(from_iso, to_iso),
        Limit=limit,
        ScanIndexForward=True,
    )
    return res.get("Items", [])
