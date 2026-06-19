/**
 * Lab 빌더 상수 (UI 옵션 등).
 * 백엔드(backend/backtest/data_cache.py)의 TRACKED_MARKETS와 동기화 유지.
 */

export const SYMBOLS = [
  { value: 'KRW-BTC', label: '비트코인 (BTC)' },
  { value: 'KRW-ETH', label: '이더리움 (ETH)' },
  { value: 'KRW-SOL', label: '솔라나 (SOL)' },
  { value: 'KRW-XRP', label: '리플 (XRP)' },
  { value: 'KRW-DOGE', label: '도지코인 (DOGE)' },
  { value: 'KRW-ADA', label: '에이다 (ADA)' },
  { value: 'KRW-TRX', label: '트론 (TRX)' },
  { value: 'KRW-AVAX', label: '아발란체 (AVAX)' },
  { value: 'KRW-LINK', label: '체인링크 (LINK)' },
  { value: 'KRW-POL', label: '폴리곤 (POL)' },
];

export const DAYS_OPTIONS = [
  { value: 28, label: '28일' },
  { value: 60, label: '60일' },
  { value: 90, label: '90일 (3개월)' },
  { value: 180, label: '180일 (6개월)' },
  { value: 365, label: '365일 (1년)' },
];

export const OPS = ['<=', '>=', '==', '<', '>'];

export const DEFAULT_PARAMS = {
  allocation_pct: 25,
  fee_pct: 0.05,
  slippage_pct: 0.02,
};

export const DEFAULT_NAME = '내 전략';
export const DEFAULT_SYMBOL = 'KRW-SOL';
export const DEFAULT_DAYS = 28;

// 주문 발행 전략 — 실거래 시점에 PC 엔진이 사용. 백테스트는 무관(종가 체결 가정).
// 추후 N틱 오프셋 지원 위해 offset_ticks까지 스키마에 들어가지만, 현재 UI는 strategy만.
export const ORDER_STRATEGIES = [
  {
    value: 'market',
    label: '즉시 체결 (시장가)',
    desc: '반대편 호가에 즉시 매수/매도. 슬리피지가 있을 수 있으나 체결이 보장됨.',
  },
  {
    value: 'limit_best',
    label: '호가 줄서기 (지정가)',
    desc: '매수 1호가/매도 1호가에 지정가 주문. 슬리피지 없으나 체결이 보장되지 않음.',
  },
];

// 섹션별 기본값.
//  · 진입/익절은 좋은 가격을 우선시하므로 지정가(limit_best)
//  · 손절은 즉시 빠져나가는 안전성이 우선이므로 시장가(market)
//  · orderbook_rank: 지정가일 때 몇 호가에 줄설지 (1~3). 1=최우선(즉시 체결↑), 클수록 더 보수적
//  · timeout_sec: 지정가 발주 후 미체결분 자동 취소까지 대기 시간.
//    진입·익절은 못 받아도 손실 없음 → 60초 권장. 손절은 빠르게 빠져나가야 → 짧게.
export const DEFAULT_ENTRY_ORDER = { strategy: 'limit_best', offset_ticks: 0, orderbook_rank: 1, timeout_sec: 60 };
export const DEFAULT_TAKE_PROFIT_ORDER = { strategy: 'limit_best', offset_ticks: 0, orderbook_rank: 1, timeout_sec: 60 };
export const DEFAULT_STOP_LOSS_ORDER = { strategy: 'market', offset_ticks: 0, orderbook_rank: 1, timeout_sec: 4 };

export const ORDERBOOK_RANKS = [1, 2, 3];
export const TIMEOUT_OPTIONS = [4, 10, 15, 30, 60];
