import React from 'react';
import { Settings, Crosshair, BarChart2, Shield, Zap, Gauge, Activity, TrendingUp } from 'lucide-react';
import { useCustomSettings } from '../hooks/useCustomSettings';
import CoinPricePanel from '../components/CoinPricePanel';
import {
  TradeIntensityGauge,
  RSIGauge,
  BollingerBandPanel,
  MomentumLineChart
} from './AnalysisTab';

// ── RSI Calculation ──
function calcRSI(candles, period = 14) {
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

// ── Bollinger Bands Calculation ──
function calcBollinger(candles, period = 20, multiplier = 2) {
  if (!candles || candles.length < period) return null;
  const slice = candles.slice(-period);
  const sum = slice.reduce((a, b) => a + b.trade_price, 0);
  const ma = sum / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b.trade_price - ma, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  const upper = ma + std * multiplier;
  const lower = ma - std * multiplier;
  const current = slice[slice.length - 1].trade_price;
  const percentB = (current - lower) / (upper - lower);
  const bandwidth = ((upper - lower) / ma) * 100;
  
  return { upper, lower, ma, current, percentB, bandwidth, std };
}

// ── EMA Calculation ──
function calcEMA(candles, period) {
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

// ── MACD Calculation ──
function calcMACD(candles, fast = 12, slow = 26, signal = 9) {
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

// ── MFI Calculation ──
function calcMFI(candles, period = 14) {
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

// ── StochRSI Calculation ──
function calcStochRSI(candles, period = 14, stochPeriod = 14) {
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

export default function CustomViewTab({
  candles5m,
  dayCandles,
  altName,
  alt,
  altVol,
  momentum5m,
  zScoreValue
}) {
  const { settings, toggleIndicator } = useCustomSettings();
  const { indicators } = settings;

  // 지표 계산
  const rsi = calcRSI(dayCandles);
  const bb = calcBollinger(dayCandles);
  const macd = calcMACD(dayCandles);
  const mfi = calcMFI(dayCandles);
  const stochRsi = calcStochRSI(dayCandles);

  // 12개, 20개 등 잘라서 보여줄 데이터
  const displayCandles5m = candles5m ? candles5m.slice(-12) : [];

  // 커스텀 스코어 산출 로직
  const calcCustomScore = () => {
    let scoreSum = 0;
    let count = 0;

    if (indicators.rsi && rsi !== null) {
      scoreSum += (100 - rsi);
      count++;
    }
    if (indicators.bollinger && bb) {
      const bbScore = (1 - bb.percentB) * 100;
      scoreSum += Math.max(0, Math.min(100, bbScore));
      count++;
    }
    if (indicators.momentum && momentum5m !== undefined) {
      const momScore = 50 - momentum5m * 10;
      scoreSum += Math.max(0, Math.min(100, momScore));
      count++;
    }
    if (indicators.intensity && displayCandles5m && displayCandles5m.length > 0) {
      let buyVol = 0, totalVol = 0;
      displayCandles5m.forEach(c => {
        totalVol += c.candle_acc_trade_volume;
        if (c.trade_price >= c.opening_price) buyVol += c.candle_acc_trade_volume;
      });
      const buyRatio = totalVol > 0 ? (buyVol / totalVol) * 100 : 50;
      scoreSum += buyRatio;
      count++;
    }
    if (indicators.zscore && zScoreValue !== undefined) {
      const zScoreNum = parseFloat(zScoreValue);
      const zScoreMapped = 50 + zScoreNum * (50/3);
      scoreSum += Math.max(0, Math.min(100, zScoreMapped));
      count++;
    }
    if (indicators.macd && macd) {
      // MACD 히스토그램 기반 스코어 (양수면 매수)
      const currentPrice = dayCandles[dayCandles.length - 1].trade_price;
      const histPercent = (macd.hist / currentPrice) * 100; 
      const macdScore = 50 + histPercent * 10; // 적절히 스케일링
      scoreSum += Math.max(0, Math.min(100, macdScore));
      count++;
    }
    if (indicators.mfi && mfi !== null) {
      scoreSum += (100 - mfi); // 낮을수록 과매도(매수 신호)
      count++;
    }
    if (indicators.stochrsi && stochRsi !== null) {
      scoreSum += (100 - stochRsi); // 낮을수록 과매도(매수 신호)
      count++;
    }

    if (count === 0) return 50;
    return Math.max(0, Math.min(100, scoreSum / count));
  };

  const finalScore = calcCustomScore();

  const getLabel = (s) => {
    if (s >= 70) return { text: 'Strong Buy', color: '#10b981', bg: 'bg-emerald-500/10', tc: 'text-emerald-500', bc: 'border-emerald-500/30' };
    if (s >= 55) return { text: 'Buy', color: '#34d399', bg: 'bg-emerald-400/10', tc: 'text-emerald-400', bc: 'border-emerald-400/30' };
    if (s <= 30) return { text: 'Strong Sell', color: '#ef4444', bg: 'bg-red-500/10', tc: 'text-red-500', bc: 'border-red-500/30' };
    if (s <= 45) return { text: 'Sell', color: '#f87171', bg: 'bg-red-400/10', tc: 'text-red-400', bc: 'border-red-400/30' };
    return { text: 'Neutral', color: '#94a3b8', bg: 'bg-slate-400/10', tc: 'text-slate-400', bc: 'border-slate-400/30' };
  };
  const label = getLabel(finalScore);

  const getZScoreColor = (z) => {
    const val = parseFloat(z);
    if (isNaN(val)) return 'text-slate-900';
    if (val >= 2.5) return 'text-red-600';
    if (val >= 1.5) return 'text-red-500';
    if (val > 0.5) return 'text-red-400';
    if (val <= -2.5) return 'text-blue-600';
    if (val <= -1.5) return 'text-blue-500';
    if (val < -0.5) return 'text-blue-400';
    return 'text-slate-700';
  };

  return (
    <div className="space-y-4">
      {/* 1. 상단 점수판 + 코인 가격 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
          <div className="relative z-10 text-left font-sans flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Crosshair size={16} className="text-violet-500" />
              <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Custom Signal</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-3">
              사용자가 직접 구성한 지표 조합을 바탕으로 계산된 <span className="text-violet-600 font-bold">커스텀 매수/매도 시그널</span>입니다.
            </p>
            
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center gap-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black tabular-nums text-slate-900">{finalScore.toFixed(0)}</span>
                  <span className="text-sm text-slate-400 font-bold tabular-nums">/ 100</span>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-tighter ${label.bg} ${label.tc} ${label.bc}`}>
                  {label.text}
                </div>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative">
                <div className="absolute inset-0 flex">
                  <div className="w-[30%] bg-red-500"></div>
                  <div className="w-[15%] bg-orange-400"></div>
                  <div className="w-[10%] bg-slate-300"></div>
                  <div className="w-[15%] bg-emerald-400"></div>
                  <div className="w-[30%] bg-emerald-500"></div>
                </div>
                <div className="absolute top-0 h-full w-1.5 bg-slate-900 rounded-full transition-all duration-700 shadow-md border border-white"
                  style={{ left: `${finalScore}%`, transform: 'translateX(-50%)' }} />
              </div>
            </div>
          </div>
        </div>
        <CoinPricePanel coin={alt} coinName={altName} coinVol={altVol} />
      </div>

      {/* 2. 지표 설정 토글 패널 */}
      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} className="text-slate-600" />
          <h3 className="text-slate-800 font-bold text-sm">지표 커스터마이징 (On/Off)</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToggleButton active={indicators.bollinger} onClick={() => toggleIndicator('bollinger')} label="Bollinger Bands" />
          <ToggleButton active={indicators.momentum} onClick={() => toggleIndicator('momentum')} label="Momentum Trail" />
          <ToggleButton active={indicators.rsi} onClick={() => toggleIndicator('rsi')} label="RSI-14" />
          <ToggleButton active={indicators.stochrsi} onClick={() => toggleIndicator('stochrsi')} label="Stoch RSI" />
          <ToggleButton active={indicators.mfi} onClick={() => toggleIndicator('mfi')} label="MFI-14" />
          <ToggleButton active={indicators.intensity} onClick={() => toggleIndicator('intensity')} label="Trade Intensity" />
          <ToggleButton active={indicators.zscore} onClick={() => toggleIndicator('zscore')} label="Gap Z-Score" />
          <ToggleButton active={indicators.macd} onClick={() => toggleIndicator('macd')} label="MACD (12,26,9)" />
        </div>
      </div>

      {/* 3. 선택된 지표 렌더링 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        
        {indicators.bollinger && (
          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden border border-white/5 flex flex-col">
            <div className="relative z-10 text-left font-sans flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Shield size={16} className="text-emerald-400" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Bollinger Bands</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-2">
                20일 볼린저 밴드 내 현재 위치.
              </p>
              <div className="mt-auto">
                <BollingerBandPanel bb={bb} altName={altName} />
              </div>
            </div>
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-600/10 rounded-full blur-[60px]"></div>
          </div>
        )}

        {indicators.momentum && (
          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden border border-white/5 flex flex-col">
            <div className="relative z-10 text-left font-sans flex-1">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 size={16} className="text-cyan-400" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Momentum Trail</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-2">
                최근 1시간 5분봉 모멘텀 추세.
              </p>
              <div className="mt-auto pt-2 w-full">
                <MomentumLineChart candles={displayCandles5m} />
              </div>
            </div>
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-400/5 rounded-full blur-[60px]"></div>
          </div>
        )}

        {indicators.rsi && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
            <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Gauge size={16} className="text-teal-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">RSI-14</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-2">
                일봉 기준 상대강도지수.
              </p>
              <div className="mt-auto">
                <RSIGauge rsi={rsi} />
              </div>
            </div>
          </div>
        )}

        {indicators.stochrsi && stochRsi !== null && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
            <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-blue-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Stoch RSI</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-2">
                RSI의 민감도를 극대화하여 단기 과매수/과매도를 추적합니다.
              </p>
              <div className="mt-auto">
                <RSIGauge rsi={stochRsi} /> {/* StochRSI도 0-100 */}
              </div>
            </div>
          </div>
        )}

        {indicators.mfi && mfi !== null && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
            <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={16} className="text-fuchsia-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">MFI-14</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-2">
                거래량이 실린 돈의 흐름(자금 유입)을 보여주는 지표입니다.
              </p>
              <div className="mt-auto">
                <RSIGauge rsi={mfi} /> {/* MFI도 0-100이므로 RSIGauge 재사용 */}
              </div>
            </div>
          </div>
        )}

        {indicators.intensity && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
            <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-amber-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Trade Intensity</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-3">
                최근 12개 5분봉 매수/매도 압력.
              </p>
              <div className="mt-auto">
                <TradeIntensityGauge candles={displayCandles5m} />
              </div>
            </div>
          </div>
        )}

        {indicators.zscore && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
            <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Gauge size={16} className="text-orange-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Gap Z-Score</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-3">
                비트코인 대비 상대적 가격 괴리 지수.
              </p>
              <div className="my-auto flex items-center justify-center gap-3">
                <span className={`text-6xl font-black tracking-tighter tabular-nums ${getZScoreColor(zScoreValue)}`}>
                  {zScoreValue > 0 ? '+' : ''}{zScoreValue}
                </span>
              </div>
            </div>
          </div>
        )}

        {indicators.macd && macd && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
            <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-indigo-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">MACD (12,26,9)</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-3">
                단기 이평선과 장기 이평선의 수렴/확산을 통한 추세 지표입니다.
              </p>
              <div className="mt-auto flex flex-col gap-2">
                <div className="flex justify-between items-center border-b pb-1">
                  <span className="text-xs text-slate-400 font-bold">MACD</span>
                  <span className={`text-sm font-black tabular-nums ${macd.macd >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{macd.macd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-1">
                  <span className="text-xs text-slate-400 font-bold">Signal</span>
                  <span className="text-sm font-black tabular-nums text-slate-600">{macd.signal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-bold">Histogram</span>
                  <span className={`text-sm font-black tabular-nums ${macd.hist >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{macd.hist.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
        ${active 
          ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
        }`}
    >
      {label}
    </button>
  );
}
