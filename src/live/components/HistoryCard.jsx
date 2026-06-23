import React from 'react';
import {
  Calendar, Loader2, AlertTriangle, RefreshCw,
  TrendingUp, TrendingDown, Activity, Award,
} from 'lucide-react';

const PRESETS = [
  { key: 'today', label: '오늘' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
  { key: 'month', label: '이번 달' },
  { key: 'custom', label: '직접' },
];

const SYMBOL_LABEL = {
  'KRW-BTC': 'BTC', 'KRW-ETH': 'ETH', 'KRW-SOL': 'SOL', 'KRW-XRP': 'XRP',
  'KRW-DOGE': 'DOGE', 'KRW-ADA': 'ADA', 'KRW-TRX': 'TRX', 'KRW-AVAX': 'AVAX',
  'KRW-LINK': 'LINK', 'KRW-POL': 'POL',
};

export default function HistoryCard({
  preset, setPreset,
  customFrom, setCustomFrom, customTo, setCustomTo,
  range, trades, stats, loading, error, onReload,
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 bg-slate-50 text-slate-500 rounded-xl shrink-0">
            <Calendar size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-800">거래 내역</h2>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              {fmtDateOnly(range.fromMs)} ~ {fmtDateOnly(range.toMs)}
            </p>
          </div>
        </div>
        <button
          onClick={onReload}
          disabled={loading}
          title="다시 불러오기"
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 text-xs font-bold transition-colors shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="px-5 pt-4 pb-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              preset === p.key
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          <DateInput label="시작" value={customFrom} onChange={setCustomFrom} />
          <DateInput label="끝" value={customTo} onChange={setCustomTo} />
        </div>
      )}

      <div className="p-5 pt-1 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        <StatsRow stats={stats} />

        {loading && trades.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 size={18} className="animate-spin mr-2" />
            <span className="text-xs font-bold">불러오는 중…</span>
          </div>
        ) : trades.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium text-center py-6">
            이 기간 동안 거래가 없습니다.
          </p>
        ) : (
          <TradesList trades={trades} />
        )}
      </div>
    </section>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono outline-none focus:border-violet-400"
      />
    </label>
  );
}

function StatsRow({ stats }) {
  const positivePnl = (stats.totalPnlKrw || 0) >= 0;
  const positiveCum = (stats.cumReturnPct || 0) >= 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat icon={<Activity size={12} />} label="청산 거래" value={String(stats.count)} />
      <Stat
        icon={<TrendingUp size={12} />}
        label="누적 손익"
        value={fmtKrwSigned(stats.totalPnlKrw)}
        sub={stats.cumReturnPct != null ? `${positiveCum ? '+' : ''}${stats.cumReturnPct.toFixed(2)}% (복리)` : null}
        tone={positivePnl ? 'emerald' : 'rose'}
      />
      <Stat
        icon={<Award size={12} />}
        label="승률"
        value={stats.winRate != null ? `${stats.winRate.toFixed(1)}%` : '—'}
        sub={`${stats.wins}승 ${stats.losses}패`}
      />
      <Stat
        icon={<TrendingDown size={12} />}
        label="최대/최소 손익률"
        value={stats.bestPnlPct != null ? `${fmtPct(stats.bestPnlPct)} / ${fmtPct(stats.worstPnlPct)}` : '—'}
      />
    </div>
  );
}

function TradesList({ trades }) {
  // 최신순 표시
  const sorted = [...trades].reverse();
  return (
    <ul className="space-y-1 max-h-[480px] overflow-y-auto">
      {sorted.map((t, i) => (
        <TradeRow key={t.tradeId || `${t.time}-${i}`} trade={t} />
      ))}
    </ul>
  );
}

function TradeRow({ trade }) {
  // 라벨은 손익 부호 기준 (신호 종류는 hover 툴팁으로).
  const enter = trade.action === 'ENTER';
  const pnl = Number(trade.pnlPct);
  const profitable = !enter && isFinite(pnl) && pnl >= 0;
  const icon = enter ? <TrendingDown size={12} /> :
    profitable ? <TrendingUp size={12} /> : <TrendingDown size={12} />;
  const tone = enter
    ? 'text-blue-600 bg-blue-50 border-blue-100'
    : profitable
    ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
    : 'text-rose-600 bg-rose-50 border-rose-100';
  const label = enter ? '진입' : profitable ? '익절' : '손절';
  const tooltip = !enter
    ? (trade.action === 'EXIT_TP' ? '익절 신호로 청산' : trade.action === 'EXIT_SL' ? '손절 신호로 청산' : '')
    : '진입';
  return (
    <li className="flex items-center gap-2 text-[11px] font-medium tabular-nums px-2 py-1.5 rounded hover:bg-slate-50">
      <span title={tooltip} className={`px-1.5 py-0.5 rounded border ${tone} font-bold flex items-center gap-1 shrink-0`}>
        {icon}{label}
      </span>
      <span className="text-slate-500 shrink-0">{fmtDateTime(trade.time)}</span>
      <span className="text-slate-700 font-bold shrink-0">
        {SYMBOL_LABEL[trade.symbol] || trade.symbol || ''}
      </span>
      <span className="text-slate-500 shrink-0">{fmtKrw(trade.price)}</span>
      <span className="text-slate-400 truncate flex-1 hidden sm:inline">{trade.logicName || ''}</span>
      {isFinite(pnl) && !enter && (
        <span className={`font-bold shrink-0 ${pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {fmtPct(pnl)}
        </span>
      )}
      {trade.mode === 'paper' && (
        <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider shrink-0">모의</span>
      )}
    </li>
  );
}

function Stat({ icon, label, value, sub, tone = 'slate' }) {
  const color =
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'rose' ? 'text-rose-600' : 'text-slate-800';
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
        {icon}{label}
      </p>
      <p className={`text-sm font-black tabular-nums mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 font-medium tabular-nums">{sub}</p>}
    </div>
  );
}

function fmtKrw(v) {
  const n = Number(v) || 0;
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}
function fmtKrwSigned(v) {
  const n = Number(v) || 0;
  const r = Math.round(n);
  const sign = r > 0 ? '+' : r < 0 ? '−' : '';
  return `${sign}${Math.abs(r).toLocaleString('ko-KR')}원`;
}
function fmtPct(v) {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  // KST 환산이 비싸니 그냥 raw ISO에서 잘라쓰기
  return String(iso).slice(5, 16).replace('T', ' ');
}
function fmtDateOnly(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
