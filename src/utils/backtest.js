import { safeFetch } from '../hooks/useUpbitData';

const ORDERBOOK_VARS = ['TOTAL_BID', 'TOTAL_ASK', 'BID_ASK_RATIO'];

export function usesOrderbookVars(formula) {
  return ORDERBOOK_VARS.some(v => formula.includes(v));
}

const BARS_PER_DAY = 288; // 24h * 12 (5분봉)
const REQUEST_GAP_MS = 220; // 약 4.5 req/sec — Upbit 10 req/sec 한도 안쪽

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── 5분봉 페이지네이션 (newest-first 응답을 chronological로 reverse) ──
async function fetchAll5mCandles(market, totalBars, tickProgress) {
  const all = [];
  let to = null;
  while (all.length < totalBars) {
    const remaining = totalBars - all.length;
    const count = Math.min(200, remaining);
    const baseUrl = `https://api.upbit.com/v1/candles/minutes/5?market=${market}&count=${count}`;
    const url = to ? `${baseUrl}&to=${encodeURIComponent(to)}` : baseUrl;
    const data = await safeFetch(url);
    tickProgress();
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < count) break;
    // Upbit `to`는 exclusive — 가장 오래된 봉 시각을 다음 요청의 to로
    to = data[data.length - 1].candle_date_time_utc + 'Z';
    await sleep(REQUEST_GAP_MS);
  }
  return all.reverse();
}

// ── 일봉 RSI(14) — 마지막 봉 기준 ──
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
    return { value: result, error: null };
  } catch (e) {
    return { value: null, error: 'syntax' };
  }
}

