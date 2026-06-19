import React from 'react';
import { Plus } from 'lucide-react';
import ConditionRow from './ConditionRow.jsx';

/**
 * AND로 묶인 조건들의 그룹.
 * 단계 5에서 SectionEditor가 그룹들을 OR로 묶어 표시한다.
 *
 * props:
 *   group:        [{lhs, op, rhs}, ...]
 *   errors:       { [ci]: string | null }
 *   tone:         색상 키 ('blue' | 'emerald' | 'rose') — 단계 5에서 섹션별 색
 *   onChangeCond: (ci, nextCond) => void
 *   onAddCond:    () => void
 *   onRemoveCond: (ci) => void
 *   onFocus:      (ci, side) => void
 *   onBlur:       (ci, cond) => void
 */
export default function ConditionGroup({
  group,
  errors = {},
  tone = 'slate',
  coordPrefix,
  onChangeCond,
  onAddCond,
  onRemoveCond,
  onFocus,
  onBlur,
}) {
  const palette = TONES[tone] || TONES.slate;

  return (
    <div className={`rounded-2xl ${palette.bg} border ${palette.border} p-3 space-y-2`}>
      {group.map((cond, ci) => (
        <div key={ci}>
          {ci > 0 && (
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 py-0.5">
              그리고 (AND)
            </div>
          )}
          <ConditionRow
            cond={cond}
            error={errors[ci]}
            coordKey={coordPrefix ? `${coordPrefix}-${ci}` : undefined}
            onChange={(next) => onChangeCond(ci, next)}
            onRemove={group.length > 1 ? () => onRemoveCond(ci) : null}
            onFocus={(side) => onFocus?.(ci, side)}
            onBlur={(c) => onBlur?.(ci, c)}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={onAddCond}
        className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold ${palette.btnText} hover:bg-white/60 rounded-md transition-colors`}
      >
        <Plus size={13} />
        조건 추가 (AND)
      </button>
    </div>
  );
}

const TONES = {
  slate: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    btnText: 'text-slate-600 hover:text-slate-900',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    btnText: 'text-blue-600 hover:text-blue-800',
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    btnText: 'text-emerald-600 hover:text-emerald-800',
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    btnText: 'text-rose-600 hover:text-rose-800',
  },
};
