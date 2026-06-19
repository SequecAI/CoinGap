import React from 'react';
import { Settings2 } from 'lucide-react';
import { SYMBOLS, DAYS_OPTIONS } from '../constants.js';

/**
 * 빌더의 기본 설정 카드.
 * 전략 이름·종목·백테스트 기간·매수 비중·수수료·슬리피지.
 *
 * Controlled component — 상태는 부모(Builder)에서 관리하고 onChange로 보고.
 * props:
 *   name, symbol, days, params, onChange (key, value) => void
 */
export default function BasicSettings({ name, symbol, days, params, onChange }) {
  const setNumber = (key) => (e) => onChange(key, e.target.value);
  const setParam = (key) => (e) =>
    onChange('params', { ...params, [key]: e.target.value });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
          <Settings2 size={16} />
        </div>
        <h3 className="text-sm font-black text-slate-800">기본 설정</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="전략 이름">
          <input
            type="text"
            value={name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="예: 알트 급락 진입 v1"
            maxLength={50}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-400 focus:bg-white transition-colors"
          />
        </Field>

        <Field label="종목">
          <select
            value={symbol}
            onChange={(e) => onChange('symbol', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-400 focus:bg-white transition-colors"
          >
            {SYMBOLS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="백테스트 기간">
          <select
            value={days}
            onChange={(e) => onChange('days', Number(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-400 focus:bg-white transition-colors"
          >
            {DAYS_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="매수 비중 (%)">
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            value={params.allocation_pct}
            onChange={setParam('allocation_pct')}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-400 focus:bg-white transition-colors tabular-nums"
          />
        </Field>

        <Field label="수수료 (%)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={params.fee_pct}
            onChange={setParam('fee_pct')}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-400 focus:bg-white transition-colors tabular-nums"
          />
        </Field>

        <Field label="슬리피지 (%)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={params.slippage_pct}
            onChange={setParam('slippage_pct')}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-400 focus:bg-white transition-colors tabular-nums"
          />
        </Field>
      </div>

      <p className="mt-4 text-[11px] text-slate-400 font-medium leading-relaxed">
        ※ 28일은 캐시 적재 초기 상태. EventBridge가 매일 새벽 자동으로 1년치까지 채워갑니다.
      </p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
