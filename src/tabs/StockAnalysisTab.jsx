import React from 'react';
import { Crosshair, Shield, Activity, Zap, Gauge, TrendingUp, TrendingDown, Users } from 'lucide-react';
import {
  SignalScorePanel,
  BollingerBandPanel,
  RSIGauge,
  TradeIntensityGauge,
  EmptyState,
  calcSignalScore,
} from './AnalysisTab';

// ── 네이버 숫자 파싱 ──
function parseNum(str) {
  if (str === undefined || str === null) return 0;
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

// ── RSI 계산 ──
function calcRSI(candles) {
  if (!candles || candles.length < 15) return null;
  const prices = candles.map(c => c.trade_price);
  let gains = 0, losses = 0;
  for (let i = 1; i < Math.min(15, prices.length); i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const period = Math.min(14, prices.length - 1);
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ── 볼린저 밴드 계산 ──
function calcBollinger(candles) {
  if (!candles || candles.length < 20) return null;
  const prices = candles.slice(-20).map(c => c.trade_price);
  const ma = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((acc, p) => acc + Math.pow(p - ma, 2), 0) / prices.length;
  const std = Math.sqrt(variance);
  const upper = ma + 2 * std;
  const lower = ma - 2 * std;
  const current = prices[prices.length - 1];
  const percentB = std > 0 ? (current - lower) / (upper - lower) : 0.5;
  const bandwidth = ma > 0 ? ((upper - lower) / ma) * 100 : 0;
  return { upper, lower, ma, current, percentB, bandwidth, std };
}

// ── 주가 차트 (일봉) ──
function StockPriceChart({ dayCandles }) {
  if (!dayCandles || dayCandles.length < 5) return <EmptyState text="데이터 로딩 중..." />;

  const prices = dayCandles.map(c => c.trade_price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  // 20일 이동평균선
  const ma20 = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < 19) { ma20.push(null); continue; }
    const avg = prices.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20;
    ma20.push(avg);
  }

  const padX = 5, padTop = 8, padBottom = 12;
  const chartW = 110, chartH = 55;
  const drawW = chartW - padX * 2;
  const drawH = chartH - padTop - padBottom;

  const toPoint = (val, idx) => ({
    x: padX + (idx / (prices.length - 1)) * drawW,
    y: padTop + (1 - (val - minP) / range) * drawH,
  });

  const pricePoints = prices.map((p, i) => toPoint(p, i));
  const pricePath = pricePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${pricePath} L${pricePoints[pricePoints.length - 1].x},${chartH - padBottom} L${pricePoints[0].x},${chartH - padBottom} Z`;

  const maPoints = ma20
    .map((v, i) => v !== null ? toPoint(v, i) : null)
    .filter(Boolean);
  const maPath = maPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const lastPrice = prices[prices.length - 1];
  const firstPrice = prices[0];
  const isUp = lastPrice >= firstPrice;

  // 날짜 라벨
  const dateLabels = [0, Math.floor(dayCandles.length / 2), dayCandles.length - 1];

  return (
    <div className="flex flex-col gap-1 w-full">
      <svg viewBox={`0 0 ${chartW} ${chartH + 6}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* 영역 */}
        <path d={areaPath} fill={isUp ? 'rgba(239, 68, 68, 0.06)' : 'rgba(59, 130, 246, 0.06)'} />
        {/* 가격선 */}
        <path d={pricePath} fill="none" stroke={isUp ? '#ef4444' : '#3b82f6'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* MA20 */}
        {maPoints.length > 1 && (
          <path d={maPath} fill="none" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="2,1" opacity="0.8" />
        )}
        {/* 최근 점 */}
        <circle cx={pricePoints[pricePoints.length - 1].x} cy={pricePoints[pricePoints.length - 1].y}
          r={2} fill={isUp ? '#ef4444' : '#3b82f6'} />
        {/* 날짜 라벨 */}
        {dateLabels.map(idx => {
          const c = dayCandles[idx];
          if (!c) return null;
          const dateStr = c.candle_date_time_kst?.split('T')[0]?.substring(5) || '';
          const anchor = idx === 0 ? 'start' : idx === dayCandles.length - 1 ? 'end' : 'middle';
          return (
            <text key={idx} x={pricePoints[idx].x} y={chartH + 4} textAnchor={anchor}
              fontSize="3" fill="#94a3b8" fontWeight="600">{dateStr}</text>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 font-bold tabular-nums">
        <span>저가: {minP.toLocaleString()}원</span>
        <span className="text-amber-500">━ MA20</span>
        <span>고가: {maxP.toLocaleString()}원</span>
      </div>
    </div>
  );
}

// ── 52주 고저 진행바 ──
function Week52Bar({ currentPrice, high52w, low52w }) {
  const high = parseNum(high52w);
  const low = parseNum(low52w);
  const current = parseNum(currentPrice);

  if (high === 0 || low === 0 || high === low) return <EmptyState text="데이터 없음" />;

  const position = ((current - low) / (high - low)) * 100;
  const clampedPos = Math.max(0, Math.min(100, position));

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-tighter mb-0.5">52주 최저</p>
          <p className="text-lg font-black tabular-nums text-blue-500">{low.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">현재 위치</p>
          <p className="text-2xl font-black tabular-nums text-slate-900">{clampedPos.toFixed(0)}%</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-red-400 uppercase tracking-tighter mb-0.5">52주 최고</p>
          <p className="text-lg font-black tabular-nums text-red-500">{high.toLocaleString()}</p>
        </div>
      </div>

      <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-slate-300 to-red-500 opacity-30 rounded-full" />
        <div className="absolute top-0 h-full w-2 bg-slate-900 rounded-full transition-all duration-700 shadow-md border border-white"
          style={{ left: `${clampedPos}%`, transform: 'translateX(-50%)' }} />
      </div>
    </div>
  );
}

// ── 투자자별 매매동향 ──
function InvestorTrend({ dealTrends }) {
  if (!dealTrends || dealTrends.length === 0) return <EmptyState text="매매동향 데이터 없음" />;

  const recent5 = dealTrends.slice(0, 5);

  const formatQuant = (str) => {
    const num = parseNum(str);
    if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(1)}만`;
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}천`;
    return num.toLocaleString();
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* 최신일 요약 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '외국인', value: recent5[0]?.foreignerPureBuyQuant, color: 'blue' },
          { label: '기관', value: recent5[0]?.organPureBuyQuant, color: 'purple' },
          { label: '개인', value: recent5[0]?.individualPureBuyQuant, color: 'amber' },
        ].map(({ label, value, color }) => {
          const num = parseNum(value);
          const isPositive = num > 0;
          return (
            <div key={label} className="text-center">
              <p className={`text-[10px] font-black text-${color}-400 uppercase tracking-tighter mb-0.5`}>{label}</p>
              <p className={`text-sm font-black tabular-nums ${isPositive ? 'text-red-500' : 'text-blue-500'}`}>
                {isPositive ? '+' : ''}{formatQuant(value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* 5일 추세 바 차트 */}
      <div className="space-y-1.5">
        {recent5.reverse().map((d, i) => {
          const foreign = parseNum(d.foreignerPureBuyQuant);
          const organ = parseNum(d.organPureBuyQuant);
          const indiv = parseNum(d.individualPureBuyQuant);
          const maxAbs = Math.max(Math.abs(foreign), Math.abs(organ), Math.abs(indiv), 1);
          const date = d.bizdate ? `${d.bizdate.substring(4, 6)}/${d.bizdate.substring(6)}` : '';

          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 font-bold w-10 shrink-0">{date}</span>
              <div className="flex-1 flex gap-0.5">
                {[
                  { val: foreign, color: 'bg-blue-500' },
                  { val: organ, color: 'bg-purple-500' },
                  { val: indiv, color: 'bg-amber-500' },
                ].map(({ val, color }, j) => {
                  const width = Math.max(2, (Math.abs(val) / maxAbs) * 100);
                  return (
                    <div key={j} className={`h-2.5 rounded-full ${color} transition-all duration-300`}
                      style={{ width: `${width / 3}%`, opacity: val >= 0 ? 0.8 : 0.3 }}
                      title={`${val >= 0 ? '+' : ''}${val.toLocaleString()}`} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-4 text-[9px] text-slate-400 font-bold">
        <span><span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1" />외국인</span>
        <span><span className="inline-block w-2 h-2 bg-purple-500 rounded-full mr-1" />기관</span>
        <span><span className="inline-block w-2 h-2 bg-amber-500 rounded-full mr-1" />개인</span>
      </div>
    </div>
  );
}

// ── 밸류에이션 카드 ──
function ValuationPanel({ per, pbr, eps, bps, dividendYield, foreignRate }) {
  const items = [
    { label: 'PER', value: per, desc: '주가수익비율' },
    { label: 'PBR', value: pbr, desc: '주가순자산비율' },
    { label: 'EPS', value: eps, desc: '주당순이익' },
    { label: 'BPS', value: bps, desc: '주당순자산' },
    { label: '배당수익률', value: dividendYield, desc: 'Dividend Yield' },
    { label: '외인소진율', value: foreignRate, desc: 'Foreign Holding' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {items.map(({ label, value, desc }) => (
        <div key={label} className="flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{label}</span>
          <span className="text-lg font-black tabular-nums text-slate-900 leading-tight">{value || '-'}</span>
          <span className="text-[9px] text-slate-400 font-medium">{desc}</span>
        </div>
      ))}
    </div>
  );
}

// ── 주식 가격 패널 ──
function StockPricePanel({ stockName, currentPrice, changeRate, changeDirection, marketCap, volume }) {
  if (!currentPrice) return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-center">
      <p className="text-slate-400 font-bold text-sm">로딩중...</p>
    </div>
  );

  const isUp = changeDirection === 'RISING' || changeDirection === 'UPPER_LIMIT';
  const isDown = changeDirection === 'FALLING' || changeDirection === 'LOWER_LIMIT';

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center relative overflow-hidden group h-full">
      <div className="relative z-10 w-full flex flex-col items-center">
        <h3 className="text-slate-500 font-black text-base uppercase tracking-widest mb-1">{stockName}</h3>
        <div className="flex items-baseline justify-center gap-1.5 mb-2">
          <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900 leading-none">
            {currentPrice.toLocaleString()}
          </span>
          <span className="text-sm text-slate-400 font-black">원</span>
        </div>
        <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
          <div className={`flex items-center gap-1 font-black text-xl ${isUp ? 'text-red-500' : isDown ? 'text-blue-500' : 'text-slate-500'}`}>
            <span className="text-sm">{isUp ? '▲' : isDown ? '▼' : '-'}</span>
            <span>{changeRate >= 0 ? '+' : ''}{changeRate.toFixed(2)}%</span>
          </div>
          {marketCap && (
            <div className="px-3 py-1 rounded-full text-[10px] font-black border bg-slate-50 text-slate-500 border-slate-200 uppercase tracking-tight">
              시총: {marketCap}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 지수 미니 카드 (얇게 변경) ──
function IndexMiniCard({ name, price, change, direction }) {
  const isUp = direction === 'RISING';
  const isDown = direction === 'FALLING';

  return (
    <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between w-full">
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{name}</p>
      <div className="flex items-center gap-4">
        <p className="text-lg font-black tabular-nums text-slate-900 leading-tight">
          {price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
        <p className={`text-sm font-black tabular-nums ${isUp ? 'text-red-500' : isDown ? 'text-blue-500' : 'text-slate-500'}`}>
          {isUp ? '▲' : isDown ? '▼' : '-'} {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

// ── 메인 StockAnalysisTab ──
export default function StockAnalysisTab({
  dayCandles,
  momentum,
  stockName,
  currentPrice,
  changeRate,
  changeDirection,
  marketCap,
  volume,
  per, pbr, eps, bps,
  dividendYield,
  foreignRate,
  high52w, low52w,
  dealTrends,
  kospiPrice, kospiChange, kospiDirection,
  kosdaqPrice, kosdaqChange, kosdaqDirection,
}) {
  const displayDayCandles = dayCandles ? dayCandles.slice(-60) : [];
  const displayRecent12 = dayCandles ? dayCandles.slice(-12) : []; // Trade Intensity 용

  const rsi = calcRSI(displayDayCandles);
  const bb = calcBollinger(displayDayCandles);
  const signal = calcSignalScore(rsi, bb, momentum, displayDayCandles);

  // Z-Score (현재가가 MA20 대비 몇 표준편차 떨어져 있는지)
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">

      {/* 1. 상단 고정 패널: 2열 2행 (시그널/현재가 + 지수) */}
      <div className="col-span-1 md:col-span-2 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 시그널 점수 */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col col-span-1">
            <div className="relative z-10 text-left font-sans flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Crosshair size={16} className="text-violet-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Signal</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-3">
                RSI, 볼린저, 일봉 모멘텀 기반 <span className="text-violet-600 font-bold">매수/매도 신호</span>
              </p>
              <SignalScorePanel score={signal.score} />
            </div>
          </div>
          {/* 현재가 */}
          <StockPricePanel stockName={stockName} currentPrice={currentPrice} changeRate={changeRate}
            changeDirection={changeDirection} marketCap={marketCap} volume={volume} />
        </div>
        
        {/* KOSPI, KOSDAQ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <IndexMiniCard name="KOSPI" price={kospiPrice} change={kospiChange} direction={kospiDirection} />
          <IndexMiniCard name="KOSDAQ" price={kosdaqPrice} change={kosdaqChange} direction={kosdaqDirection} />
        </div>
      </div>

      {/* 2. 볼린저 밴드 */}
      <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden border border-white/5 flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className="text-emerald-400" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Bollinger Bands</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-2">
            {stockName}의 <span className="text-emerald-400 font-bold">20일 볼린저 밴드</span> 내 현재 위치입니다.
          </p>
          <div className="mt-auto">
            <BollingerBandPanel bb={bb} altName={stockName} />
          </div>
        </div>
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-600/10 rounded-full blur-[60px]"></div>
      </div>

      {/* 3. 일봉 차트 */}
      <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden border border-white/5 flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-cyan-400" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Price Chart</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-2">
            최근 약 3개월(60일) <span className="text-cyan-400 font-bold">일봉 추세</span>와 이동평균선(MA20)입니다.
          </p>
          <div className="mt-auto pt-2 w-full">
            <StockPriceChart dayCandles={displayDayCandles} />
          </div>
        </div>
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-400/5 rounded-full blur-[60px]"></div>
      </div>

      {/* 4. Trade Intensity (Valuation 기존 위치) */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-amber-500" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Trade Intensity</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-3">
            최근 12일간의 <span className="text-red-500 font-bold">매수</span> vs <span className="text-blue-500 font-bold">매도</span> 압력 추정입니다.
          </p>
          <div className="mt-auto">
            <TradeIntensityGauge candles={displayRecent12} />
          </div>
        </div>
      </div>

      {/* 5. RSI-14 */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Gauge size={16} className="text-teal-500" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">RSI-14</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-2">
            일봉 기준 <span className="text-teal-600 font-bold">상대강도지수</span>입니다. 70↑ 과매수, 30↓ 과매도 구간입니다.
          </p>
          <div className="mt-auto">
            <RSIGauge rsi={rsi} />
          </div>
        </div>
      </div>

      {/* 6. Valuation (52W Range 기존 위치) */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-amber-500" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Valuation</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-3">
            {stockName}의 <span className="text-amber-500 font-bold">밸류에이션 지표</span> 현황입니다.
          </p>
          <div className="mt-auto">
            <ValuationPanel per={per} pbr={pbr} eps={eps} bps={bps}
              dividendYield={dividendYield} foreignRate={foreignRate} />
          </div>
        </div>
      </div>

      {/* 8. 투자자 매매동향 */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-purple-500" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Investor Flow</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-3">
            최근 5일 <span className="text-purple-500 font-bold">투자자별 순매수</span> 동향입니다.
          </p>
          <div className="mt-auto">
            <InvestorTrend dealTrends={dealTrends} />
          </div>
        </div>
      </div>

      {/* 9. 52주 고저 (최하단으로 이동) */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-indigo-500" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">52W Range</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-3">
            52주 최고/최저 대비 <span className="text-indigo-500 font-bold">현재 위치</span>입니다.
          </p>
          <div className="mt-auto">
            <Week52Bar currentPrice={currentPrice} high52w={high52w} low52w={low52w} />
          </div>
        </div>
      </div>

      {/* 7. Z-Score (신규 추가) */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Gauge size={16} className="text-orange-500" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Z-Score</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-3">
            20일 평균선(MA20) 대비 <span className="text-orange-500 font-bold">표준편차(σ) 괴리도</span>입니다. +2.0 초과 시 과매수, -2.0 미만 시 과매도 신호입니다.
          </p>
          <div className="my-auto flex items-center justify-center gap-3">
            <span className={`text-6xl font-black tracking-tighter tabular-nums ${getZScoreColor(zScoreValue)}`}>
              {zScoreValue > 0 ? '+' : ''}{zScoreValue}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
