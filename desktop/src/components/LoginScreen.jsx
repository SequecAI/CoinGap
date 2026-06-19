import React from 'react';
import { Bot, LogIn, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';

/**
 * 첫 진입 시 화면. Google 로그인 버튼 + 짧은 안내.
 */
export default function LoginScreen({ onLogin, loading, error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-100">
            <Bot size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">CoinGap Desktop</h1>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
              로컬 자동매매 에이전트
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 font-medium leading-relaxed">
          coingap 계정으로 로그인하면, 웹/앱에서 저장한 로직을 이 PC에서 바로 실행할 수 있어요.
        </p>

        <ul className="mt-5 space-y-2 text-xs text-slate-500 font-medium">
          <Bullet>같은 Google 계정 → 같은 보관함</Bullet>
          <Bullet>API 키는 이 PC에만 저장 (OS 키체인 위임)</Bullet>
          <Bullet>실거래는 페이퍼 모드 통과 후에만 활성화</Bullet>
        </ul>

        <button
          onClick={onLogin}
          disabled={loading}
          className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-bold transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {loading ? '브라우저에서 인증 대기 중…' : 'Google로 로그인'}
        </button>

        {error && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p className="text-xs font-medium leading-relaxed">{error}</p>
          </div>
        )}

        <p className="mt-5 pt-4 border-t border-slate-100 text-[10px] font-medium text-slate-400 leading-relaxed">
          로그인 버튼을 누르면 기본 브라우저에서 Google 인증 페이지가 열립니다.
          인증 후 자동으로 이 창으로 돌아옵니다.
        </p>
      </div>
    </div>
  );
}

function Bullet({ children }) {
  return (
    <li className="flex items-start gap-2">
      <ShieldCheck size={13} className="text-emerald-500 mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
