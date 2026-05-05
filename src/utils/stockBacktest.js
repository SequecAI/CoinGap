import { safeFetch } from '../hooks/useUpbitData';

const NAVER_BASE = '/naver-api';

// 과거 데이터를 받아올 수 없는 변수 (스냅샷 전용)
const UNBACKTESTABLE_VARS = [
  'PER', 'PBR', 'EPS', 'BPS',
  'DIVIDEND_YIELD', 'MARKET_CAP', 'FOREIGN_RATE',
  'HIGH_52W', 'LOW_52W',
];

export function usesUnbacktestableStockVars(formula) {
  return UNBACKTESTABLE_VARS.some(v => formula.includes(v));
}

const REQUEST_GAP_MS = 220;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const num = (v) => {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/,/g, '')) || 0;
};

// Naver 일봉을 정규화된 OHLCV로 변환 (chronological order)
function normalizeDayPrices(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return [...raw].reverse().map(d => ({
    date: d.localTradedAt || '',
    open: num(d.openPrice),
    high: num(d.highPrice),
    low: num(d.lowPrice),
    close: num(d.closePrice),
    volume: num(d.accumulatedTradingVolume),
  }));
}

async function fetchStockDayCandles(stockCode, totalNeeded) {
  const PAGE_SIZE = 60;
  const pagesNeeded = Math.ceil(totalNeeded / PAGE_SIZE);
  const collected = [];
  for (let page = 1; page <= pagesNeeded; page++) {
    const data = await safeFetch(`${NAVER_BASE}/api/stock/${stockCode}/price?pageSize=${PAGE_SIZE}&page=${page}&type=day`);
    if (!data || !Array.isArray(data) || data.length === 0) break;
    collected.push(...data);
    if (data.length < PAGE_SIZE) break;
    if (page < pagesNeeded) await sleep(REQUEST_GAP_MS);
  }
  return normalizeDayPrices(collected);
}

// 지수는 fchart XML 엔드포인트 사용 (Naver mobile API에 인덱스 일봉 history가 없음)
async function fetchTextSafe(url) {
  try {
    const response = await fetch(url);
    if (response.ok) return await response.text();
  } catch (e) { }
  return null;
}

async function fetchIndexDayCandles(indexSymbol, count = 80) {
  const url = `/naver-fchart/sise.nhn?symbol=${indexSymbol}&timeframe=day&count=${count}&requestType=0`;
  const xml = await fetchTextSafe(url);
  if (!xml) return [];
  const matches = [...xml.matchAll(/<item data="([^"]+)"/g)];
  // fchart는 chronological (oldest first) 순서로 반환
  return matches.map(m => {
    const parts = m[1].split('|');
    const ymd = parts[0] || '';
    const date = ymd.length === 8
      ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
      : ymd;
    return {
      date,
      open: num(parts[1]),
      high: num(parts[2]),
      low: num(parts[3]),
      close: num(parts[4]),
      volume: num(parts[5]),
    };
  });
}

// ── 일봉 RSI(14) ──
function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

// ── 일봉 볼린저(20, 2σ) ──
function calcBollinger(closes, currentPrice, period = 20, multiplier = 2) {
  if (!closes || closes.length < period) return { upper: 0, lower: 0, pb: 0 };
  const slice = closes.slice(-period);
  const ma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - ma, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upper = ma + std * multiplier;
  const lower = ma - std * multiplier;
  const range = upper - lower;
  const pb = range > 0 ? ((currentPrice - lower) / range) * 100 : 0;
  return { upper, lower, pb: isNaN(pb) ? 0 : pb };
}

// ── 수식 평가 ──
function evaluateFormula(formula, vars) {
  try {
    if (!formula) return { value: 0, error: null };
    let evalFormula = formula;
    Object.entries(vars).forEach(([key, val]) => {
      const safeVal = (val === undefined || isNaN(val)) ? 0 : val;
      evalFormula = evalFormula.split(key).join(safeVal);
    });
    const runner = new Function('return ' + evalFormula);
    const result = runner();
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return { value: null, error: 'invalid' };
    }
    return { value: parseFloat(result.toFixed(4)), error: null };
  } catch (e) {
    return { value: null, error: 'syntax' };
  }
}

