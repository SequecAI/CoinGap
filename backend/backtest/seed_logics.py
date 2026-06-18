"""
초기 공유 로직 시드.

사용자가 step9_bot으로 만든 기존 전략(CoinLeakSeeker v2.0 Triple-Guard)을
새 룰셋 스키마로 표현한 것. 출시 시점에 '공유된 로직'은 이거 딱 하나만 존재한다.

step9 매핑:
  진입(MASTERPIECE): Z_SCORE <= -2.9 AND DROP_3M <= -1.6
  진입(ABS_PANIC):   DROP_3M <= -2.0            (또 다른 진입 경로 → OR 그룹)
  익절(Safety TP):   Z_SCORE >= -1.8
  익절(Rolling cut): HOLD_MIN >= 5 AND PNL_PCT <= 0
  손절(Hard SL):     PNL_PCT <= -1.8
"""

SEED_LOGIC = {
    "id": "seed-coinleakseeker-v2",
    "name": "코인 릭 시커 v2.0 (Triple-Guard)",
    "author": "코인 릭 시커",
    "description": "원작자의 기본 전략. 비율 Z-Score 과매도 + 3분 급락 동시 포착으로 진입, "
                   "3중 가드(안전 익절 / 롤링 타임컷 / 하드 손절)로 청산.",
    "symbol": "KRW-SOL",
    "allocation_pct": 25,
    "fee_pct": 0.05,
    "slippage_pct": 0.02,
    "entry": {
        "groups": [
            ["Z_SCORE <= -2.9", "DROP_3M <= -1.6"],
            ["DROP_3M <= -2.0"],
        ]
    },
    "takeProfit": {
        "groups": [
            ["Z_SCORE >= -1.8"],
            ["HOLD_MIN >= 5", "PNL_PCT <= 0"],
        ]
    },
    "stopLoss": {
        "groups": [
            ["PNL_PCT <= -1.8"],
        ]
    },
}
