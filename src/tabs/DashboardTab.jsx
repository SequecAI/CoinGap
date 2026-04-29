import React from 'react';
import {
  Zap,
  Gauge,
  BarChart3,
  PieChart,
  MoveUpRight
} from 'lucide-react';

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

      {/* 상세 가격 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left font-sans">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-left">
          <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest font-sans">Bitcoin (BTC)</p>
          <p className="text-3xl font-black mb-1 tracking-tight tabular-nums font-sans">{btc?.trade_price.toLocaleString()} KRW</p>
          <div className="flex items-center justify-between font-sans">
            <div className={`flex items-center gap-1 font-bold ${btc?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>
              <span>{(btc?.signed_change_rate * 100).toFixed(2)}%</span>
            </div>
            <span className="text-[10px] text-slate-400 font-bold tabular-nums font-sans">Vol: {(btcVol / 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}억</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-left">
          <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest font-sans">{altName}</p>
          <p className="text-3xl font-black mb-1 tracking-tight tabular-nums font-sans">{alt?.trade_price.toLocaleString()} KRW</p>
          <div className="flex items-center justify-between font-sans">
            <div className={`flex items-center gap-1 font-bold ${alt?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>
              <span>{(alt?.signed_change_rate * 100).toFixed(2)}%</span>
            </div>
            <span className="text-[10px] text-slate-400 font-bold tabular-nums font-sans">Vol: {(altVol / 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}억</span>
          </div>
        </div>
      </div>
    </>
  );
}
