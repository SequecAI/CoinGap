// ── 공통 지표 연산 모음 (Indicators) ──

export function calcRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].trade_price - candles[i - 1].trade_price;
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].trade_price - candles[i - 1].trade_price;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calcBollinger(candles, period = 20, multiplier = 2) {
  if (!candles || candles.length < period) return null;
  const slice = candles.slice(-period);
  const sum = slice.reduce((a, b) => a + b.trade_price, 0);
  const ma = sum / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b.trade_price - ma, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  const upper = ma + std * multiplier;
  const lower = ma - std * multiplier;
  const range = upper - lower;
  const current = slice[slice.length - 1].trade_price;
  const percentB = range > 0 ? (current - lower) / range : 0;
  const bandwidth = ma > 0 ? (range / ma) * 100 : 0;
  
  return { upper, lower, ma, current, percentB, bandwidth, std };
}

export function calcEMA(candles, period) {
  if (!candles || candles.length < period) return [];
  const k = 2 / (period + 1);
  let emaArr = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += candles[i].trade_price;
  let ema = sum / period;
  emaArr.push(ema);
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].trade_price - ema) * k + ema;
    emaArr.push(ema);
  }
  return emaArr;
}

export function calcMACD(candles, fast = 12, slow = 26, signal = 9) {
  if (!candles || candles.length < slow + signal) return null;
  const fastEMA = calcEMA(candles, fast);
  const slowEMA = calcEMA(candles, slow);
  const diff = fastEMA.length - slowEMA.length;
  const macdLine = [];
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + diff] - slowEMA[i]);
  }
  let sum = 0;
  for (let i = 0; i < signal; i++) sum += macdLine[i];
  let sig = sum / signal;
  const k = 2 / (signal + 1);
  for (let i = signal; i < macdLine.length; i++) {
    sig = (macdLine[i] - sig) * k + sig;
  }
  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignal = sig;
  const currentHist = currentMACD - currentSignal;
  return { macd: currentMACD, signal: currentSignal, hist: currentHist };
}

export function calcMFI(candles, period = 14) {
  if (!candles || candles.length <= period) return null;
  let posFlow = 0, negFlow = 0;
  const typicals = candles.map(c => (c.high_price + c.low_price + c.trade_price) / 3);
  for (let i = candles.length - period; i < candles.length; i++) {
    const rmf = typicals[i] * candles[i].candle_acc_trade_volume;
    if (typicals[i] > typicals[i - 1]) posFlow += rmf;
    else if (typicals[i] < typicals[i - 1]) negFlow += rmf;
  }
  if (negFlow === 0) return 100;
  const mfi = 100 - (100 / (1 + posFlow / negFlow));
  return mfi;
}

export function calcStochRSI(candles, period = 14, stochPeriod = 14) {
  if (!candles || candles.length < period + stochPeriod) return null;
  const rsiArr = [];
  for (let j = candles.length - stochPeriod; j <= candles.length; j++) {
    const r = calcRSI(candles.slice(0, j), period);
    if (r !== null) rsiArr.push(r);
  }
  if (rsiArr.length === 0) return null;
  const currentRSI = rsiArr[rsiArr.length - 1];
  const minRSI = Math.min(...rsiArr);
  const maxRSI = Math.max(...rsiArr);
  if (maxRSI === minRSI) return 50;
  return ((currentRSI - minRSI) / (maxRSI - minRSI)) * 100;
}

export function calcATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  const trueRanges = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high_price;
    const low = candles[i].low_price;
    const prevClose = candles[i - 1].trade_price;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }
  const recentATR = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
  const longATR = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  return { recentATR, longATR, trueRanges };
}

export function calcSqueezeEnergy(candles) {
  if (!candles || candles.length < 20) {
    return { score: 0, level: 'low', squeezeBars: 0, priceRatio: 1, volRatio: 1, direction: 'neutral' };
  }

  const atrData = calcATR(candles, 14);
  if (!atrData || atrData.longATR === 0) {
    return { score: 0, level: 'low', squeezeBars: 0, priceRatio: 1, volRatio: 1, direction: 'neutral' };
  }
  const priceRatio = atrData.recentATR / atrData.longATR;
  const priceScore = Math.max(0, Math.min(100, (1 - priceRatio) * 150));

  const volumes = candles.map(c => c.candle_acc_trade_volume || 0);
  const shortVolPeriod = Math.min(5, Math.floor(volumes.length / 4));
  const recentVol = volumes.slice(-shortVolPeriod).reduce((a, b) => a + b, 0) / shortVolPeriod;
  const longVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volRatio = longVol > 0 ? recentVol / longVol : 1;
  const volScore = Math.max(0, Math.min(100, (1 - volRatio) * 150));

  let squeezeBars = 0;
  const { trueRanges } = atrData;
  const avgTR = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  for (let i = trueRanges.length - 1; i >= 0; i--) {
    if (trueRanges[i] < avgTR * 0.85) {
      squeezeBars++;
    } else {
      break;
    }
  }
  const maxBars = Math.floor(candles.length * 0.6);
  const durationScore = Math.min(100, (squeezeBars / Math.max(maxBars, 5)) * 100);

  const maxPrice = Math.max(...candles.map(c => c.high_price));
  const minPrice = Math.min(...candles.map(c => c.low_price));
  const currentPrice = candles[candles.length - 1].trade_price;
  const positionPercent = maxPrice === minPrice ? 50 : ((currentPrice - minPrice) / (maxPrice - minPrice)) * 100;

  let positionType = 'mid';
  let positionLabel = '';
  let hintMsg = '';

  if (positionPercent >= 70) {
    positionType = 'high';
    positionLabel = '고점 부근 수축';
    hintMsg = '상방 돌파 또는 단기 하락 주의';
  } else if (positionPercent <= 30) {
    positionType = 'low';
    positionLabel = '저점 부근 수축';
    hintMsg = '바닥 매집 후 반등(상승) 가능성';
  } else {
    positionType = 'mid';
    positionLabel = '중간 가격대 수축';
    hintMsg = 'MA20 돌파 방향을 주시하세요';
  }

  const finalScore = (priceScore * 0.5) + (volScore * 0.3) + (durationScore * 0.2);

  let level = 'low';
  if (finalScore >= 80) level = 'high';
  else if (finalScore >= 50) level = 'mid';

  return {
    score: finalScore,
    level,
    squeezeBars,
    priceRatio,
    volRatio,
    positionType,
    positionLabel,
    hintMsg
  };
}
