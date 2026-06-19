import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ConditionGroup from './ConditionGroup.jsx';

/**
 * 한 섹션(진입 / 익절 / 손절)의 룰 편집기.
 * 그룹 여러 개를 OR로 묶어 표시한다. 각 그룹은 ConditionGroup (AND).
 *
 * props:
 *   title:    string                    "진입 조건" 등
 *   icon:     ReactNode                  앞에 붙는 아이콘
 *   tone:     'blue' | 'emerald' | 'rose'
 *   desc:     string                    설명 한 줄
 *   ctx:      'entry' | 'exit'          (현재 상위가 사용; 여기선 단순 표시용)
 *   groups:   [[cond, ...], ...]        그룹들
 *   errors:   { [`${gi}-${ci}`]: msg }  키는 그룹 인덱스 + 조건 인덱스
 *   onChangeCond:  (gi, ci, nextCond) => void
 *   onAddCond:     (gi) => void
 *   onRemoveCond:  (gi, ci) => void
 *   onAddGroup:    () => void
 *   onRemoveGroup: (gi) => void
 *   onFocus:       (gi, ci, side) => void
 *   onBlur:        (gi, ci, cond) => void
 */
export default function SectionEditor({
  title,
  icon,
  tone = 'slate',
  desc,
  sectionKey,
  groups,
  errors = {},
  onChangeCond,
  onAddCond,
  onRemoveCond,
  onAddGroup,
  onRemoveGroup,
  onFocus,
  onBlur,
}) {
  const palette = HEADER_TONES[tone] || HEADER_TONES.slate;

  // 그룹별 errors 슬라이스
  const errorsFor = (gi) => {
    const out = {};
    Object.entries(errors).forEach(([k, v]) => {
      const [gIdx, cIdx] = k.split('-').map(Number);
      if (gIdx === gi) out[cIdx] = v;
    });
    return out;
  };

  return (
    <div className={`bg-white rounded-2xl border ${palette.border} p-5 sm:p-6 shadow-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1.5 rounded-lg ${palette.iconBg} ${palette.iconText}`}>
          {icon}
        </div>
        <h3 className="text-sm font-black text-slate-800">{title}</h3>
      </div>
      {desc && (
        <p className="text-[11px] font-medium text-slate-500 mt-0.5 mb-4 leading-relaxed">
          {desc} 그룹 안은 <strong className="text-slate-700">AND</strong>, 그룹 사이는{' '}
          <strong className="text-slate-700">OR</strong>로 결합됩니다.
        </p>
      )}

      <div className="space-y-3">
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest my-2">
                — 또는 (OR) —
              </div>
            )}
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                케이스 {gi + 1}
              </span>
              {groups.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveGroup?.(gi)}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                  title="이 조건 그룹 전체 삭제"
                >
                  <Trash2 size={12} />
                  그룹 삭제
                </button>
              )}
            </div>
            <ConditionGroup
              group={group}
              errors={errorsFor(gi)}
              tone={tone}
              coordPrefix={sectionKey ? `${sectionKey}-${gi}` : undefined}
              onChangeCond={(ci, next) => onChangeCond(gi, ci, next)}
              onAddCond={() => onAddCond(gi)}
              onRemoveCond={(ci) => onRemoveCond(gi, ci)}
              onFocus={(ci, side) => onFocus?.(gi, ci, side)}
              onBlur={(ci, cond) => onBlur?.(gi, ci, cond)}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddGroup}
        className={`mt-3 flex items-center gap-1 px-2 py-1.5 text-[11px] font-black ${palette.btnText} hover:bg-slate-50 rounded-md transition-colors`}
      >
        <Plus size={14} />
        또 다른 조건 그룹 추가 (OR)
      </button>
    </div>
  );
}

const HEADER_TONES = {
  slate: {
    border: 'border-slate-200',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-600',
    btnText: 'text-slate-600 hover:text-slate-900',
  },
  blue: {
    border: 'border-blue-200',
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
    btnText: 'text-blue-600 hover:text-blue-800',
  },
  emerald: {
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
    btnText: 'text-emerald-600 hover:text-emerald-800',
  },
  rose: {
    border: 'border-rose-200',
    iconBg: 'bg-rose-50',
    iconText: 'text-rose-600',
    btnText: 'text-rose-600 hover:text-rose-800',
  },
};
