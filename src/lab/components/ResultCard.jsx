import React from 'react';
import { Calendar } from 'lucide-react';

/**
 * 백테스트 결과 카드.
 * 6개 통계 + 청산 사유 카운트 + 기간 표시.
 *
 * props:
 *   result: backend run_backtest() 반환값
 *     { period_start, period_end, total_return_pct, mdd_pct,
 *       total_trades, win_rate_pct, profit_factor, avg_duration_mins, trades: [...] }
 */
export default function ResultCard({ result }) {
  if (!result) return null;

  const reasons = (result.trades || []).reduce((acc, t) => {
    acc[t.reason] = (acc[t.reason] || 0) + 1;
    return acc;
  }, {});

  const positive = result.total_return_pct >= 0;
  const stats = [
    {
      label: '총 수익률',
      value: `${positive ? '+' : ''}${result.total_return_pct}%`,
      tone: positive ? 'text-emerald-600' : 'text-rose-600',
    },
    {
      label: '최대 낙폭(MDD)',
      value: `${result.mdd_pct}%`,
      tone: 'text-rose-600',
    },
    {
      label: '총 거래수',
      value: String(result.total_trades),
      tone: 'text-slate-800',
    },
    {
      label: '승률',
      value: `${result.win_rate_pct}%`,
      tone: 'text-slate-800',
    },
    {
      label: '손익비 (PF)',
      value: result.profit_factor != null ? String(result.profit_factor) : '—',
      tone: 'text-slate-800',
    },
    {
      label: '평균 보유',
      value: `${result.avg_duration_mins}분`,
      tone: 'text-slate-800',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
        <Calendar size={12} className="text-slate-400" />
        <span className="tabular-nums">
          {formatDateRange(result.period_start, result.period_end)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4"
          >
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {s.label}
            </p>
            <p className={`text-xl sm:text-2xl font-black tabular-nums mt-1 ${s.tone}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
          청산 사유 분포
        </p>
        {Object.keys(reasons).length === 0 ? (
          <p className="text-xs text-slate-500 font-medium">거래 없음</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(reasons).map(([key, count]) => (
              <span
                key={key}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${reasonTone(key)}`}
              >
                {translateReason(key)} {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {result.trades?.length > 0 && (
        <p className="text-[10px] text-slate-400 font-medium">
          ※ 최근 {Math.min(result.trades.length, 200)}건의 거래만 표시됩니다 (응답 크기 절약).
        </p>
      )}
    </div>
  );
}

function formatDateRange(start, end) {
  // "2026-05-21 04:38:00+00:00" → "2026-05-21 04:38"
  const trim = (s) => (s ? String(s).slice(0, 16).replace('T', ' ') : '—');
  return `${trim(start)} ~ ${trim(end)}`;
}

function translateReason(key) {
  return (
    { TakeProfit: '익절', StopLoss: '손절', EndOfData: '강제청산' }[key] || key
  );
}

function reasonTone(key) {
  return (
    {
      TakeProfit: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      StopLoss: 'bg-rose-50 text-rose-700 border border-rose-200',
      EndOfData: 'bg-slate-100 text-slate-600 border border-slate-200',
    }[key] || 'bg-slate-100 text-slate-600 border border-slate-200'
  );
}
