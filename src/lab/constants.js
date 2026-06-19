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
