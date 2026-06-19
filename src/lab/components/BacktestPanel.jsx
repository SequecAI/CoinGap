import React from 'react';
import { Play, RefreshCcw, BarChart3, AlertCircle } from 'lucide-react';

/**
 * 백테스트 실행 버튼 카드.
 * 결과 표시는 별도 컴포넌트(ResultCard)에서 처리한다.
 *
 * props:
 *   running:  boolean
 *   error:    string | null
 *   symbol:   string  (요약 표시용)
 *   days:     number  (요약 표시용)
 *   onRun:    () => void
 */
export default function BacktestPanel({ running, error, symbol, days, onRun }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
          <BarChart3 size={16} />
        </div>
        <h3 className="text-sm font-black text-slate-800">백테스트</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {symbol} · 최근 {days}일 1분봉
        </span>
      </div>

      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
        ※ 과거 데이터 기반 <strong className="text-rose-500">참고용</strong> 시뮬레이션입니다.
        미래 수익을 보장하지 않으며, 진입·청산은 종가 체결을 가정합니다. 투자 자문이 아닙니다.
      </p>

      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm shadow-lg shadow-violet-200 transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        {running ? (
          <>
            <RefreshCcw size={18} className="animate-spin" />
            시뮬레이션 중...
          </>
        ) : (
          <>
            <Play size={18} />
            백테스트 실행
          </>
        )}
      </button>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-rose-700">{error}</p>
        </div>
      )}
    </div>
  );
}