// ── 메인 함수 ──
export async function runBacktest({
  altMarket,
  formula,
  thresholds,
  days = 30,
  forwardBars = 3,
  winThreshold = 0.005,
  bigWinThreshold = 0.015,
  onProgress,
}) {
  if (usesOrderbookVars(formula)) {
    throw new Error('호가 변수가 포함된 수식은 백테스트할 수 없습니다.');
  }

  const lookbackBars = days * BARS_PER_DAY;
  const bufferBars = BARS_PER_DAY; // 24h 변동률 계산용 여유분
  const totalBars = lookbackBars + bufferBars;

  const pagesPerAsset = Math.ceil(totalBars / 200);
  const totalPages = pagesPerAsset * 2 + 1; // ALT + BTC + 일봉
  let pagesDone = 0;
  const tick = () => {
    pagesDone += 1;
    if (onProgress) onProgress(Math.min(pagesDone / totalPages, 1));
  };

  // 데이터 페치 (sequential — rate limit 안전)
  const altCandles = await fetchAll5mCandles(altMarket, totalBars, tick);
  const btcCandles = await fetchAll5mCandles('KRW-BTC', totalBars, tick);
  const altDayRaw = await safeFetch(`https://api.upbit.com/v1/candles/days?market=${altMarket}&count=60`);
  tick();
  const altDayCandles = altDayRaw ? [...altDayRaw].reverse() : [];

  if (altCandles.length === 0 || btcCandles.length === 0) {
    throw new Error('백테스트 데이터를 불러오지 못했습니다.');
  }

  // BTC 5분봉을 시각으로 빠르게 매핑 (ALT/BTC 시각 정렬용)
  const btcByTime = new Map();
  btcCandles.forEach(c => btcByTime.set(c.candle_date_time_utc, c));

  // 일봉 종가 캐시 (date string → 그 날짜 이전의 종가 배열)
  const stableDailyClosesCache = new Map();
  const stableDailyClosesBefore = (dateStr) => {
    if (stableDailyClosesCache.has(dateStr)) return stableDailyClosesCache.get(dateStr);
    const arr = altDayCandles
      .filter(d => d.candle_date_time_kst.split('T')[0] < dateStr)
      .map(d => d.trade_price);
    stableDailyClosesCache.set(dateStr, arr);
    return arr;
  };

  // 24h 누적 거래대금 (ALT, BTC) — sliding 합으로 한 번에 계산
  const altVolPrefix = [0];
  altCandles.forEach((c, i) => altVolPrefix.push(altVolPrefix[i] + (c.candle_acc_trade_price || 0)));
  const btcVolPrefix = [0];
  btcCandles.forEach((c, i) => btcVolPrefix.push(btcVolPrefix[i] + (c.candle_acc_trade_price || 0)));

  // 신호 감지 + forward return 평가
  const buySignals = [];
  const sellSignals = [];
  const strongBuySignals = [];
  const strongSellSignals = [];

  for (let i = bufferBars; i < altCandles.length - forwardBars; i++) {
    const altT = altCandles[i];
    const btcT = btcByTime.get(altT.candle_date_time_utc);
    if (!btcT) continue;

    const altPrev = altCandles[i - BARS_PER_DAY];
    const btcPrev = btcByTime.get(altPrev?.candle_date_time_utc);
    if (!altPrev || !btcPrev) continue;

    const btcRate = ((btcT.trade_price - btcPrev.trade_price) / btcPrev.trade_price) * 100;
    const altRate = ((altT.trade_price - altPrev.trade_price) / altPrev.trade_price) * 100;
    const zScore = (btcRate - altRate) / 1.2;

    const altVol24h = altVolPrefix[i + 1] - altVolPrefix[i + 1 - BARS_PER_DAY];
    const btcVol24h = btcVolPrefix[i + 1] - btcVolPrefix[i + 1 - BARS_PER_DAY];
    const volRatio = btcVol24h > 0 ? (altVol24h / btcVol24h) * 100 : 0;

    const altMomentum = ((altT.trade_price - altT.opening_price) / altT.opening_price) * 100;

    const prevBar = altCandles[i - 1] || {};

    const dateStr = altT.candle_date_time_kst.split('T')[0];
    const stableCloses = stableDailyClosesBefore(dateStr);
    const dailyClosesAtT = [...stableCloses, altT.trade_price];
    const rsi = calcRSI(dailyClosesAtT, 14);
    const bb = calcBollinger(dailyClosesAtT, altT.trade_price, 20, 2);

    const vars = {
      BTC_PRICE: btcT.trade_price,
      BTC_RATE: btcRate,
      ALT_PRICE: altT.trade_price,
      ALT_RATE: altRate,
      ALT_MOMENTUM: altMomentum,
      VOL_RATIO: volRatio,
      Z_SCORE: zScore,
      PREV_O: prevBar.opening_price || 0,
      PREV_H: prevBar.high_price || 0,
      PREV_L: prevBar.low_price || 0,
      PREV_C: prevBar.trade_price || 0,
      PREV_V: prevBar.candle_acc_trade_volume || 0,
      RSI_14: rsi === null ? 50 : rsi,
      BB_UPPER: bb.upper,
      BB_LOWER: bb.lower,
      BB_PB: bb.pb,
    };

    const { value, error } = evaluateFormula(formula, vars);
    if (error || value === null) continue;

    if (value >= thresholds.buy) {
      buySignals.push({ idx: i, price: altT.trade_price });
    }
    if (value >= thresholds.strongBuy) {
      strongBuySignals.push({ idx: i, price: altT.trade_price });
    }
    if (value <= thresholds.sell) {
      sellSignals.push({ idx: i, price: altT.trade_price });
    }
    if (value < thresholds.sell) {
      strongSellSignals.push({ idx: i, price: altT.trade_price });
    }
  }

  // forward 검사
  const evalSignals = (signals, isBuy) => {
    let wins = 0;
    let bigWins = 0;
    for (const sig of signals) {
      let win = false;
      let bigWin = false;
      const end = Math.min(sig.idx + forwardBars, altCandles.length - 1);
      for (let j = sig.idx + 1; j <= end; j++) {
        const bar = altCandles[j];
        const ratio = isBuy
          ? (bar.high_price / sig.price) - 1
          : 1 - (bar.low_price / sig.price);
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
    altMarket,
    formula,
    thresholds: { ...thresholds },
    days,
    ranAt: Date.now(),
    periodStart: altCandles[bufferBars].candle_date_time_kst,
    periodEnd: altCandles[altCandles.length - 1].candle_date_time_kst,
    buy,
    sell,
    strongBuy,
    strongSell,
  };
}
