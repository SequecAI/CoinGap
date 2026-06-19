import React from 'react';
import {
  FolderOpen, Loader2, AlertTriangle, RefreshCw, Play,
  TrendingDown, TrendingUp, ShieldX, ExternalLink,
} from 'lucide-react';

const SYMBOL_LABEL = {
  'KRW-BTC': '비트코인 (BTC)', 'KRW-ETH': '이더리움 (ETH)', 'KRW-SOL': '솔라나 (SOL)',
  'KRW-XRP': '리플 (XRP)', 'KRW-DOGE': '도지코인 (DOGE)', 'KRW-ADA': '에이다 (ADA)',
  'KRW-TRX': '트론 (TRX)', 'KRW-AVAX': '아발란체 (AVAX)',
  'KRW-LINK': '체인링크 (LINK)', 'KRW-POL': '폴리곤 (POL)',
};

/**
 * 보관함 패널: 좌측 카드 리스트 + 우측 선택 상세.
 * 실행 버튼은 C5에서 활성화되므로 지금은 disabled + "다음 단계에서 활성화" 안내.
 */
export default function LogicsPanel({
  logics, selected, selectedId, setSelectedId,
  loading, error, onReload,
  onRun, engineRunning, runningLogicId,
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
            <FolderOpen size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-800">내 로직 보관함</h2>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              coingap 계정에서 동기화 · 총 {logics.length}개
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://coin-gap.vercel.app/lab"
            target="_blank"
            rel="noreferrer noopener"
            title="coingap 웹/모바일 Lab에서 로직 만들기·수정·삭제"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold transition-colors"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">Lab 열기</span>
          </a>
          <button
            onClick={onReload}
            disabled={loading}
            title="다시 불러오기"
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 text-xs font-bold transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {error && (
        <div className="m-5 flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}

      {loading && logics.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={18} className="animate-spin mr-2" />
          <span className="text-xs font-bold">불러오는 중…</span>
        </div>
      ) : logics.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
          <ul className="border-r border-slate-100 max-h-[480px] overflow-y-auto">
            {logics.map((l) => (
              <li key={l.logicId}>
                <button
                  onClick={() => setSelectedId(l.logicId)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${
                    selectedId === l.logicId ? 'bg-violet-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-black text-slate-800 truncate">
                    {l.name || '이름 없음'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium tabular-nums mt-0.5">
                    {SYMBOL_LABEL[l.symbol] || l.symbol || '—'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <LogicDetail
            logic={selected}
            onRun={onRun}
            engineRunning={engineRunning}
            runningLogicId={runningLogicId}
          />
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-xs text-slate-400 font-medium leading-relaxed">
        저장된 로직이 없습니다.<br />
        coingap 웹 또는 모바일 앱에서 Lab을 열어 로직을 만들고 저장하면<br />
        이 PC 앱에서 바로 가져올 수 있어요.
      </p>
      <a
        href="https://coin-gap.vercel.app/lab"
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1.5 mt-4 px-3 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold transition-colors"
      >
        <ExternalLink size={13} />
        coingap Lab 열기
      </a>
    </div>
  );
}

function LogicDetail({ logic, onRun, engineRunning, runningLogicId }) {
  if (!logic) {
    return (
      <div className="p-6 text-center text-slate-400 text-xs font-medium">
        좌측에서 로직을 선택하세요.
      </div>
    );
  }
  const isThisRunning = engineRunning && runningLogicId === logic.logicId;
  const otherRunning = engineRunning && !isThisRunning;
  const bt = logic.backtest;
  const days = logic.days;
  return (
    <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
      <div>
        <h3 className="text-base font-black text-slate-900 leading-tight">
          {logic.name || '이름 없음'}
        </h3>
        <p className="text-[11px] text-slate-500 font-medium tabular-nums mt-1">
          {SYMBOL_LABEL[logic.symbol] || logic.symbol || '—'}
          {days != null && <> · {days}일 백테스트</>}
          {logic.updatedAt && <> · {String(logic.updatedAt).slice(0, 10)}</>}
        </p>
      </div>

      {bt && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="총 수익률" value={fmtPct(bt.total_return_pct)} tone={bt.total_return_pct >= 0 ? 'emerald' : 'rose'} />
          <Stat label="승률" value={`${bt.win_rate_pct ?? '—'}%`} />
          <Stat label="MDD" value={`${bt.mdd_pct ?? '—'}%`} tone="rose" />
          <Stat label="총 거래수" value={String(bt.total_trades ?? '—')} />
        </div>
      )}

      <ParamRow params={logic} />

      <SectionPreview title="진입 조건" icon={<TrendingDown size={13} />} tone="blue"
        section={logic.entry} />
      <SectionPreview title="익절 조건" icon={<TrendingUp size={13} />} tone="emerald"
        section={logic.takeProfit} />
      <SectionPreview title="손절 조건" icon={<ShieldX size={13} />} tone="rose"
        section={logic.stopLoss} />

      <div className="pt-3 border-t border-slate-100">
        {isThisRunning ? (
          <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-50 text-violet-700 text-sm font-bold">
            <Play size={14} />
            이 로직이 모의투자로 실행 중
          </div>
        ) : (
          <button
            onClick={() => onRun?.(logic)}
            disabled={otherRunning}
            title={otherRunning ? '이미 다른 로직이 실행 중입니다. 먼저 중지하세요.' : '이 로직 실행'}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
          >
            <Play size={14} />
            {otherRunning ? '다른 로직 실행 중' : '이 로직 실행'}
          </button>
        )}
      </div>
    </div>
  );
}

function fmtPct(v) {
  if (typeof v !== 'number') return '—';
  return `${v >= 0 ? '+' : ''}${v}%`;
}

function Stat({ label, value, tone = 'slate' }) {
  const color =
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'rose' ? 'text-rose-600' : 'text-slate-800';
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-base font-black tabular-nums mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function ParamRow({ params }) {
  const rows = [
    ['투입 비율', params.allocation_pct, '%'],
    ['수수료', params.fee_pct, '%'],
    ['슬리피지', params.slippage_pct, '%'],
  ].filter(([, v]) => v != null);
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500">
      {rows.map(([k, v, suffix]) => (
        <span key={k} className="tabular-nums">
          {k} <span className="font-bold text-slate-700">{v}{suffix}</span>
        </span>
      ))}
    </div>
  );
}

function SectionPreview({ title, icon, tone, section }) {
  const groups = section?.groups || [];
  const toneClass =
    tone === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-700' :
    tone === 'emerald' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
    'bg-rose-50 border-rose-100 text-rose-700';
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`p-1 rounded-md ${toneClass}`}>{icon}</span>
        <h4 className="text-xs font-black text-slate-700">{title}</h4>
      </div>
      {groups.length === 0 ? (
        <p className="text-[11px] text-slate-400 font-medium pl-1">— 조건 없음</p>
      ) : (
        <div className="space-y-1.5">
          {groups.map((g, gi) => (
            <div key={gi}>
              {gi > 0 && (
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center my-1">
                  또는 (OR)
                </p>
              )}
              <div className={`rounded-lg ${toneClass.split(' ').slice(0, 2).join(' ')} px-3 py-2 space-y-0.5`}>
                {g.map((expr, ci) => (
                  <p key={ci} className="text-[11px] font-mono text-slate-700 leading-relaxed">
                    {ci > 0 && <span className="text-slate-400 font-bold mr-1.5">AND</span>}
                    {expr}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
