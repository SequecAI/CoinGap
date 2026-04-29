import React from 'react';
import { Zap, Activity, Gauge, Shield, Crosshair, TrendingUp } from 'lucide-react';

// ── SVG 바 차트 컴포넌트 ──
function VolumeBarChart({ candles }) {
  if (!candles || candles.length === 0) return <EmptyState text="데이터 로딩 중..." />;

  const volumes = candles.map(c => c.candle_acc_trade_volume);
  const maxVol = Math.max(...volumes);

  const chartW = 100; // viewBox 기준 퍼센트
  const chartH = 60;
  const barGap = 1;
  const barW = (chartW - barGap * (volumes.length - 1)) / volumes.length;

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH + 10}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {volumes.map((vol, i) => {
        const h = maxVol > 0 ? (vol / maxVol) * chartH : 0;
        const x = i * (barW + barGap);
        const y = chartH - h;
        const prevVol = i > 0 ? volumes[i - 1] : vol;
        const isUp = vol >= prevVol;

        return (
          <g key={i}>
            <rect
              x={x} y={y} width={barW} height={h}
              rx={0.8}
              fill={isUp ? 'rgba(168, 85, 247, 0.7)' : 'rgba(148, 163, 184, 0.4)'}
              className="transition-all duration-300"
            />
            {/* 최신 봉 하이라이트 */}
            {i === volumes.length - 1 && (
              <rect x={x} y={y} width={barW} height={h} rx={0.8}
                fill="rgba(168, 85, 247, 1)" />
            )}
          </g>
        );
      })}
      {/* 시간 라벨 (첫번째, 중간, 마지막) */}
      {[0, Math.floor(volumes.length / 2), volumes.length - 1].map(idx => {
        const c = candles[idx];
        if (!c) return null;
        const time = c.candle_date_time_kst?.split('T')[1]?.substring(0, 5) || '';
        const x = idx * (barW + barGap) + barW / 2;
        return (
          <text key={idx} x={x} y={chartH + 8} textAnchor="middle"
            fontSize="3" fill="#94a3b8" fontWeight="600">{time}</text>
        );
      })}
    </svg>
  );
}

