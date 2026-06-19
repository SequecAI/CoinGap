import React from 'react';
import { Sparkles, Loader2, AlertTriangle, Download, User } from 'lucide-react';

const SYMBOL_LABEL = {
  'KRW-BTC': '비트코인 (BTC)', 'KRW-ETH': '이더리움 (ETH)', 'KRW-SOL': '솔라나 (SOL)',
  'KRW-XRP': '리플 (XRP)', 'KRW-DOGE': '도지코인 (DOGE)', 'KRW-ADA': '에이다 (ADA)',
  'KRW-TRX': '트론 (TRX)', 'KRW-AVAX': '아발란체 (AVAX)',
  'KRW-LINK': '체인링크 (LINK)', 'KRW-POL': '폴리곤 (POL)',
};

/**
 * 공유 로직(SEED) 패널.
 * 카드별로 이름·작성자·설명·종목·간단 룰 요약 + "이 로직 가져오기" 버튼.
 * 가져오기를 누르면 현재 빌더 상태를 덮어쓴다 (Builder가 confirm 처리).
 */
export default function SharedLogicsPanel({ logics, loading, error, onApply }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-center text-slate-400">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-xs font-bold">공유 로직 불러오는 중…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-rose-100 p-4 shadow-sm flex items-start gap-2 text-rose-700">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <p className="text-xs font-medium">{error}</p>
      </div>
    );
  }
  if (!logics || logics.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shrink-0">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-slate-800">공유 로직</h2>
          <p className="text-[11px] text-slate-500 font-medium">
            이미 만들어진 로직으로 빠르게 시작해보세요. 가져온 뒤 자유롭게 수정할 수 있어요.
          </p>
        </div>
      </header>
      <ul className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {logics.map((l, i) => (
          <SharedCard key={l.id || i} logic={l} onApply={() => onApply?.(l)} />
        ))}
      </ul>
    </section>
  );
}

function SharedCard({ logic, onApply }) {
  const entryGroups = logic.entry?.groups?.length || 0;
  const tpGroups = logic.takeProfit?.groups?.length || 0;
  const slGroups = logic.stopLoss?.groups?.length || 0;
  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
      <div>
        <p className="text-sm font-black text-slate-900 leading-tight">{logic.name || '이름 없음'}</p>
        {logic.author && (
          <p className="text-[10px] text-slate-500 font-bold tabular-nums flex items-center gap-1 mt-0.5">
            <User size={10} /> {logic.author}
          </p>
        )}
      </div>

      {logic.description && (
        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
          {logic.description}
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-bold tabular-nums text-slate-600">
        <span>{SYMBOL_LABEL[logic.symbol] || logic.symbol || '—'}</span>
        <span className="text-slate-300">·</span>
        <span>투입 {logic.allocation_pct}%</span>
      </div>

      <div className="flex flex-wrap gap-1 text-[10px] font-bold">
        <Chip tone="blue">진입 {entryGroups}그룹</Chip>
        <Chip tone="emerald">익절 {tpGroups}그룹</Chip>
        <Chip tone="rose">손절 {slGroups}그룹</Chip>
      </div>

      <button
        onClick={onApply}
        className="mt-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors"
      >
        <Download size={13} />
        이 로직 가져오기
      </button>
    </li>
  );
}

function Chip({ tone, children }) {
  const cls =
    tone === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100' :
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
    tone === 'rose' ? 'bg-rose-50 text-rose-700 border-rose-100' :
    'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`px-1.5 py-0.5 rounded border ${cls}`}>{children}</span>
  );
}
