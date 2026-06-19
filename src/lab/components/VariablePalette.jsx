import React, { useState } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

/**
 * 변수 / 함수 팔레트.
 * entry / exit 컨텍스트 탭으로 표시할 변수 그룹을 전환한다.
 *
 * 단계 2: 표시만. 클릭 시 onInsert를 호출하지만 부모(Builder)에서 noop으로 받는다.
 * 단계 4에서 ConditionRow의 포커스된 입력칸에 토큰을 삽입하도록 연결한다.
 *
 * props:
 *   variables: { entry: [...], exit: [...], operators: [...] } | null
 *   loading: boolean
 *   error: string | null
 *   onInsert: (token: string) => void
 */
export default function VariablePalette({ variables, loading, error, onInsert }) {
  const [tab, setTab] = useState('exit'); // exit가 변수 더 많아 기본값

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-2 text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-xs font-bold">변수 팔레트 불러오는 중…</span>
      </div>
    );
  }

  if (error || !variables) {
    return (
      <div className="bg-red-50 rounded-2xl border border-red-200 p-5 flex items-start gap-2">
        <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-black text-red-700">변수 팔레트 불러오기 실패</p>
          <p className="text-[11px] font-medium text-red-600 mt-0.5">{error || '응답이 비어있습니다.'}</p>
        </div>
      </div>
    );
  }

  const groups = variables[tab] || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <Sparkles size={16} />
          </div>
          <h3 className="text-sm font-black text-slate-800">변수 · 함수 팔레트</h3>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg text-[11px] font-bold">
          <button
            onClick={() => setTab('entry')}
            className={`px-2.5 py-1 rounded transition-colors ${
              tab === 'entry' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            진입용
          </button>
          <button
            onClick={() => setTab('exit')}
            className={`px-2.5 py-1 rounded transition-colors ${
              tab === 'exit' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            익절·손절용
          </button>
        </div>
      </div>

      <p className="text-[11px] font-medium text-slate-500 mb-4 leading-relaxed">
        조건 입력칸을 클릭한 뒤 아래 변수를 누르면 해당 자리에 삽입됩니다. (단계 4부터 동작)
      </p>

      <div className="space-y-4">
        {groups.map((g) => (
          <PaletteGroup key={g.id} group={g} onInsert={onInsert} />
        ))}
      </div>

      {variables.operators?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
            연산자
          </p>
          <div className="flex flex-wrap gap-1.5">
            {variables.operators.map((op) => (
              <span
                key={op}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md font-mono text-[11px] font-bold text-slate-600"
              >
                {op}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PaletteGroup({ group, onInsert }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
        {group.title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {group.items.map((it) => (
          <button
            key={it.value}
            onMouseDown={(e) => {
              e.preventDefault(); // 입력칸 blur 방지
              onInsert?.(it.value);
            }}
            className="group px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white hover:border-violet-400 hover:bg-violet-50 active:scale-95 transition-all text-left"
          >
            <span className="block text-[9px] font-bold text-slate-400 group-hover:text-violet-500">
              {it.label}
            </span>
            <span className="block text-[11px] font-mono font-bold text-slate-700 group-hover:text-violet-700">
              {it.value}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
