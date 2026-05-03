import React from 'react';
import { Settings, Crosshair, Shield, Zap, Gauge, Activity, TrendingUp, Users, BarChart2 } from 'lucide-react';
import { useCustomSettings } from '../hooks/useCustomSettings';
import { RSIGauge, BollingerBandPanel, TradeIntensityGauge, EmptyState } from './AnalysisTab';

function parseNum(str) {
  if (str === undefined || str === null) return 0;
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

function calcRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].trade_price - candles[i - 1].trade_price;
    if (change > 0) gains += change; else losses -= change;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].trade_price - candles[i - 1].trade_price;
    avgGain = (avgGain * 13 + (change > 0 ? change : 0)) / 14;
    avgLoss = (avgLoss * 13 + (change < 0 ? -change : 0)) / 14;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calcBollinger(candles, period = 20) {
  if (!candles || candles.length < period) return null;
  const slice = candles.slice(-period);
  const ma = slice.reduce((a, b) => a + b.trade_price, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b.trade_price - ma, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upper = ma + 2 * std, lower = ma - 2 * std;
  const current = slice[slice.length - 1].trade_price;
  const percentB = (current - lower) / (upper - lower);
  const bandwidth = ((upper - lower) / ma) * 100;
  return { upper, lower, ma, current, percentB, bandwidth, std };
}

function calcEMA(candles, period) {
  if (!candles || candles.length < period) return [];
  const k = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((a, b) => a + b.trade_price, 0) / period;
  const arr = [ema];
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].trade_price - ema) * k + ema;
    arr.push(ema);
  }
  return arr;
}

function calcMACD(candles, fast = 12, slow = 26, signal = 9) {
  if (!candles || candles.length < slow + signal) return null;
  const fastEMA = calcEMA(candles, fast), slowEMA = calcEMA(candles, slow);
  const diff = fastEMA.length - slowEMA.length;
  const macdLine = slowEMA.map((v, i) => fastEMA[i + diff] - v);
  let sig = macdLine.slice(0, signal).reduce((a, b) => a + b, 0) / signal;
  const k = 2 / (signal + 1);
  for (let i = signal; i < macdLine.length; i++) sig = (macdLine[i] - sig) * k + sig;
  const cur = macdLine[macdLine.length - 1];
  return { macd: cur, signal: sig, hist: cur - sig };
}

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
  return 100 - (100 / (1 + posFlow / negFlow));
}

function calcStochRSI(candles, period = 14, stochPeriod = 14) {
  if (!candles || candles.length < period + stochPeriod) return null;
  const rsiArr = [];
  for (let j = candles.length - stochPeriod; j <= candles.length; j++) {
    const r = calcRSI(candles.slice(0, j), period);
    if (r !== null) rsiArr.push(r);
  }
  if (rsiArr.length === 0) return null;
  const cur = rsiArr[rsiArr.length - 1], mn = Math.min(...rsiArr), mx = Math.max(...rsiArr);
  if (mx === mn) return 50;
  return ((cur - mn) / (mx - mn)) * 100;
}

