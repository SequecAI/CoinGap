import React, { useEffect, useState } from 'react';
import {
  Bot, ShieldAlert, ShieldCheck, Wallet, Activity, Clock,
  TrendingUp, TrendingDown, AlertTriangle, WifiOff, Square, Loader2,
} from 'lucide-react';

const SYMBOL_LABEL = {
  'KRW-BTC': 'BTC', 'KRW-ETH': 'ETH', 'KRW-SOL': 'SOL', 'KRW-XRP': 'XRP',
  'KRW-DOGE': 'DOGE', 'KRW-ADA': 'ADA', 'KRW-TRX': 'TRX', 'KRW-AVAX': 'AVAX',
  'KRW-LINK': 'LINK', 'KRW-POL': 'POL',
};

/**
 * PC 앱이 push한 운영 상태를 read-only로 표시.
 * desktop의 EngineCard와 비슷하지만 중지 버튼 등 컨트롤은 없다.
 *
 * 마지막 push 시각이 60초 넘으면 "연결 끊김" 경고 (PC가 종료되었거나 네트워크 단절).
 */
export default function RunCard({ state, onStop, stopBusy }) {
  const isLive = state.mode === 'live';
  const positive = (state.returnPct || 0) >= 0;
  const stale = isStale(state.updatedAt);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 ${stale ? 'bg-slate-200 text-slate-500' : isLive ? 'bg-rose-600 text-white animate-pulse' : 'bg-violet-600 text-white animate-pulse'}`}>
            <Bot size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-800 truncate">{state.logicName || '이름 없음'}</h2>
            <p className="text-[11px] text-slate-500 font-medium tabular-nums truncate">
              {SYMBOL_LABEL[state.symbol] || state.symbol}
              {' · '}{state.mode === 'live' ? '실거래' : '모의투자'}
              {' · '}<UpdatedAgo iso={state.updatedAt} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
            isLive ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
          }`}>
            <ShieldAlert size={11} />
            {isLive ? '실거래' : '모의투자'}
          </div>
          {onStop && (
            <button
              onClick={onStop}
              disabled={stopBusy}
              title="PC 엔진 원격 중지"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-bold transition-colors"
            >
              {stopBusy ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
              중지
            </button>
          )}
        </div>
      </header>

      <div className="p-5 space-y-4">
        {stale && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800">
            <WifiOff size={14} className="mt-0.5 shrink-0" />
            <p className="text-xs font-medium leading-relaxed">
              PC 앱과 연결이 끊겼습니다. 마지막 업데이트 이후 1분 이상 지났습니다 —
              PC가 꺼졌거나 네트워크 단절일 수 있습니다.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat icon={<Wallet size={12} />} label="평가 자산" value={fmtKrw(state.equity)} />
          <Stat
            icon={<TrendingUp size={12} />}
            label="수익률"
            value={fmtPct(state.returnPct)}
            tone={positive ? 'emerald' : 'rose'}
          />
          <Stat icon={<Wallet size={12} />} label="현금" value={fmtKrw(state.cash)} />
          <Stat icon={<Activity size={12} />} label="거래수" value={String(state.tradeCount || 0)} />
        </div>

        {state.position ? (
          <PositionBlock position={state.position} lastEval={state.lastEval} />
        ) : (
          <p className="text-[11px] text-slate-500 font-medium px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
            현재 포지션 없음 · 다음 신호: <strong className="text-slate-700">{describeAction(state.lastEval?.action)}</strong>
          </p>
        )}

        {state.lastError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p className="text-xs font-medium leading-relaxed break-all">{state.lastError}</p>
          </div>
        )}

        {state.mode === 'live' && state.limits && (
          <LimitsRow
            limits={state.limits}
            dailyLoss={state.dailyLoss}
            tradingBlocked={state.tradingBlocked}
            blockReason={state.blockReason}
          />
        )}

        {state.trades && state.trades.length > 0 && <TradesBlock trades={state.trades} />}
      </div>
    </section>
  );
}