// ── 체결 강도 게이지 ──
function TradeIntensityGauge({ candles }) {
  if (!candles || candles.length === 0) return <EmptyState text="데이터 로딩 중..." />;

  // 5분봉 캔들에서 매수/매도 압력 추정: 양봉(종가>시가) = 매수 우위, 음봉 = 매도 우위
  let buyCandles = 0;
  let sellCandles = 0;
  let buyVolume = 0;
  let sellVolume = 0;

  candles.forEach(c => {
    if (c.trade_price >= c.opening_price) {
      buyCandles++;
      buyVolume += c.candle_acc_trade_volume;
    } else {
      sellCandles++;
      sellVolume += c.candle_acc_trade_volume;
    }
  });

  const totalVol = buyVolume + sellVolume;
  if (totalVol === 0) return <EmptyState text="데이터 없음" />;

  const bidRatio = (buyVolume / totalVol) * 100;
  const askRatio = (sellVolume / totalVol) * 100;
  const dominant = bidRatio >= askRatio ? 'BUY' : 'SELL';
  const candleRatio = `${buyCandles}/${candles.length}`;

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* 메인 비율 숫자 */}
      <div className="flex items-center justify-between">
        <div className="text-left">
          <p className="text-[10px] font-black text-red-400 uppercase tracking-tighter mb-0.5">매수 압력 (Buy)</p>
          <p className="text-3xl font-black tabular-nums text-red-500">{bidRatio.toFixed(1)}%</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-tighter
          ${dominant === 'BUY'
            ? 'bg-red-500/10 text-red-500 border-red-500/30'
            : 'bg-blue-500/10 text-blue-500 border-blue-500/30'}`}>
          {dominant} Dominant
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-tighter mb-0.5">매도 압력 (Sell)</p>
          <p className="text-3xl font-black tabular-nums text-blue-500">{askRatio.toFixed(1)}%</p>
        </div>
      </div>

      {/* 비율 바 */}
      <div className="w-full h-5 rounded-full bg-slate-100 overflow-hidden flex">
        <div
          className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-l-full transition-all duration-700"
          style={{ width: `${bidRatio}%` }}
        />
        <div
          className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-r-full transition-all duration-700"
          style={{ width: `${askRatio}%` }}
        />
      </div>

      {/* 봉 비율 및 거래량 수치 */}
      <div className="flex justify-between text-[10px] text-slate-400 font-bold tabular-nums">
        <span>양봉 {candleRatio}</span>
        <span>거래량 기준 추정</span>
      </div>
    </div>
  );
}

// ── BTC vs ALT 수익률 비교 ──
function RateComparisonChart({ btcRate, altRate, altName }) {
  const maxAbs = Math.max(Math.abs(btcRate), Math.abs(altRate), 0.1);
  const scale = 40; // viewBox 중앙 기준 최대 너비

  const btcW = (Math.abs(btcRate) / maxAbs) * scale;
  const altW = (Math.abs(altRate) / maxAbs) * scale;

  const centerX = 50;
  const barH = 8;

  return (
    <div className="flex flex-col gap-1 w-full">
      <svg viewBox="0 0 100 40" className="w-full max-h-[80px]" preserveAspectRatio="xMidYMid meet">
        {/* 중앙선 */}
        <line x1={centerX} y1={2} x2={centerX} y2={38} stroke="#e2e8f0" strokeWidth="0.3" strokeDasharray="1,1" />

        {/* BTC 바 */}
        <rect
          x={btcRate >= 0 ? centerX : centerX - btcW}
          y={8} width={btcW} height={barH} rx={1.5}
          fill={btcRate >= 0 ? '#ef4444' : '#3b82f6'}
          opacity={0.8}
        />
        <text x={3} y={14} fontSize="3.5" fill="#94a3b8" fontWeight="800">BTC</text>
        <text x={btcRate >= 0 ? centerX + btcW + 2 : centerX - btcW - 2}
          y={14} fontSize="3" fill={btcRate >= 0 ? '#ef4444' : '#3b82f6'} fontWeight="800"
          textAnchor={btcRate >= 0 ? 'start' : 'end'}>
          {btcRate >= 0 ? '+' : ''}{btcRate.toFixed(2)}%
        </text>

        {/* ALT 바 */}
        <rect
          x={altRate >= 0 ? centerX : centerX - altW}
          y={24} width={altW} height={barH} rx={1.5}
          fill={altRate >= 0 ? '#ef4444' : '#3b82f6'}
          opacity={0.8}
        />
        <text x={3} y={30} fontSize="3.5" fill="#94a3b8" fontWeight="800">{altName}</text>
        <text x={altRate >= 0 ? centerX + altW + 2 : centerX - altW - 2}
          y={30} fontSize="3" fill={altRate >= 0 ? '#ef4444' : '#3b82f6'} fontWeight="800"
          textAnchor={altRate >= 0 ? 'start' : 'end'}>
          {altRate >= 0 ? '+' : ''}{altRate.toFixed(2)}%
        </text>
      </svg>

      {/* 갭 수치 */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">GAP</span>
        <span className={`text-lg font-black tabular-nums ${(btcRate - altRate) >= 0 ? 'text-orange-500' : 'text-indigo-500'}`}>
          {(btcRate - altRate) >= 0 ? '+' : ''}{(btcRate - altRate).toFixed(2)}%p
        </span>
      </div>
    </div>
  );
}

// ── 모멘텀 라인 차트 ──
function MomentumLineChart({ candles }) {
  if (!candles || candles.length < 2) return <EmptyState text="데이터 로딩 중..." />;

  // 각 봉의 시가 대비 변동률
  const rates = candles.map(c => ((c.trade_price / c.opening_price) - 1) * 100);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const range = maxRate - minRate || 1;

  const padX = 5;
  const padTop = 10;
  const padBottom = 5;
  const chartW = 110;
  const chartH = 50;
  const drawW = chartW - padX * 2;
  const drawH = chartH - padTop - padBottom;

  const points = rates.map((r, i) => {
    const x = padX + (i / (rates.length - 1)) * drawW;
    const y = padTop + (1 - (r - minRate) / range) * drawH;
    return { x, y, rate: r };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${chartH - padBottom} L${points[0].x},${chartH - padBottom} Z`;

  // 0% 기준선 위치
  const zeroY = minRate < 0 && maxRate > 0
    ? padTop + (1 - (0 - minRate) / range) * drawH
    : null;

  const lastPoint = points[points.length - 1];
  const lastRate = rates[rates.length - 1];

  // 최신값 라벨 위치 보정: 상단 밖으로 나가지 않도록
  const labelY = Math.max(lastPoint.y - 4, 4);
  // 우측 밖으로 나가지 않도록 textAnchor 조정
  const labelAnchor = lastPoint.x > chartW - 15 ? 'end' : 'start';
  const labelX = lastPoint.x > chartW - 15 ? lastPoint.x - 2 : lastPoint.x + 2;

  return (
    <div className="flex flex-col gap-1 w-full">
      <svg viewBox={`0 0 ${chartW} ${chartH + 16}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* 0% 기준선 */}
        {zeroY !== null && (
          <line x1={padX} y1={zeroY} x2={chartW - padX} y2={zeroY}
            stroke="#94a3b8" strokeWidth="0.3" strokeDasharray="2,2" />
        )}

        {/* 영역 채우기 */}
        <path d={areaPath}
          fill={lastRate >= 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)'} />

        {/* 라인 */}
        <path d={linePath} fill="none"
          stroke={lastRate >= 0 ? '#ef4444' : '#3b82f6'}
          strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />

        {/* 각 데이터 포인트 */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 2 : 1}
            fill={i === points.length - 1 ? (lastRate >= 0 ? '#ef4444' : '#3b82f6') : '#cbd5e1'}
          />
        ))}

        {/* 최신값 라벨 */}
        <text x={labelX} y={labelY}
          fontSize="3.5" fontWeight="800"
          fill={lastRate >= 0 ? '#ef4444' : '#3b82f6'}
          textAnchor={labelAnchor}>
          {lastRate >= 0 ? '+' : ''}{lastRate.toFixed(2)}%
        </text>

        {/* 시간 라벨 */}
        {[0, Math.floor(candles.length / 2), candles.length - 1].map(idx => {
          const c = candles[idx];
          if (!c) return null;
          const time = c.candle_date_time_kst?.split('T')[1]?.substring(0, 5) || '';
          const anchor = idx === 0 ? 'start' : idx === candles.length - 1 ? 'end' : 'middle';
          return (
            <text key={idx} x={points[idx].x} y={chartH + 3} textAnchor={anchor}
              fontSize="3" fill="#94a3b8" fontWeight="600">{time}</text>
          );
        })}
      </svg>

      {/* 범위 표시 */}
      <div className="flex justify-between text-[10px] text-slate-400 font-bold tabular-nums">
        <span>Low: {minRate.toFixed(2)}%</span>
        <span>High: {maxRate >= 0 ? '+' : ''}{maxRate.toFixed(2)}%</span>
      </div>
    </div>
  );
}

// ── RSI-14 계산 및 게이지 ──
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

function RSIGauge({ rsi }) {
  if (rsi === null) return <EmptyState text="데이터 부족" />;

  const getZone = (v) => {
    if (v >= 70) return { label: 'Overbought', color: '#ef4444', bgColor: 'bg-red-500/10', textColor: 'text-red-500', borderColor: 'border-red-500/30' };
    if (v >= 60) return { label: 'Bullish', color: '#f97316', bgColor: 'bg-orange-500/10', textColor: 'text-orange-500', borderColor: 'border-orange-500/30' };
    if (v <= 30) return { label: 'Oversold', color: '#3b82f6', bgColor: 'bg-blue-500/10', textColor: 'text-blue-500', borderColor: 'border-blue-500/30' };
    if (v <= 40) return { label: 'Bearish', color: '#6366f1', bgColor: 'bg-indigo-500/10', textColor: 'text-indigo-500', borderColor: 'border-indigo-500/30' };
    return { label: 'Neutral', color: '#94a3b8', bgColor: 'bg-slate-400/10', textColor: 'text-slate-400', borderColor: 'border-slate-400/30' };
  };
  const zone = getZone(rsi);

  // 반원 게이지 SVG
  const angle = (rsi / 100) * 180;
  const r = 40;
  const cx = 50, cy = 45;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const needleX = cx + r * Math.cos(toRad(180 - angle));
  const needleY = cy - r * Math.sin(toRad(180 - angle));

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <svg viewBox="0 0 100 55" className="w-full max-w-[180px]">
        {/* 배경 호 - 과매도(파랑) → 중립(회색) → 과매수(빨강) */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
        {/* 과매도 구간 (0-30) */}
        <path d={`M ${cx + r * Math.cos(toRad(180))} ${cy - r * Math.sin(toRad(180))} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(toRad(180 - 54))} ${cy - r * Math.sin(toRad(180 - 54))}`}
          fill="none" stroke="#3b82f6" strokeWidth="10" strokeLinecap="round" opacity="0.7" />
        {/* 과매수 구간 (70-100) */}
        <path d={`M ${cx + r * Math.cos(toRad(180 - 126))} ${cy - r * Math.sin(toRad(180 - 126))} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(toRad(0))} ${cy - r * Math.sin(toRad(0))}`}
          fill="none" stroke="#ef4444" strokeWidth="10" strokeLinecap="round" opacity="0.7" />
        {/* 바늘 */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY}
          stroke={zone.color} strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3" fill={zone.color} />
        {/* 수치 라벨 */}
        <text x="10" y={cy + 8} fontSize="4" fill="#94a3b8" fontWeight="700">0</text>
        <text x={cx} y="6" fontSize="4" fill="#94a3b8" fontWeight="700" textAnchor="middle">50</text>
        <text x="88" y={cy + 8} fontSize="4" fill="#94a3b8" fontWeight="700">100</text>
      </svg>

      <div className="flex items-center gap-3">
        <span className="text-4xl font-black tabular-nums text-slate-900">
          {rsi.toFixed(1)}
        </span>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-tighter ${zone.bgColor} ${zone.textColor} ${zone.borderColor}`}>
          {zone.label}
        </div>
      </div>
    </div>
  );
}

