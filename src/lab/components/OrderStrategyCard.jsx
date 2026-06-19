import React from 'react';
import { Zap, ListOrdered, TrendingDown, TrendingUp, ShieldX } from 'lucide-react';
import { ORDER_STRATEGIES, ORDERBOOK_RANKS, TIMEOUT_OPTIONS } from '../constants.js';

/**
 * 실거래 주문 방식 카드 — 진입/익절/손절 섹션별로 분리.
 *
 * 합리적 기본값:
 *  · 진입·익절 = 지정가(limit_best) — 좋은 가격이 우선
 *  · 손절 = 시장가(market) — 즉시 빠져나가는 안전성이 우선
 *
 * 백테스트는 종가 체결 가정이라 이 값과 무관. PC 엔진의 실거래 시점에만 영향.
 */
export default function OrderStrategyCard({
  entryOrder, takeProfitOrder, stopLossOrder, onChange,
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
          <ListOrdered size={16} />
        </div>
        <h3 className="text-sm font-black text-slate-800">실거래 주문 방식</h3>
      </div>
      <p className="text-[11px] font-medium text-slate-500 mt-0.5 mb-4 leading-relaxed">
        신호 발생 시 PC 앱이 어떤 방식으로 주문할지 섹션별로 정합니다.
        <strong className="text-slate-700"> 백테스트 결과에는 영향이 없습니다.</strong>
      </p>

      <div className="space-y-4">
        <StrategyGroup
          label="진입 (매수)"
          side="bid"
          icon={<TrendingDown size={13} />}
          tone="blue"
          value={entryOrder?.strategy || 'limit_best'}
          rank={entryOrder?.orderbook_rank || 1}
          timeout={entryOrder?.timeout_sec || 60}
          onChange={(strategy) => onChange('entry', { ...entryOrder, strategy })}
          onRankChange={(orderbook_rank) => onChange('entry', { ...entryOrder, orderbook_rank })}
          onTimeoutChange={(timeout_sec) => onChange('entry', { ...entryOrder, timeout_sec })}
        />
        <StrategyGroup
          label="익절 (매도)"
          side="ask"
          icon={<TrendingUp size={13} />}
          tone="emerald"
          value={takeProfitOrder?.strategy || 'limit_best'}
          rank={takeProfitOrder?.orderbook_rank || 1}
          timeout={takeProfitOrder?.timeout_sec || 60}
          onChange={(strategy) => onChange('takeProfit', { ...takeProfitOrder, strategy })}
          onRankChange={(orderbook_rank) => onChange('takeProfit', { ...takeProfitOrder, orderbook_rank })}
          onTimeoutChange={(timeout_sec) => onChange('takeProfit', { ...takeProfitOrder, timeout_sec })}
        />
        <StrategyGroup
          label="손절 (매도)"
          side="ask"
          icon={<ShieldX size={13} />}
          tone="rose"
          value={stopLossOrder?.strategy || 'market'}
          rank={stopLossOrder?.orderbook_rank || 1}
          timeout={stopLossOrder?.timeout_sec || 4}
          onChange={(strategy) => onChange('stopLoss', { ...stopLossOrder, strategy })}
          onRankChange={(orderbook_rank) => onChange('stopLoss', { ...stopLossOrder, orderbook_rank })}
          onTimeoutChange={(timeout_sec) => onChange('stopLoss', { ...stopLossOrder, timeout_sec })}
        />
      </div>
    </div>
  );
}

function StrategyGroup({ label, side, icon, tone, value, rank, timeout, onChange, onRankChange, onTimeoutChange }) {
  const toneText =
    tone === 'blue' ? 'text-blue-700' :
    tone === 'emerald' ? 'text-emerald-700' :
    tone === 'rose' ? 'text-rose-700' :
    'text-slate-700';
  const toneBg =
    tone === 'blue' ? 'bg-blue-50' :
    tone === 'emerald' ? 'bg-emerald-50' :
    tone === 'rose' ? 'bg-rose-50' :
    'bg-slate-50';
  return (
    <div>
      <div className={`flex items-center gap-1.5 mb-2 ${toneText}`}>
        <span className={`p-1 rounded-md ${toneBg}`}>{icon}</span>
        <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ORDER_STRATEGIES.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`text-left p-3 rounded-xl border-2 transition-colors ${
                active
                  ? 'border-violet-400 bg-violet-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {opt.value === 'market' ? (
                  <Zap size={12} className={active ? 'text-violet-600' : 'text-slate-400'} />
                ) : (
                  <ListOrdered size={12} className={active ? 'text-violet-600' : 'text-slate-400'} />
                )}
                <p className={`text-xs font-black ${active ? 'text-violet-700' : 'text-slate-700'}`}>
                  {opt.label}
                </p>
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1 leading-relaxed">
                {opt.desc}
              </p>
            </button>
          );
        })}
      </div>

      {value === 'limit_best' && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">
              {side === 'bid' ? '매수' : '매도'} 호가
            </label>
            <select
              value={rank || 1}
              onChange={(e) => onRankChange?.(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold tabular-nums outline-none focus:border-violet-400"
            >
              {ORDERBOOK_RANKS.map((n) => (
                <option key={n} value={n}>{n}호가</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">
              대기 시간
            </label>
            <select
              value={timeout || 60}
              onChange={(e) => onTimeoutChange?.(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold tabular-nums outline-none focus:border-violet-400"
            >
              {TIMEOUT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}초</option>
              ))}
            </select>
          </div>
          <p className="basis-full text-[10px] text-slate-400 font-medium">
            {side === 'bid'
              ? '미체결 시 자동 취소하고 다음 신호 대기'
              : '미체결 시 자동 취소 + 시장가로 강제 청산'}
          </p>
        </div>
      )}
    </div>
  );
}
