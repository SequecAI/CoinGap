import React from 'react';
import CoinPricePanel from '../components/CoinPricePanel';
import {
  Zap,
  Gauge,
  BarChart3,
  PieChart,
  MoveUpRight,
  Crosshair
} from 'lucide-react';

function DashboardSignalPanel({ momentum5m, zScoreValue }) {
  // Z-Score: +3(Buy) -> 100, -3(Sell) -> 0
  const zScoreMapped = Math.max(0, Math.min(100, 50 + zScoreValue * (50/3)));
  
  // Momentum: 하락 시 매수(역추세) + Z-score 결합
  // AnalysisTab과 동일한 역추세 관점: 상승하면 매도압력 증가(점수 하락)
  const momMapped = Math.max(0, Math.min(100, 50 - momentum5m * 10));
  
  const score = (zScoreMapped + momMapped) / 2;

  const getLabel = (s) => {
    if (s >= 85) return { text: 'Strong Buy', color: '#10b981', bg: 'bg-emerald-500/10', tc: 'text-emerald-500', bc: 'border-emerald-500/30' };
    if (s >= 65) return { text: 'Buy', color: '#34d399', bg: 'bg-emerald-400/10', tc: 'text-emerald-400', bc: 'border-emerald-400/30' };
    if (s <= 15) return { text: 'Strong Sell', color: '#ef4444', bg: 'bg-red-500/10', tc: 'text-red-500', bc: 'border-red-500/30' };
    if (s <= 35) return { text: 'Sell', color: '#f87171', bg: 'bg-red-400/10', tc: 'text-red-400', bc: 'border-red-400/30' };
    return { text: 'Neutral', color: '#94a3b8', bg: 'bg-slate-400/10', tc: 'text-slate-400', bc: 'border-slate-400/30' };
  };
  const label = getLabel(score);

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col col-span-1">
      <div className="relative z-10 text-left font-sans flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Crosshair size={16} className="text-violet-500" />
          <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Divergence Score</h3>
        </div>
        <p className="text-xs text-slate-500 font-medium mb-3">
          Price Momentum과 Gap Z-Score를 50:50으로 결합한 <span className="text-violet-600 font-bold">단기 트레이딩 신호</span>입니다.
        </p>
        
        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black tabular-nums text-slate-900">{score.toFixed(0)}</span>
              <span className="text-sm text-slate-400 font-bold tabular-nums">/ 100</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-tighter ${label.bg} ${label.tc} ${label.bc}`}>
              {label.text}
            </div>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative">
            <div className="absolute inset-0 flex">
              <div className="w-[15%] bg-red-500"></div>
              <div className="w-[20%] bg-orange-400"></div>
              <div className="w-[30%] bg-slate-300"></div>
              <div className="w-[20%] bg-emerald-400"></div>
              <div className="w-[15%] bg-emerald-500"></div>
            </div>
            <div className="absolute top-0 h-full w-1.5 bg-slate-900 rounded-full transition-all duration-700 shadow-md border border-white"
              style={{ left: `${score}%`, transform: 'translateX(-50%)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardTab({
  momentum5m,
  zScoreValue,
  zLabel,
  volRatio,
  rsiStrength,
  dominance,
  disparity,
  altName,
  btc,
  alt,
  btcVol,
  altVol
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardSignalPanel momentum5m={momentum5m} zScoreValue={zScoreValue} />
          <CoinPricePanel coin={alt} coinName={altName} coinVol={altVol} />
        </div>
        {/* 1. Price Momentum (5분 기준) */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5">
          <div className="relative z-10 text-left font-sans">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-yellow-400" />
              <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Price Momentum</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-4">
              <span className={`text-5xl font-black tracking-tighter tabular-nums ${momentum5m >= 0 ? 'text-white' : 'text-blue-400'}`}>
                {momentum5m.toFixed(2)}%
              </span>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${momentum5m >= 0 ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                {momentum5m >= 0 ? '5M RISING' : '5M FALLING'}
              </div>
            </div>
            <p className="text-xs text-slate-400 font-medium leading-relaxed border-t border-white/10 pt-4 font-sans">
              {altName}의 <span className="text-blue-400 font-bold">최근 5분 가격 변동률</span>입니다. 시장의 즉각적인 에너지와 단기 방향성을 포착합니다.
            </p>
          </div>
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-yellow-400/5 rounded-full blur-[60px]"></div>
        </div>

        {/* 2. Gap Z-Score */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5">
          <div className="relative z-10 text-left font-sans">
            <div className="flex items-center gap-2 mb-2 text-left">
              <Gauge size={16} className="text-orange-400" />
              <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">Gap Z-Score</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-5xl font-black tracking-tighter tabular-nums">{zScoreValue}</span>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-tighter ${zLabel.bg} ${zLabel.color} border-white/10 font-sans`}>
                {zLabel.text}
              </div>
            </div>
            <p className="text-xs text-slate-400 font-medium leading-relaxed border-t border-white/10 pt-4 font-sans">
              비트코인 대비 <span className="text-orange-400 font-bold">상대적 가격 괴리 지수</span>입니다. +3.0 초과 시 알트 저평가 매수 신호, -3.0 미만 시 알트 고평가 매도 신호로 활용합니다.
            </p>
          </div>
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-orange-600/10 rounded-full blur-[60px]"></div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10 text-left font-sans">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-purple-500" />
              <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">Volume Intensity</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-4 text-left">
              <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900">{volRatio.toFixed(1)}%</span>
              <div className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-purple-50 text-purple-600 border-purple-100 font-sans">
                RELATIVE TO BTC
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 font-sans">
              BTC 거래대금 대비 {altName}의 비율입니다. 수치가 높을수록 <span className="text-purple-600 font-bold">시장 관심도</span>가 높음을 의미합니다.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10 text-left font-sans">
            <div className="flex items-center gap-2 mb-2 font-sans">
              <Zap size={16} className="text-amber-500" />
              <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">Relative Strength</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-4 text-left font-sans">
              <span className={`text-4xl font-black tracking-tighter uppercase ${rsiStrength === 'Stronger' ? 'text-amber-600' : 'text-slate-400'}`}>
                {rsiStrength}
              </span>
              <div className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-amber-50 text-amber-600 border-amber-100 font-sans">
                MOMENTUM
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-left font-sans">
              비트코인 대비 탄력성입니다. <span className="text-amber-600 font-bold">Stronger</span>는 알트 우세, <span className="text-slate-400 font-bold">Weaker</span>는 비트코인 위주 장세를 뜻합니다.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group font-sans">
          <div className="relative z-10 text-left font-sans">
            <div className="flex items-center gap-2 mb-2 font-sans">
              <PieChart size={16} className="text-orange-500" />
              <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">BTC Dominance</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-4 text-left font-sans">
              <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900">{dominance.toFixed(1)}%</span>
              <div className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-orange-50 text-orange-600 border-orange-100 font-sans">
                MARKET SHARE
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-left font-sans">
              전체 시장 중 <span className="text-orange-600 font-bold">BTC 비중</span>입니다. 점유율 하락 시 알트코인 반등 확률이 높아집니다.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10 text-left font-sans">
            <div className="flex items-center gap-2 mb-2 font-sans">
              <MoveUpRight size={16} className="text-emerald-500" />
              <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">MA20 Disparity</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-4 text-left font-sans">
              <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900">{disparity.toFixed(1)}%</span>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${disparity > 105 ? 'bg-red-50 text-red-600 border-red-100' : disparity < 95 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'} font-sans uppercase`}>
                {disparity > 105 ? 'Overheated' : disparity < 95 ? 'Oversold' : 'Stable'}
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-left font-sans">
              20일 평균가 대비 <span className="text-emerald-600 font-bold">괴리율</span>입니다. 100%를 기준으로 현재 가격의 과열도를 판단합니다.
            </p>
          </div>
        </div>
      </div>


    </>
  );
}
