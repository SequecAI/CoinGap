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
    """PC 엔진이 매 tick 호출. 항목을 통째로 덮어쓰되, 웹/모바일이 따로
    걸어둔 controlCommand는 보존해야 한다 (안 그러면 중지 명령이 사라짐)."""
    if not isinstance(state, dict):
        state = {}
    existing = _table.get_item(Key={"userId": user_id}).get("Item") or {}
    item = {
        **state,
        "userId": user_id,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    # 보존: 클라이언트가 PUT 사이에 걸어둔 원격 명령
    if "controlCommand" in existing:
        item["controlCommand"] = existing["controlCommand"]
    if "controlSetAt" in existing:
        item["controlSetAt"] = existing["controlSetAt"]
    _table.put_item(Item=item)
    return {"ok": True}


def get_state(user_id: str):
    res = _table.get_item(Key={"userId": user_id})
    return res.get("Item")


def delete_state(user_id: str) -> dict:
    _table.delete_item(Key={"userId": user_id})
    return {"ok": True}


# ── 원격 제어 명령 (웹/모바일 → PC) ──
# LabRuns 항목에 controlCommand 필드를 둔다. PC가 매 tick에 폴링해 처리 후 클리어.
# 항목이 없으면 (PC가 한 번도 push 안 한 상태) controlCommand만 들어간 stub을 만든다.

def set_control_command(user_id: str, command) -> dict:
    """웹/모바일이 호출. command는 dict 또는 문자열 ('stop', {'action':'start','logicId':...})."""
    now = datetime.now(timezone.utc).isoformat()
    existing = _table.get_item(Key={"userId": user_id}).get("Item") or {}
    item = {
        **existing,
        "userId": user_id,
        "controlCommand": command,
        "controlSetAt": now,
    }
    _table.put_item(Item=item)
    return {"ok": True}


def pop_control_command(user_id: str):
    """PC가 호출. command를 읽어 반환하고 즉시 필드를 비운다 (atomic 아님 — 단일 사용자 가정)."""
    res = _table.get_item(Key={"userId": user_id})
    item = res.get("Item")
    if not item:
        return None
    command = item.get("controlCommand")
    if command is None:
        return None
    # 클리어 — UpdateExpression으로 controlCommand 필드만 제거
    _table.update_item(
        Key={"userId": user_id},
        UpdateExpression="REMOVE controlCommand, controlSetAt",
    )
    return command
