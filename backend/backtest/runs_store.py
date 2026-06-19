"""
LabRuns 테이블: 사용자별 "현재 운영 상태" 단일 슬롯.
PC 앱이 매 tick마다 push, 모바일/웹이 read-only로 조회.

스키마:
  PK userId (S, Google sub)
  속성: state, mode, logicId, logicName, symbol, startedAt, lastTickAt,
        equity, returnPct, cash, position, trades(최근 N), lastEval,
        dailyLoss, tradingBlocked, blockReason, updatedAt

운영 종료 시(stop) PC가 DELETE 호출 → 항목 삭제.
PC 앱이 갑자기 꺼지면 마지막 상태가 stale로 남는다 — UI는 updatedAt이 너무 오래되면 "연결 끊김"으로 표시.
"""
import os
from datetime import datetime, timezone

import boto3


_dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")
_table = _dynamodb.Table("LabRuns")


def put_state(user_id: str, state: dict) -> dict:
    if not isinstance(state, dict):
        state = {}
    item = {
        **state,
        "userId": user_id,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    _table.put_item(Item=item)
    return {"ok": True}


def get_state(user_id: str):
    res = _table.get_item(Key={"userId": user_id})
    return res.get("Item")


def delete_state(user_id: str) -> dict:
    _table.delete_item(Key={"userId": user_id})
    return {"ok": True}