function PositionBlock({ position, lastEval }) {
  const cur = position.currentPrice;
  const pnlPct = lastEval?.position?.PNL_PCT;
  const fallbackPnl = cur ? (cur / position.entryPrice - 1) * 100 : null;
  const shownPnl = typeof pnlPct === 'number' ? pnlPct : fallbackPnl;
  const positive = shownPnl != null && shownPnl >= 0;
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-violet-700 uppercase tracking-wider">보유 중</p>
        {shownPnl != null && (
          <span className={`text-sm font-black tabular-nums ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {fmtPct(shownPnl)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-bold tabular-nums">
        <span className="text-slate-500">진입가 <span className="text-slate-800">{fmtKrw(position.entryPrice)}</span></span>
        <span className="text-slate-500">현재가 <span className="text-slate-800">{cur != null ? fmtKrw(cur) : '—'}</span></span>
        <span className="text-slate-500">수량 <span className="text-slate-800">{Number(position.qty).toFixed(6)}</span></span>
        <span className="text-slate-500">투입 <span className="text-slate-800">{fmtKrw(position.investKrw)}</span></span>
      </div>
    </div>
  );
}

function LimitsRow({ limits, dailyLoss = 0, tradingBlocked, blockReason }) {
  const max = Number(limits?.max_exposure_krw) || 0;
  const daily = Number(limits?.daily_loss_limit_krw) || 0;
  const lossPct = daily > 0 ? Math.min(100, (dailyLoss / daily) * 100) : 0;
  const lossTone = tradingBlocked ? 'bg-rose-500' : lossPct > 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-700 uppercase tracking-wider">
        <ShieldAlert size={11} />
        실거래 안전장치
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-bold tabular-nums text-slate-700">
        <span>1회 최대 매수 <span className="text-slate-900">{max.toLocaleString('ko-KR')}원</span></span>
        <span className="text-slate-300">·</span>
        <span>일일 손실 한도 <span className="text-slate-900">{daily.toLocaleString('ko-KR')}원</span></span>
      </div>
      <div>
        <div className="flex justify-between text-[10px] font-bold tabular-nums">
          <span className="text-slate-500">오늘 누적 손실</span>
          <span className="text-slate-700">
            {Math.round(dailyLoss).toLocaleString('ko-KR')}원 / {daily.toLocaleString('ko-KR')}원
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-rose-100 overflow-hidden">
          <div className={`h-full ${lossTone} transition-all`} style={{ width: `${lossPct}%` }} />
        </div>
      </div>
      {tradingBlocked && blockReason && (
        <p className="text-[11px] font-bold text-rose-700 leading-relaxed">⛔ {blockReason}</p>
      )}
    </div>
  );
}

function TradesBlock({ trades }) {
  return (
    <div className="pt-3 border-t border-slate-100">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
        최근 거래 (최대 {trades.length})
      </p>
      <ul className="space-y-1.5 max-h-72 overflow-y-auto">
        {trades.slice().reverse().map((t, i) => (
          <TradeRow key={trades.length - i} trade={t} />
        ))}
      </ul>
    </div>
  );
}

function TradeRow({ trade }) {
  // 라벨은 손익 부호 기준. 신호 종류는 작은 회색 서브 라벨.
  const enter = trade.action === 'ENTER';
  const profitable = !enter && Number(trade.pnlPct) >= 0;
  const icon = enter ? <TrendingDown size={12} /> :
    profitable ? <TrendingUp size={12} /> : <TrendingDown size={12} />;
  const tone = enter ? 'text-blue-600 bg-blue-50 border-blue-100' :
    profitable ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
    'text-rose-600 bg-rose-50 border-rose-100';
  const label = enter ? '진입' : profitable ? '익절' : '손절';
  const reasonHint = !enter
    ? (trade.action === 'EXIT_TP' ? '익절 신호' : trade.action === 'EXIT_SL' ? '손절 신호' : null)
    : null;
  const pnl = trade.pnlPct != null ? fmtPct(trade.pnlPct) : null;
  return (
    <li className="flex items-center gap-2 text-[11px] font-medium tabular-nums">
      <span className={`px-1.5 py-0.5 rounded border ${tone} font-bold flex items-center gap-1`}>
        {icon}{label}
      </span>
      {reasonHint && (
        <span className="text-[10px] text-slate-400 font-bold">{reasonHint}</span>
      )}
      <span className="text-slate-500">{fmtTime(trade.time)}</span>
      <span className="text-slate-700 font-bold">{fmtKrw(trade.price)}</span>
      {pnl && (
        <span className={`ml-auto font-bold ${Number(trade.pnlPct) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {pnl}
        </span>
      )}
    </li>
  );
}

function Stat({ icon, label, value, tone = 'slate' }) {
  const color =
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'rose' ? 'text-rose-600' : 'text-slate-800';
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
        {icon}{label}
      </p>
      <p className={`text-sm font-black tabular-nums mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function UpdatedAgo({ iso }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return <>—</>;
  const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diff < 15) return <>방금 업데이트</>;
  if (diff < 60) return <>{diff}초 전 업데이트</>;
  if (diff < 3600) return <>{Math.floor(diff / 60)}분 전 업데이트</>;
  return <>{Math.floor(diff / 3600)}시간 전 업데이트</>;
}

function isStale(iso) {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > 60_000;
}

function describeAction(action) {
  return {
    WAIT: '진입 대기',
    ENTER: '진입 신호',
    HOLD: '보유 유지',
    EXIT_TP: '익절',
    EXIT_SL: '손절',
  }[action] || '평가 대기';
}

function fmtKrw(v) {
  const n = Number(v) || 0;
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}
function fmtPct(v) {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function fmtTime(iso) {
  if (!iso) return '—';
  return String(iso).slice(11, 16);
}
