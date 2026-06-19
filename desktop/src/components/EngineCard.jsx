import React, { useEffect, useState } from 'react';
import {
  Bot, Play, Square, Loader2, AlertTriangle, ShieldAlert,
  TrendingUp, TrendingDown, Wallet, Activity, Clock, Timer,
} from 'lucide-react';

const SYMBOL_LABEL = {
  'KRW-BTC': 'BTC', 'KRW-ETH': 'ETH', 'KRW-SOL': 'SOL', 'KRW-XRP': 'XRP',
  'KRW-DOGE': 'DOGE', 'KRW-ADA': 'ADA', 'KRW-TRX': 'TRX', 'KRW-AVAX': 'AVAX',
  'KRW-LINK': 'LINK', 'KRW-POL': 'POL',
};

/**
 * 실행 엔진 카드. 페이퍼 모드만 지원 (C5b).
 * C6에서 실거래 토글 + 안전장치 추가 예정.
 */
export default function EngineCard({ state, context, error, onStop }) {
  const running = state === 'running';
  const idle = !context;
  const isLive = context?.mode === 'live';

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${running ? (isLive ? 'bg-rose-600 text-white animate-pulse' : 'bg-violet-600 text-white animate-pulse') : 'bg-slate-50 text-slate-500'}`}>
            <Bot size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800">실행 엔진</h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {running ? `${isLive ? '실거래' : '모의투자'} 모드 · 10초 주기 평가 중` :
               state === 'stopped' ? '중지됨' : '대기 중'}
            </p>
          </div>
        </div>
        {isLive ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-wider">
            <ShieldAlert size={11} />
            실거래
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider">
            <ShieldAlert size={11} />
            모의투자
          </div>
        )}
      </header>

      <div className="p-5">
        {idle ? <IdleView /> : (
          <RunningView
            state={state}
            context={context}
            error={error}
            onStop={onStop}
          />
        )}
      </div>
    </section>
  );
}

function IdleView() {
  return (
    <div className="text-center py-6">
      <p className="text-xs text-slate-400 font-medium leading-relaxed">
        보관함에서 로직을 선택하고 "이 로직 실행"을 누르면<br />
        모의투자가 시작됩니다.
      </p>
      <p className="text-[10px] text-slate-300 font-medium mt-3">
        시드머니 1,000,000원 · 10초마다 진입/청산 조건 평가 · 실거래 옵션은 C6에서 추가
      </p>
    </div>
  );
}

function RunningView({ state, context, error, onStop }) {
  const price = context.lastEval?.market?.PRICE;
  const action = context.lastEval?.action;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-black text-slate-900 truncate">{context.logicName}</p>
          <p className="text-[11px] text-slate-500 font-medium tabular-nums mt-0.5">
            {SYMBOL_LABEL[context.symbol] || context.symbol} ·
            {' '}현재가 {price != null ? fmtKrw(price) : '—'} ·
            {' '}{context.ticks}회 평가
          </p>
        </div>
        {state === 'running' && (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors shrink-0"
          >
            <Square size={13} />
            중지
          </button>
        )}
      </div>

      <TimingRow
        startedAt={context.startedAt}
        nextTickAt={context.nextTickAt}
        running={state === 'running'}
      />

      {context.mode === 'live' && context.limits && (
        <LimitsRow
          limits={context.limits}
          dailyLoss={context.dailyLoss}
          tradingBlocked={context.tradingBlocked}
          blockReason={context.blockReason}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={<Wallet size={12} />} label="평가 자산" value={fmtKrw(context.equity)} />
        <Stat
          icon={<TrendingUp size={12} />}
          label="수익률"
          value={fmtPct(context.returnPct)}
          tone={context.returnPct >= 0 ? 'emerald' : 'rose'}
        />
        <Stat icon={<Wallet size={12} />} label="현금" value={fmtKrw(context.cash)} />
        <Stat icon={<Activity size={12} />} label="거래수" value={String(context.tradeCount)} />
      </div>

      {context.position ? (
        <PositionBlock position={context.position} lastEval={context.lastEval} />
      ) : (
        <p className="text-[11px] text-slate-500 font-medium px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
          현재 포지션 없음 · 다음 신호: <strong className="text-slate-700">{describeAction(action)}</strong>
        </p>
      )}

      {error && (
        <ErrBlock>{error}</ErrBlock>
      )}
      {context.lastError && !error && (
        <ErrBlock>{context.lastError}</ErrBlock>
      )}

      {context.trades.length > 0 && <TradesBlock trades={context.trades} />}
    </div>
  );
}

/**
 * 시작 시각 / 경과 시간 / 다음 평가까지 남은 시간을 1초마다 갱신해 표시.
 * 상위 status가 매 tick(10초)마다 들어오지만, 카운트다운은 그 사이에도 흘러가야 하므로 자체 1초 타이머.
 */
function TimingRow({ startedAt, nextTickAt, running }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const startedMs = startedAt ? new Date(startedAt).getTime() : null;
  const elapsedSec = startedMs ? Math.max(0, Math.floor((now - startedMs) / 1000)) : null;
  const remainingSec = nextTickAt ? Math.max(0, Math.ceil((nextTickAt - now) / 1000)) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold tabular-nums px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
      <span className="flex items-center gap-1.5 text-slate-600">
        <Clock size={12} className="text-slate-400" />
        시작 <span className="text-slate-800">{fmtStarted(startedAt)}</span>
        {elapsedSec != null && (
          <span className="text-slate-400 ml-1">({fmtDuration(elapsedSec)} 경과)</span>
        )}
      </span>
      {running && remainingSec != null && (
        <span className="flex items-center gap-1.5 text-slate-600">
          <Timer size={12} className="text-violet-500" />
          다음 평가 <span className="text-violet-700">{remainingSec}초 후</span>
        </span>
      )}
    </div>
  );
}

function LimitsRow({ limits, dailyLoss = 0, tradingBlocked = false, blockReason = null }) {
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
          <span className="text-slate-500">오늘 누적 손실 <span className="text-slate-400 font-medium">(KST 자정 리셋)</span></span>
          <span className="text-slate-700">
            {Math.round(dailyLoss).toLocaleString('ko-KR')}원 / {daily.toLocaleString('ko-KR')}원
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-rose-100 overflow-hidden">
          <div className={`h-full ${lossTone} transition-all`} style={{ width: `${lossPct}%` }} />
        </div>
        <p className="mt-1 text-[10px] text-slate-400 font-medium">
          중지·재시작과 무관하게 오늘(KST) 안에 발생한 손실이 누적됩니다.
        </p>
      </div>

      {tradingBlocked && blockReason && (
        <p className="text-[11px] font-bold text-rose-700 leading-relaxed">
          ⛔ {blockReason}
        </p>
      )}
    </div>
  );
}

function fmtStarted(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function fmtDuration(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}
function pad(n) { return String(n).padStart(2, '0'); }

function PositionBlock({ position, lastEval }) {
  const cur = position.currentPrice;
  // 백엔드 evaluate가 수수료+슬리피지 양방을 반영해 계산한 값을 우선 사용.
  // (단순 시세 변동률보다 청산 시 실수익률에 훨씬 가깝다)
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
        <span className="text-slate-500">수량 <span className="text-slate-800">{position.qty.toFixed(6)}</span></span>
        <span className="text-slate-500">투입 <span className="text-slate-800">{fmtKrw(position.investKrw)}</span></span>
      </div>
      {typeof pnlPct === 'number' && (
        <p className="text-[10px] text-slate-400 font-medium leading-relaxed pt-1 border-t border-violet-100">
          ※ 수익률은 진입·청산 수수료와 슬리피지를 반영한 추정치입니다.
        </p>
      )}
    </div>
  );
}

function TradesBlock({ trades }) {
  return (
    <div className="pt-3 border-t border-slate-100">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
        최근 거래 ({trades.length})
      </p>
      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
        {trades.slice().reverse().map((t, i) => (
          <TradeRow key={trades.length - i} trade={t} />
        ))}
      </ul>
    </div>
  );
}

function TradeRow({ trade }) {
  const enter = trade.action === 'ENTER';
  const icon = enter ? <TrendingDown size={12} /> : <TrendingUp size={12} />;
  const tone = enter ? 'text-blue-600 bg-blue-50 border-blue-100' :
    trade.action === 'EXIT_TP' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
    'text-rose-600 bg-rose-50 border-rose-100';
  const label = enter ? '진입' : trade.action === 'EXIT_TP' ? '익절' : '손절';
  const pnl = trade.pnlPct != null ? fmtPct(trade.pnlPct) : null;
  return (
    <li className="flex items-center gap-2 text-[11px] font-medium tabular-nums">
      <span className={`px-1.5 py-0.5 rounded border ${tone} font-bold flex items-center gap-1`}>
        {icon}{label}
      </span>
      <span className="text-slate-500">{fmtTime(trade.time)}</span>
      <span className="text-slate-700 font-bold">{fmtKrw(trade.price)}</span>
      {pnl && (
        <span className={`ml-auto font-bold ${trade.pnlPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {pnl}
        </span>
      )}
    </li>
  );
}

function ErrBlock({ children }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <p className="text-xs font-medium leading-relaxed break-all">{children}</p>
    </div>
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
