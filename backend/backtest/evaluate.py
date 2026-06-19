"""
실시간 룰셋 평가 — PC 엔진이 매분 호출한다.

입력: ruleset + 분봉(target/base 720+) + 현재 페이퍼 포지션(또는 None)
출력: 마지막 봉 시점의 시장 변수값, 진입/익절/손절 신호

백테스트(backtest_engine.py)와 같은 features.py · safe_eval.py를 재사용하므로
같은 룰셋에 같은 분봉을 주면 의미가 동일하다.
"""
from datetime import datetime, timezone

import pandas as pd

from backtest_engine import _compile_section, _section_true
from features import (
    ENTRY_VARS, EXIT_VARS, MARKET_VARS, POSITION_VARS,
    build_features_from_candles,
)


def _last_market_state(features_df):
    last = features_df.iloc[-1]
    state = {}
    for v in MARKET_VARS:
        if v in last.index:
            val = last[v]
            state[v] = None if pd.isna(val) else float(val)
    return state, last.name  # name = timestamp index


def _position_state(position, current_price):
    """position: { entry_time(ISO8601 UTC), entry_price, fee_pct, slippage_pct } 또는 None"""
    if not position:
        return {}
    entry_price = float(position.get("entry_price", 0)) or 1.0
    fee_pct = float(position.get("fee_pct", 0))
    slip_pct = float(position.get("slippage_pct", 0))
    # 백테스트 엔진과 동일: 진입·청산 양쪽에 수수료+슬리피지 적용된 순손익 추정
    gross = current_price / entry_price - 1.0
    cost = (fee_pct + slip_pct) / 100.0 * 2  # 진입+청산
    pnl_pct = (gross - cost) * 100.0

    try:
        entry_dt = pd.to_datetime(position.get("entry_time"), utc=True)
        now = pd.Timestamp.now(tz="UTC")
        hold_min = float((now - entry_dt).total_seconds() / 60.0)
    except Exception:
        hold_min = 0.0

    return {
        "PNL_PCT": pnl_pct,
        "HOLD_MIN": hold_min,
        "ENTRY_PRICE": entry_price,
    }


def evaluate(ruleset, target_candles, base_candles, position):
    """
    반환:
      {
        "ok": True,
        "timestamp": "...",
        "market": {PRICE,...},
        "position": {PNL_PCT,...} 또는 {},
        "signals": {
          "entry": bool,           # position 없을 때만 의미 있음
          "takeProfit": bool,
          "stopLoss": bool,
        },
        "action": "ENTER" | "EXIT_TP" | "EXIT_SL" | "HOLD" | "WAIT"
      }
    """
    feats = build_features_from_candles(target_candles, base_candles)
    if feats.empty:
        return {"ok": False, "error": "not_enough_data"}

    market_state, ts = _last_market_state(feats)
    if market_state.get("PRICE") is None:
        return {"ok": False, "error": "no_price"}

    pos_state = _position_state(position, market_state["PRICE"])

    # 환경: 시장 + 포지션. entry는 시장 변수만, exit는 둘 다 가능.
    entry_env = dict(market_state)
    exit_env = {**market_state, **pos_state}

    entry_compiled = _compile_section(ruleset.get("entry"), set(ENTRY_VARS))
    tp_compiled = _compile_section(ruleset.get("takeProfit"), set(EXIT_VARS))
    sl_compiled = _compile_section(ruleset.get("stopLoss"), set(EXIT_VARS))

    if not position:
        # 진입 신호만 확인. 포지션 변수가 없으니 익절·손절은 평가하지 않음.
        entry_signal = _section_true(entry_compiled, entry_env)
        action = "ENTER" if entry_signal else "WAIT"
        signals = {"entry": entry_signal, "takeProfit": False, "stopLoss": False}
    else:
        tp_signal = _section_true(tp_compiled, exit_env)
        sl_signal = _section_true(sl_compiled, exit_env)
        # 손절 우선. 동일 봉에서 둘 다 참이면 손절 채택 (보수적).
        if sl_signal:
            action = "EXIT_SL"
        elif tp_signal:
            action = "EXIT_TP"
        else:
            action = "HOLD"
        signals = {"entry": False, "takeProfit": tp_signal, "stopLoss": sl_signal}

    return {
        "ok": True,
        "timestamp": ts.isoformat(),
        "market": market_state,
        "position": pos_state,
        "signals": signals,
        "action": action,
    }
