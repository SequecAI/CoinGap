"""
로직 빌더 변수 팔레트 메타데이터 (coingap의 variableGroups에 해당).
프론트엔드가 GET /api/variables로 받아 버튼 팔레트를 렌더링한다.
"""

# 기본 시장 데이터
MARKET_GROUP = {
    "id": "market",
    "title": "시장 지표",
    "items": [
        {"label": "현재가", "value": "PRICE"},
        {"label": "비율 Z-Score", "value": "Z_SCORE"},
        {"label": "타깃/BTC 비율", "value": "RATIO"},
        {"label": "거래량", "value": "VOLUME"},
    ],
}

# 가격 변동률 (시간대별)
PRICE_CHANGE_GROUP = {
    "id": "price_change",
    "title": "가격 변동률",
    "items": [
        {"label": "1분 하락률(%)", "value": "DROP_1M"},
        {"label": "3분 하락률(%)", "value": "DROP_3M"},
        {"label": "5분 하락률(%)", "value": "DROP_5M"},
        {"label": "10분 하락률(%)", "value": "DROP_10M"},
        {"label": "30분 하락률(%)", "value": "DROP_30M"},
        {"label": "60분 하락률(%)", "value": "DROP_60M"},
        {"label": "3분 상승률(%)", "value": "RISE_3M"},
        {"label": "5분 상승률(%)", "value": "RISE_5M"},
        {"label": "10분 상승률(%)", "value": "RISE_10M"},
        {"label": "RSI(14)", "value": "RSI_14"},
    ],
}

# 이동평균 (Moving Average / Exponential MA)
MA_GROUP = {
    "id": "moving_avg",
    "title": "이동평균",
    "items": [
        {"label": "단순 MA 20", "value": "MA_20"},
        {"label": "단순 MA 60", "value": "MA_60"},
        {"label": "단순 MA 240", "value": "MA_240"},
        {"label": "지수 EMA 12", "value": "EMA_12"},
        {"label": "지수 EMA 26", "value": "EMA_26"},
        {"label": "현재가 vs MA60(%)", "value": "PRICE_VS_MA60"},
    ],
}

# 기술적 지표 (MACD + Bollinger Bands)
TECH_GROUP = {
    "id": "technical",
    "title": "기술적 지표",
    "items": [
        {"label": "MACD", "value": "MACD"},
        {"label": "MACD 시그널", "value": "MACD_SIGNAL"},
        {"label": "MACD 히스토그램", "value": "MACD_HIST"},
        {"label": "볼린저 상단", "value": "BB_UPPER"},
        {"label": "볼린저 하단", "value": "BB_LOWER"},
        {"label": "볼린저 폭(%)", "value": "BB_WIDTH"},
        {"label": "볼린저 위치(0~1)", "value": "BB_PCT"},
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
    base = [MARKET_GROUP, PRICE_CHANGE_GROUP, MA_GROUP, TECH_GROUP]
    if section == "entry":
        return [*base, MATH_GROUP]
    return [*base, POSITION_GROUP, MATH_GROUP]
