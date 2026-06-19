import React from 'react';
import {
  FolderOpen, Play, RefreshCw, Loader2, AlertTriangle, WifiOff,
} from 'lucide-react';

const SYMBOL_LABEL = {
  'KRW-BTC': 'BTC', 'KRW-ETH': 'ETH', 'KRW-SOL': 'SOL', 'KRW-XRP': 'XRP',
  'KRW-DOGE': 'DOGE', 'KRW-ADA': 'ADA', 'KRW-TRX': 'TRX', 'KRW-AVAX': 'AVAX',
  'KRW-LINK': 'LINK', 'KRW-POL': 'POL',
};

/**
 * 보관함 로직들을 카드로 표시하고, 각자 "시작" 버튼으로 PC를 원격 제어한다.
 * 원격 시작은 모의투자 모드로 고정 — 실거래는 PC에서 직접 약관·안전장치 입력 필요.
 */
export default function RemoteLocker({
  logics, loading, error, onReload,
  onStart, runningLogicId, busyLogicId, pcConnected,
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 bg-violet-50 text-violet-600 rounded-xl shrink-0">
            <FolderOpen size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-800">내 로직 보관함 (원격 제어)</h2>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              안전을 위해 원격은 모의투자만 · 한 번에 한 로직만 실행
            </p>
          </div>
        </div>
        <button
          onClick={onReload}
          disabled={loading}
          title="다시 불러오기"
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 text-xs font-bold transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {!pcConnected && (
        <div className="mx-5 mt-4 flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
          <WifiOff size={14} className="mt-0.5 shrink-0" />
          <p className="text-[11px] font-medium leading-relaxed">
            현재 PC에서 운영 중인 로직이 없습니다.
            아래에서 로직을 골라 "시작"을 누르면 PC 앱이 켜져 있는 경우 다음 폴링(최대 5초)에서 자동 실행됩니다.
          </p>
        </div>
      )}

      <div className="p-5">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 mb-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        {loading && logics.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 size={18} className="animate-spin mr-2" />
            <span className="text-xs font-bold">불러오는 중…</span>
          </div>
        ) : logics.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium text-center py-6">
            저장된 로직이 없어요. Lab에서 만들고 보관함에 저장하세요.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {logics.map((l) => (
              <LogicTile
                key={l.logicId}
                logic={l}
                isRunning={runningLogicId === l.logicId}
                otherRunning={runningLogicId && runningLogicId !== l.logicId}
                busy={busyLogicId === l.logicId}
                onStart={() => onStart?.(l)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LogicTile({ logic, isRunning, otherRunning, busy, onStart }) {
  const bt = logic.backtest;
  const symbol = SYMBOL_LABEL[logic.symbol] || logic.symbol || '—';
  return (
    <div className={`rounded-xl border ${isRunning ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-slate-50'} p-3 flex flex-col gap-2`}>
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-900 truncate">{logic.name || '이름 없음'}</p>
        <p className="text-[11px] text-slate-500 font-bold tabular-nums mt-0.5">
          {symbol}{logic.days ? ` · ${logic.days}일` : ''}
          {logic.allocation_pct != null && <> · 투입 {logic.allocation_pct}%</>}
        </p>
      </div>

      {bt && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-bold tabular-nums">
          <span className={(bt.total_return_pct ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
            {(bt.total_return_pct >= 0 ? '+' : '')}{bt.total_return_pct ?? '—'}%
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-600">승률 {bt.win_rate_pct ?? '—'}%</span>
        </div>
      )}

      {isRunning ? (
        <div className="mt-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold">
          <Loader2 size={12} className="animate-spin" />
          실행 중
        </div>
      ) : (
        <button
          onClick={onStart}
          disabled={otherRunning || busy}
          title={otherRunning ? '이미 다른 로직이 실행 중입니다' : 'PC에서 모의투자 모드로 자동 시작합니다. 실거래는 PC 앱에서 직접 시작하세요.'}
          className="mt-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {busy ? '명령 전송 중…' : otherRunning ? '다른 로직 실행 중' : '모의투자 시작'}
        </button>
      )}
    </div>
  );
}