// ── 볼린저 밴드 ──
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

function BollingerBandPanel({ bb, altName }) {
  if (!bb) return <EmptyState text="데이터 부족 (20일봉 필요)" />;

  const { upper, lower, ma, current, percentB, bandwidth } = bb;

  const getPosition = (pB) => {
    if (pB > 1) return { label: '상단 이탈', color: 'text-red-500', desc: '과매수 극단' };
    if (pB > 0.8) return { label: '상단 근접', color: 'text-red-400', desc: '매수 과열 주의' };
    if (pB < 0) return { label: '하단 이탈', color: 'text-blue-500', desc: '과매도 극단' };
    if (pB < 0.2) return { label: '하단 근접', color: 'text-blue-400', desc: '반등 가능성' };
    return { label: '밴드 내부', color: 'text-slate-400', desc: '안정 구간' };
  };
  const pos = getPosition(percentB);

  // 밴드 시각화: 수평 바
  const barWidth = 100;
  const clampedPB = Math.max(-0.15, Math.min(1.15, percentB));
  const dotX = ((clampedPB + 0.15) / 1.3) * barWidth;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* %B 수치 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter mb-0.5">%B (Band Position)</p>
          <p className={`text-xl font-black tabular-nums ${pos.color}`}>{(percentB * 100).toFixed(1)}%</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Bandwidth</p>
          <p className="text-lg font-black tabular-nums text-slate-400">{bandwidth.toFixed(1)}%</p>
        </div>
      </div>

      {/* 밴드 바 시각화 */}
      <div className="relative">
        <svg viewBox={`0 0 ${barWidth} 20`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* 밴드 영역 */}
          <rect x={0} y={6} width={barWidth} height={8} rx={4} fill="#1e293b" />
          {/* 과매도 구간 (0-20%) */}
          <rect x={((0.15) / 1.3) * barWidth} y={6} width={(0.2 / 1.3) * barWidth} height={8} rx={0} fill="rgba(59, 130, 246, 0.15)" />
          {/* 과매수 구간 (80-100%) */}
          <rect x={((0.95) / 1.3) * barWidth} y={6} width={(0.2 / 1.3) * barWidth} height={8} rx={0} fill="rgba(239, 68, 68, 0.15)" />

          {/* MA20 중심선 */}
          <line x1={((0.65) / 1.3) * barWidth} y1={4} x2={((0.65) / 1.3) * barWidth} y2={16}
            stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="1,1" />

          {/* 현재 위치 점 */}
          <circle cx={dotX} cy={10} r={3.5}
            fill={percentB > 0.8 ? '#ef4444' : percentB < 0.2 ? '#3b82f6' : '#10b981'}
            stroke="white" strokeWidth="1" />

          {/* 라벨 */}
          <text x={((0.15) / 1.3) * barWidth} y={19} fontSize="2.5" fill="#3b82f6" fontWeight="700" textAnchor="middle">하단</text>
          <text x={((0.65) / 1.3) * barWidth} y={19} fontSize="2.5" fill="#94a3b8" fontWeight="700" textAnchor="middle">MA20</text>
          <text x={((1.15) / 1.3) * barWidth} y={19} fontSize="2.5" fill="#ef4444" fontWeight="700" textAnchor="middle">상단</text>
        </svg>
      </div>

      {/* 밴드 수치 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">Lower</p>
          <p className="text-xs font-bold tabular-nums text-slate-400">{lower.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">MA20</p>
          <p className="text-xs font-bold tabular-nums text-slate-300">{ma.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <p className="text-[9px] font-black text-red-400 uppercase tracking-tighter">Upper</p>
          <p className="text-xs font-bold tabular-nums text-slate-400">{upper.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
      </div>


    </div>
  );
}

// ── 종합 시그널 스코어 ──
function calcSignalScore(rsi, bb, momentum5m, candles) {
  let score = 50; // 기본 중립

  // RSI 기여 (0-100 → 반전: 낮을수록 매수 기회)
  if (rsi !== null) {
    const rsiSignal = 100 - rsi; // RSI 30 → 70점, RSI 70 → 30점
    score += (rsiSignal - 50) * 0.3;
  }

  // 볼린저 %B 기여 (낮을수록 매수 기회)
  if (bb) {
    const bbSignal = (1 - bb.percentB) * 100;
    score += (bbSignal - 50) * 0.3;
  }

  // 모멘텀 기여 (하락 = 매수 기회)
  if (momentum5m !== undefined) {
    const momSignal = Math.max(0, Math.min(100, 50 - momentum5m * 10));
    score += (momSignal - 50) * 0.2;
  }

  // 체결강도 기여
  if (candles && candles.length > 0) {
    let buyVol = 0, totalVol = 0;
    candles.forEach(c => {
      totalVol += c.candle_acc_trade_volume;
      if (c.trade_price >= c.opening_price) buyVol += c.candle_acc_trade_volume;
    });
    const buyRatio = totalVol > 0 ? (buyVol / totalVol) * 100 : 50;
    score += (buyRatio - 50) * 0.2;
  }

  return { score: Math.max(0, Math.min(100, score)) };
}

function SignalScorePanel({ score }) {
  const getLabel = (s) => {
    if (s >= 70) return { text: 'Strong Buy', color: '#10b981', bg: 'bg-emerald-500/10', tc: 'text-emerald-500', bc: 'border-emerald-500/30' };
    if (s >= 55) return { text: 'Buy', color: '#34d399', bg: 'bg-emerald-400/10', tc: 'text-emerald-400', bc: 'border-emerald-400/30' };
    if (s <= 30) return { text: 'Strong Sell', color: '#ef4444', bg: 'bg-red-500/10', tc: 'text-red-500', bc: 'border-red-500/30' };
    if (s <= 45) return { text: 'Sell', color: '#f87171', bg: 'bg-red-400/10', tc: 'text-red-400', bc: 'border-red-400/30' };
    return { text: 'Neutral', color: '#94a3b8', bg: 'bg-slate-400/10', tc: 'text-slate-400', bc: 'border-slate-400/30' };
  };
  const label = getLabel(score);

  // 수평 바 게이지
  const barPos = Math.max(0, Math.min(100, score));

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* 스코어 + 라벨 */}
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black tabular-nums text-slate-900">{score.toFixed(0)}</span>
          <span className="text-sm text-slate-400 font-bold tabular-nums">/ 100</span>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-tighter ${label.bg} ${label.tc} ${label.bc}`}>
          {label.text}
        </div>
      </div>

      {/* 바 게이지 */}
      <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative">
        <div className="absolute inset-0 flex">
          <div className="w-[30%] bg-red-500"></div>
          <div className="w-[15%] bg-orange-400"></div>
          <div className="w-[10%] bg-slate-300"></div>
          <div className="w-[15%] bg-emerald-400"></div>
          <div className="w-[30%] bg-emerald-500"></div>
        </div>
        <div className="absolute top-0 h-full w-1.5 bg-slate-900 rounded-full transition-all duration-700 shadow-md border border-white"
          style={{ left: `${barPos}%`, transform: 'translateX(-50%)' }} />
      </div>

    </div>
  );
}



// ── 빈 상태 ──
function EmptyState({ text }) {
  return (
    <div className="flex items-center justify-center h-32 text-slate-400 text-sm font-bold">
      {text}
    </div>
  );
}

// ── 메인 AnalysisTab ──
export default function AnalysisTab({
  candles5m,
  dayCandles,
  btcRate,
  altRate,
  altName,
  alt,
  momentum5m
}) {
  const rsi = calcRSI(dayCandles);
  const bb = calcBollinger(dayCandles);
  const signal = calcSignalScore(rsi, bb, momentum5m, candles5m);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">

      {/* 1. 종합 시그널 (전체 너비) */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col col-span-1 md:col-span-2">
        <div className="relative z-10 text-left font-sans flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Crosshair size={16} className="text-violet-500" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Signal Score</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-3">
            RSI, 볼린저, 모멘텀, 체결강도를 종합한 <span className="text-violet-600 font-bold">매수/매도 신호</span>입니다.
          </p>
          <SignalScorePanel score={signal.score} />
        </div>
      </div>

      {/* 2. 볼린저 밴드 (좌상단) */}
      <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden border border-white/5 flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className="text-emerald-400" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Bollinger Bands</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-2">
            {altName}의 <span className="text-emerald-400 font-bold">20일 볼린저 밴드</span> 내 현재 위치입니다. 밴드 이탈 시 극단 신호입니다.
          </p>
          <div className="mt-auto">
            <BollingerBandPanel bb={bb} altName={altName} />
          </div>
        </div>
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-600/10 rounded-full blur-[60px]"></div>
      </div>

      {/* 3. 5분 모멘텀 히스토리 (우상단) */}
      <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden border border-white/5 flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-cyan-400" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Momentum Trail</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-2">
            최근 1시간의 <span className="text-cyan-400 font-bold">5분봉 모멘텀</span> 추세입니다. 각 봉의 시가 대비 변동률을 추적합니다.
          </p>
          <div className="h-36 mt-auto">
            <MomentumLineChart candles={candles5m} />
          </div>
        </div>
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-400/5 rounded-full blur-[60px]"></div>
      </div>

      {/* 4. 체결 강도 (좌하단) */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col">
        <div className="relative z-10 text-left font-sans flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-amber-500" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Trade Intensity</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-3">
            최근 12개 5분봉의 <span className="text-red-500 font-bold">매수</span> vs <span className="text-blue-500 font-bold">매도</span> 압력 추정입니다.
          </p>
          <div className="mt-auto">
            <TradeIntensityGauge candles={candles5m} />
          </div>
        </div>
      </div>

      {/* 5. RSI-14 (우하단) */}
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

    </div>
  );
}
