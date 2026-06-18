"""
로직 빌더 변수 팔레트 메타데이터 (coingap의 variableGroups에 해당).
프론트엔드가 GET /api/variables로 받아 버튼 팔레트를 렌더링한다.
"""

# 진입/익절/손절 공통 시장 변수
MARKET_GROUP = {
    "id": "market",
    "title": "시장 지표",
    "items": [
        {"label": "현재가", "value": "PRICE"},
        {"label": "비율 Z-Score", "value": "Z_SCORE"},
        {"label": "타깃/BTC 비율", "value": "RATIO"},
        {"label": "3분 하락률(%)", "value": "DROP_3M"},
        {"label": "5분 하락률(%)", "value": "DROP_5M"},
        {"label": "RSI(14)", "value": "RSI_14"},
        {"label": "거래량", "value": "VOLUME"},
    ],
}

# 익절/손절 전용 포지션 변수
POSITION_GROUP = {
    "id": "position",
    "title": "포지션 (보유 중)",
    "items": [
        {"label": "현재 손익률(%)", "value": "PNL_PCT"},
        {"label": "보유 시간(분)", "value": "HOLD_MIN"},
        {"label": "진입가", "value": "ENTRY_PRICE"},
    ],
}

MATH_GROUP = {
    "id": "math",
    "title": "수학 함수",
    "isFunction": True,
    "items": [
        {"label": "절대값", "value": "abs("},
        {"label": "최소", "value": "min("},
        {"label": "최대", "value": "max("},
        {"label": "로그", "value": "log("},
        {"label": "루트", "value": "sqrt("},
    ],
}

OPERATORS = ["<=", ">=", "<", ">", "=="]


def palette_for(section):
    """section: 'entry' | 'exit'. 해당 섹션에서 사용 가능한 변수 그룹 목록."""
    if section == "entry":
        return [MARKET_GROUP, MATH_GROUP]
    return [MARKET_GROUP, POSITION_GROUP, MATH_GROUP]