// 주가 차트 (일봉)
function StockPriceChart({ dayCandles }) {
  if (!dayCandles || dayCandles.length < 5) return <EmptyState text="데이터 로딩 중..." />;
  const prices = dayCandles.map(c => c.trade_price);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const ma20 = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < 19) { ma20.push(null); continue; }
    ma20.push(prices.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20);
  }
  const padX = 5, padTop = 8, padBottom = 12, chartW = 110, chartH = 55, drawW = chartW - padX * 2, drawH = chartH - padTop - padBottom;
  const toPoint = (val, idx) => ({ x: padX + (idx / (prices.length - 1)) * drawW, y: padTop + (1 - (val - minP) / range) * drawH });
  const pricePoints = prices.map((p, i) => toPoint(p, i));
  const pricePath = pricePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${pricePath} L${pricePoints[pricePoints.length - 1].x},${chartH - padBottom} L${pricePoints[0].x},${chartH - padBottom} Z`;
  const maPoints = ma20.map((v, i) => v !== null ? toPoint(v, i) : null).filter(Boolean);
  const maPath = maPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const isUp = prices[prices.length - 1] >= prices[0];
  const dateLabels = [0, Math.floor(dayCandles.length / 2), dayCandles.length - 1];
  return (
    <div className="flex flex-col gap-1 w-full">
      <svg viewBox={`0 0 ${chartW} ${chartH + 6}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <path d={areaPath} fill={isUp ? 'rgba(239, 68, 68, 0.06)' : 'rgba(59, 130, 246, 0.06)'} />
        <path d={pricePath} fill="none" stroke={isUp ? '#ef4444' : '#3b82f6'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {maPoints.length > 1 && <path d={maPath} fill="none" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="2,1" opacity="0.8" />}
        <circle cx={pricePoints[pricePoints.length - 1].x} cy={pricePoints[pricePoints.length - 1].y} r={2} fill={isUp ? '#ef4444' : '#3b82f6'} />
        {dateLabels.map(idx => {
          const c = dayCandles[idx];
          if (!c) return null;
          return <text key={idx} x={pricePoints[idx].x} y={chartH + 4} textAnchor={idx === 0 ? 'start' : idx === dayCandles.length - 1 ? 'end' : 'middle'} fontSize="3" fill="#94a3b8" fontWeight="600">{c.candle_date_time_kst?.split('T')[0]?.substring(5) || ''}</text>;
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 font-bold tabular-nums">
        <span>저가: {minP.toLocaleString()}원</span><span className="text-amber-500">━ MA20</span><span>고가: {maxP.toLocaleString()}원</span>
      </div>
    </div>
  );
}

// 52주 고저 바
function Week52Bar({ currentPrice, high52w, low52w }) {
  const high = parseNum(high52w), low = parseNum(low52w), current = parseNum(currentPrice);
  if (high === 0 || low === 0 || high === low) return <EmptyState text="데이터 없음" />;
  const pos = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">52주 최저</p><p className="text-lg font-black tabular-nums text-blue-500">{low.toLocaleString()}</p></div>
        <div className="text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">위치</p><p className="text-2xl font-black tabular-nums text-slate-900">{pos.toFixed(0)}%</p></div>
        <div className="text-right"><p className="text-[10px] font-black text-red-400 uppercase tracking-tighter">52주 최고</p><p className="text-lg font-black tabular-nums text-red-500">{high.toLocaleString()}</p></div>
      </div>
      <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-slate-300 to-red-500 opacity-30 rounded-full" />
        <div className="absolute top-0 h-full w-2 bg-slate-900 rounded-full transition-all duration-700 shadow-md border border-white" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }} />
      </div>
    </div>
  );
}

// 투자자 매매동향
function InvestorTrend({ dealTrends }) {
  if (!dealTrends || dealTrends.length === 0) return <EmptyState text="매매동향 데이터 없음" />;
  const recent5 = dealTrends.slice(0, 5);
  const fmt = (str) => { const n = parseNum(str); if (Math.abs(n) >= 10000) return `${(n/10000).toFixed(1)}만`; return n.toLocaleString(); };
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="grid grid-cols-3 gap-3">
        {[{ l: '외국인', v: recent5[0]?.foreignerPureBuyQuant }, { l: '기관', v: recent5[0]?.organPureBuyQuant }, { l: '개인', v: recent5[0]?.individualPureBuyQuant }].map(({ l, v }) => {
          const n = parseNum(v);
          return (<div key={l} className="text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{l}</p><p className={`text-sm font-black tabular-nums ${n > 0 ? 'text-red-500' : 'text-blue-500'}`}>{n > 0 ? '+' : ''}{fmt(v)}</p></div>);
        })}
      </div>
    </div>
  );
}