// ── 메인 함수 ──
export async function runStockBacktest({
  stockCode,
  formula,
  thresholds,
  days = 60,
  forwardBars = 3,
  winThreshold = 0.02,    // ±2%
  bigWinThreshold = 0.05, // ±5%
  onProgress,
}) {
  if (usesUnbacktestableStockVars(formula)) {
    throw new Error('재무·시장 스냅샷 변수가 포함된 수식은 백테스트할 수 없습니다.');
  }

  // backtest 기간 + 30거래일 context (RSI/BB)
  const CONTEXT_DAYS = 30;
  const stockTotal = days + CONTEXT_DAYS;          // 90 거래일치 일봉
  const indexCount = days + CONTEXT_DAYS + 10;     // fchart count 여유

  // 진행률: 주식 페이지 수 + 지수 2
  const stockPages = Math.ceil(stockTotal / 60);
  const totalPages = stockPages + 2;
  let pagesDone = 0;
  const tick = () => {
    pagesDone += 1;
    if (onProgress) onProgress(Math.min(pagesDone / totalPages, 1));
  };

  const stockDays = await fetchStockDayCandles(stockCode, stockTotal);
  // 주식 fetch 내부에서 페이지마다 끝나도 tick은 한 번만 — 진행률 단순화 위해
  for (let i = 0; i < stockPages; i++) tick();
  await sleep(REQUEST_GAP_MS);
  const kospiDays = await fetchIndexDayCandles('KOSPI', indexCount);
  tick();
  await sleep(REQUEST_GAP_MS);
  const kosdaqDays = await fetchIndexDayCandles('KOSDAQ', indexCount);
  tick();

  if (stockDays.length === 0) {
    throw new Error(`주식 일봉 데이터를 불러오지 못했습니다 (종목: ${stockCode}).`);
  }
  if (kospiDays.length === 0) {
    throw new Error('KOSPI 일봉 데이터를 불러오지 못했습니다.');
  }
  if (kosdaqDays.length === 0) {
    throw new Error('KOSDAQ 일봉 데이터를 불러오지 못했습니다.');
  }

  // 날짜로 인덱스 매핑 (지수 정렬)
  const kospiByDate = new Map(kospiDays.map(d => [d.date, d]));
  const kosdaqByDate = new Map(kosdaqDays.map(d => [d.date, d]));

  // backtest 시작 인덱스 — 마지막 days 일봉부터
  const startIdx = Math.max(1, stockDays.length - days);

  const buySignals = [];
  const sellSignals = [];
  const strongBuySignals = [];
  const strongSellSignals = [];

  for (let i = startIdx; i < stockDays.length - forwardBars; i++) {
    const T = stockDays[i];
    const prev = stockDays[i - 1];
    const kospiT = kospiByDate.get(T.date);
    const kosdaqT = kosdaqByDate.get(T.date);
    if (!kospiT || !kosdaqT) continue;

    const kospiPrev = kospiByDate.get(prev.date);
    const kosdaqPrev = kosdaqByDate.get(prev.date);
    if (!kospiPrev || !kosdaqPrev) continue;

    const stockRate = ((T.close - prev.close) / prev.close) * 100;
    const stockMomentum = ((T.close - T.open) / T.open) * 100;
    const kospiRate = ((kospiT.close - kospiPrev.close) / kospiPrev.close) * 100;
    const kosdaqRate = ((kosdaqT.close - kosdaqPrev.close) / kosdaqPrev.close) * 100;

    // RSI/BB 컨텍스트: i 시점까지의 일봉 종가
    const closesUpToT = stockDays.slice(Math.max(0, i - 30), i + 1).map(d => d.close);
    const rsi = calcRSI(closesUpToT, 14);
    const bb = calcBollinger(closesUpToT, T.close, 20, 2);

    const vars = {
      STOCK_PRICE: T.close,
      STOCK_RATE: stockRate,
      STOCK_MOMENTUM: stockMomentum,
      STOCK_VOLUME: T.volume,
      KOSPI_PRICE: kospiT.close,
      KOSPI_RATE: kospiRate,
      KOSDAQ_PRICE: kosdaqT.close,
      KOSDAQ_RATE: kosdaqRate,
      PREV_O: prev.open,
      PREV_H: prev.high,
      PREV_L: prev.low,
      PREV_C: prev.close,
      PREV_V: prev.volume,
      RSI_14: rsi === null ? 50 : rsi,
      BB_UPPER: bb.upper,
      BB_LOWER: bb.lower,
      BB_PB: bb.pb,
    };

    const { value, error } = evaluateFormula(formula, vars);
    if (error || value === null) continue;

    if (value >= thresholds.buy) {
      buySignals.push({ idx: i, price: T.close });
    }
    if (value >= thresholds.strongBuy) {
      strongBuySignals.push({ idx: i, price: T.close });
    }
    if (value <= thresholds.sell) {
      sellSignals.push({ idx: i, price: T.close });
    }
    if (value < thresholds.sell) {
      strongSellSignals.push({ idx: i, price: T.close });
    }
  }

  const evalSignals = (signals, isBuy) => {
    let wins = 0;
    let bigWins = 0;
    for (const sig of signals) {
      let win = false;
      let bigWin = false;
      const end = Math.min(sig.idx + forwardBars, stockDays.length - 1);
      for (let j = sig.idx + 1; j <= end; j++) {
        const bar = stockDays[j];
        const ratio = isBuy
          ? (bar.high / sig.price) - 1
          : 1 - (bar.low / sig.price);
        if (ratio >= winThreshold) win = true;
        if (ratio >= bigWinThreshold) { bigWin = true; break; }
      }
      if (win) wins += 1;
      if (bigWin) bigWins += 1;
    }
    return { total: signals.length, wins, bigWins };
  };

  const buy = evalSignals(buySignals, true);
  const sell = evalSignals(sellSignals, false);
  const strongBuy = evalSignals(strongBuySignals, true);
  const strongSell = evalSignals(strongSellSignals, false);

  if (onProgress) onProgress(1);

  return {
    stockCode,
    formula,
    thresholds: { ...thresholds },
    days,
    granularity: 'day',
    ranAt: Date.now(),
    periodStart: stockDays[startIdx].date,
    periodEnd: stockDays[stockDays.length - 1].date,
    buy,
    sell,
    strongBuy,
    strongSell,
  };
}
