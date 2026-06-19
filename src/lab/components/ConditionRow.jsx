import React from 'react';
import { X } from 'lucide-react';
import { OPS } from '../constants.js';

/**
 * 조건 한 줄. lhs / op / rhs 입력 + 삭제 버튼.
 *
 * Controlled — 상태는 부모에서 보유. 부모는 보통 ConditionGroup이며,
 * onBlur 시 cond 전체를 부모로 올려 /validate를 호출시킨다.
 *
 * props:
 *   cond:      { lhs, op, rhs }
 *   error:     string | null (백엔드 검증 결과; 있으면 빨간 줄 + 메시지)
 *   coordKey:  string         "entry-0-0" 등. 부모가 새로 추가한 row를
 *                              querySelector로 찾아 자동 포커스할 때 사용.
 *   onChange:  (nextCond) => void
 *   onRemove:  () => void                (없거나 false면 ✕ 버튼 숨김)
 *   onFocus:   (side: 'lhs' | 'rhs') => void   (단계 4에서 팔레트 삽입 라우팅용)
 *   onBlur:    (cond) => void                  (검증 트리거)
 */
export default function ConditionRow({ cond, error, coordKey, onChange, onRemove, onFocus, onBlur }) {
  const set = (key) => (e) => onChange({ ...cond, [key]: e.target.value });

  const baseInput =
    'flex-1 min-w-0 bg-white border rounded-lg px-2.5 py-2 text-sm font-mono outline-none transition-colors';
  const borderOk = 'border-slate-200 focus:border-violet-400';
  const borderErr = 'border-red-400 focus:border-red-500';

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={cond.lhs}
          placeholder="변수/식 (예: Z_SCORE)"
          onChange={set('lhs')}
          onFocus={() => onFocus?.('lhs')}
          onBlur={() => onBlur?.(cond)}
          data-cond-coord={coordKey ? `${coordKey}-lhs` : undefined}
          className={`${baseInput} ${error ? borderErr : borderOk}`}
        />

        <select
          value={cond.op}
          onChange={set('op')}
          className="shrink-0 bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold outline-none focus:border-violet-400 transition-colors"
        >
          {OPS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={cond.rhs}
          placeholder="값/식 (예: -2.9)"
          onChange={set('rhs')}
          onFocus={() => onFocus?.('rhs')}
          onBlur={() => onBlur?.(cond)}
          className={`${baseInput} ${error ? borderErr : borderOk}`}
        />

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="조건 삭제"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 ml-1 text-[10px] font-bold text-red-500">{error}</p>
      )}
    </div>
  );
}