// 지수 미니 (얇게)
function IndexMiniCard({ name, price, change, direction }) {
  const isUp = direction === 'RISING', isDown = direction === 'FALLING';
  return (
    <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between w-full">
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{name}</p>
      <div className="flex items-center gap-4">
        <p className="text-lg font-black tabular-nums text-slate-900 leading-tight">{price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        <p className={`text-sm font-black tabular-nums ${isUp ? 'text-red-500' : isDown ? 'text-blue-500' : 'text-slate-500'}`}>
          {isUp ? '▲' : isDown ? '▼' : '-'} {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

// 주식 가격 패널
function StockPricePanel({ stockName, currentPrice, changeRate, changeDirection, marketCap }) {
  if (!currentPrice) return <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-center"><p className="text-slate-400 font-bold text-sm">로딩중...</p></div>;
  const isUp = changeDirection === 'RISING' || changeDirection === 'UPPER_LIMIT';
  const isDown = changeDirection === 'FALLING' || changeDirection === 'LOWER_LIMIT';
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center relative overflow-hidden h-full">
      <h3 className="text-slate-500 font-black text-base uppercase tracking-widest mb-1">{stockName}</h3>
      <div className="flex items-baseline justify-center gap-1.5 mb-2">
        <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900 leading-none">{currentPrice.toLocaleString()}</span>
        <span className="text-sm text-slate-400 font-black">원</span>
      </div>
      <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
        <div className={`flex items-center gap-1 font-black text-xl ${isUp ? 'text-red-500' : isDown ? 'text-blue-500' : 'text-slate-500'}`}>
          <span className="text-sm">{isUp ? '▲' : isDown ? '▼' : '-'}</span>
          <span>{changeRate >= 0 ? '+' : ''}{changeRate.toFixed(2)}%</span>
        </div>
        {marketCap && <div className="px-3 py-1 rounded-full text-[10px] font-black border bg-slate-50 text-slate-500 border-slate-200">시총: {marketCap}</div>}
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${active ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'}`}>
      {label}
    </button>
  );
}

export default function StockCustomViewTab({
  dayCandles, momentum, stockName, currentPrice, changeRate, changeDirection,
  marketCap, per, pbr, eps, bps, dividendYield, foreignRate, high52w, low52w,
  dealTrends, kospiPrice, kospiChange, kospiDirection, kosdaqPrice, kosdaqChange, kosdaqDirection,
}) {
  const { settings, toggleIndicator } = useCustomSettings();
  const { indicators } = settings;

  const displayDay = dayCandles ? dayCandles.slice(-60) : [];
  const displayRecent12 = dayCandles ? dayCandles.slice(-12) : [];
  const rsi = calcRSI(displayDay);
  const bb = calcBollinger(displayDay);
  const macd = calcMACD(displayDay);
  const mfi = calcMFI(displayDay);
  const stochRsi = calcStochRSI(displayDay);

  const zScoreValue = bb && bb.std > 0 ? ((currentPrice - bb.ma) / bb.std).toFixed(2) : '0.00';
  const getZScoreColor = (z) => {
    const val = parseFloat(z);
    if (isNaN(val)) return 'text-slate-900';
    if (val >= 2.0) return 'text-red-600';
    if (val >= 1.0) return 'text-red-500';
    if (val > 0.5) return 'text-red-400';
    if (val <= -2.0) return 'text-blue-600';
    if (val <= -1.0) return 'text-blue-500';
    if (val < -0.5) return 'text-blue-400';
    return 'text-slate-700';
  };

  // 커스텀 스코어
  const calcScore = () => {
    let sum = 0, cnt = 0;
    if (indicators.rsi && rsi !== null) { sum += (100 - rsi); cnt++; }
    if (indicators.bollinger && bb) { sum += Math.max(0, Math.min(100, (1 - bb.percentB) * 100)); cnt++; }
    if (indicators.priceMomentum && momentum !== undefined) { sum += Math.max(0, Math.min(100, 50 - momentum * 10)); cnt++; }
    if (indicators.macd && macd) {
      const cp = displayDay.length > 0 ? displayDay[displayDay.length - 1].trade_price : 1;
      sum += Math.max(0, Math.min(100, 50 + (macd.hist / cp) * 1000)); cnt++;
    }
    if (indicators.mfi && mfi !== null) { sum += (100 - mfi); cnt++; }
    if (indicators.stochrsi && stochRsi !== null) { sum += (100 - stochRsi); cnt++; }
    return cnt === 0 ? 50 : Math.max(0, Math.min(100, sum / cnt));
  };

  const finalScore = calcScore();
  const getLabel = (s) => {
    if (s >= 70) return { text: 'Strong Buy', bg: 'bg-emerald-500/10', tc: 'text-emerald-500', bc: 'border-emerald-500/30' };
    if (s >= 55) return { text: 'Buy', bg: 'bg-emerald-400/10', tc: 'text-emerald-400', bc: 'border-emerald-400/30' };
    if (s <= 30) return { text: 'Strong Sell', bg: 'bg-red-500/10', tc: 'text-red-500', bc: 'border-red-500/30' };
    if (s <= 45) return { text: 'Sell', bg: 'bg-red-400/10', tc: 'text-red-400', bc: 'border-red-400/30' };
    return { text: 'Neutral', bg: 'bg-slate-400/10', tc: 'text-slate-400', bc: 'border-slate-400/30' };
  };
  const label = getLabel(finalScore);

  return (
    <div className="space-y-4">
      {/* 상단 고정 패널: 2열 2행 */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
            <div className="relative z-10 text-left font-sans flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Crosshair size={16} className="text-violet-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Custom Signal</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-3">커스텀 지표 조합 <span className="text-violet-600 font-bold">시그널</span></p>
              <div className="flex flex-col gap-3 w-full">
                <div className="flex items-center gap-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black tabular-nums text-slate-900">{finalScore.toFixed(0)}</span>
                    <span className="text-sm text-slate-400 font-bold tabular-nums">/ 100</span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-tighter ${label.bg} ${label.tc} ${label.bc}`}>{label.text}</div>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative">
                  <div className="absolute inset-0 flex">
                    <div className="w-[30%] bg-red-500" /><div className="w-[15%] bg-orange-400" /><div className="w-[10%] bg-slate-300" /><div className="w-[15%] bg-emerald-400" /><div className="w-[30%] bg-emerald-500" />
                  </div>
                  <div className="absolute top-0 h-full w-1.5 bg-slate-900 rounded-full transition-all duration-700 shadow-md border border-white" style={{ left: `${finalScore}%`, transform: 'translateX(-50%)' }} />
                </div>
              </div>
            </div>
          </div>
          <StockPricePanel stockName={stockName} currentPrice={currentPrice} changeRate={changeRate} changeDirection={changeDirection} marketCap={marketCap} />
        </div>
        
        {/* KOSPI, KOSDAQ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <IndexMiniCard name="KOSPI" price={kospiPrice} change={kospiChange} direction={kospiDirection} />
          <IndexMiniCard name="KOSDAQ" price={kosdaqPrice} change={kosdaqChange} direction={kosdaqDirection} />
        </div>
      </div>

      {/* 토글 패널 */}
      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} className="text-slate-600" />
          <h3 className="text-slate-800 font-bold text-sm">지표 커스터마이징 (On/Off)</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToggleButton active={indicators.bollinger} onClick={() => toggleIndicator('bollinger')} label="Bollinger Bands" />
          <ToggleButton active={indicators.momentum} onClick={() => toggleIndicator('momentum')} label="Price Chart" />
          <ToggleButton active={indicators.priceMomentum} onClick={() => toggleIndicator('priceMomentum')} label="Price Momentum" />
          <ToggleButton active={indicators.zscore} onClick={() => toggleIndicator('zscore')} label="Z-Score" />
          <ToggleButton active={indicators.rsi} onClick={() => toggleIndicator('rsi')} label="RSI-14" />
          <ToggleButton active={indicators.stochrsi} onClick={() => toggleIndicator('stochrsi')} label="Stoch RSI" />
          <ToggleButton active={indicators.mfi} onClick={() => toggleIndicator('mfi')} label="MFI-14" />
          <ToggleButton active={indicators.intensity} onClick={() => toggleIndicator('intensity')} label="Trade Intensity" />
          <ToggleButton active={indicators.macd} onClick={() => toggleIndicator('macd')} label="MACD (12,26,9)" />
        </div>
      </div>

      {/* 지표 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {indicators.bollinger && (
          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl border border-white/5 flex flex-col">
            <div className="text-left font-sans flex-1">
              <div className="flex items-center gap-2 mb-1"><Shield size={16} className="text-emerald-400" /><h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Bollinger Bands</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">20일 볼린저 밴드 위치</p>
              <div className="mt-auto"><BollingerBandPanel bb={bb} altName={stockName} /></div>
            </div>
          </div>
        )}
        {indicators.momentum && (
          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl border border-white/5 flex flex-col">
            <div className="text-left font-sans flex-1">
              <div className="flex items-center gap-2 mb-1"><Activity size={16} className="text-cyan-400" /><h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Price Chart</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">최근 약 3개월(60일) 일봉 추세와 이동평균선(MA20)입니다.</p>
              <div className="mt-auto pt-2"><StockPriceChart dayCandles={displayDay} /></div>
            </div>
          </div>
        )}
        {indicators.priceMomentum && (
          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl border border-white/5 flex flex-col">
            <div className="text-left font-sans flex-1">
              <div className="flex items-center gap-2 mb-1"><Zap size={16} className="text-yellow-400" /><h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Price Momentum</h3></div>
              <div className="flex items-baseline gap-3 mb-4">
                <span className={`text-5xl font-black tracking-tighter tabular-nums ${momentum >= 0 ? 'text-white' : 'text-blue-400'}`}>
                  {momentum.toFixed(2)}%
                </span>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${momentum >= 0 ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                  {momentum >= 0 ? 'UP' : 'DOWN'}
                </div>
              </div>
              <p className="text-xs text-slate-400 font-medium leading-relaxed border-t border-white/10 pt-4">최근 5분 가격 변동률</p>
            </div>
          </div>
        )}
        {indicators.zscore && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
            <div className="text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1"><Gauge size={16} className="text-orange-500" /><h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Z-Score</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-3">20일 평균선(MA20) 대비 표준편차 괴리도.</p>
              <div className="my-auto flex items-center justify-center gap-3">
                <span className={`text-6xl font-black tracking-tighter tabular-nums ${getZScoreColor(zScoreValue)}`}>{zScoreValue > 0 ? '+' : ''}{zScoreValue}</span>
              </div>
            </div>
          </div>
        )}
        {indicators.rsi && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
            <div className="text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1"><Gauge size={16} className="text-teal-500" /><h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">RSI-14</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">일봉 상대강도지수</p>
              <div className="mt-auto"><RSIGauge rsi={rsi} /></div>
            </div>
          </div>
        )}
        {indicators.stochrsi && stochRsi !== null && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
            <div className="text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1"><Zap size={16} className="text-blue-500" /><h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Stoch RSI</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">RSI 민감도 극대화 지표</p>
              <div className="mt-auto"><RSIGauge rsi={stochRsi} /></div>
            </div>
          </div>
        )}
        {indicators.mfi && mfi !== null && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
            <div className="text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1"><Activity size={16} className="text-fuchsia-500" /><h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">MFI-14</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">자금 흐름 지표</p>
              <div className="mt-auto"><RSIGauge rsi={mfi} /></div>
            </div>
          </div>
        )}
        {indicators.intensity && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
            <div className="text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1"><Zap size={16} className="text-amber-500" /><h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Trade Intensity</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-3">최근 12일간의 매수/매도 압력 추정.</p>
              <div className="mt-auto"><TradeIntensityGauge candles={displayRecent12} /></div>
            </div>
          </div>
        )}
        {indicators.macd && macd && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
            <div className="text-left font-sans flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1"><TrendingUp size={16} className="text-indigo-500" /><h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">MACD (12,26,9)</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-3">추세 수렴/확산 지표</p>
              <div className="mt-auto flex flex-col gap-2">
                {[{ l: 'MACD', v: macd.macd }, { l: 'Signal', v: macd.signal }, { l: 'Histogram', v: macd.hist }].map(({ l, v }) => (
                  <div key={l} className="flex justify-between items-center border-b pb-1">
                    <span className="text-xs text-slate-400 font-bold">{l}</span>
                    <span className={`text-sm font-black tabular-nums ${v >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{v.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
