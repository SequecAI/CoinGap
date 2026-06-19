import React, { useState } from 'react';
import {
  KeyRound, ShieldCheck, ShieldAlert, Eye, EyeOff,
  Loader2, AlertTriangle, Trash2, RefreshCw, ExternalLink,
} from 'lucide-react';

/**
 * 업비트 API 키 관리 카드.
 * - 미저장: access/secret 입력 폼 → "저장 및 검증"
 * - 저장 상태: 마스킹된 access + 잔고 요약 + "재검증" / "삭제"
 * - secret은 한번 저장하면 절대 화면에 다시 나오지 않는다.
 */
export default function ApiKeysCard({
  status, summary, loading, error, onSave, onTest, onClear,
}) {
  const exists = !!status?.exists;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${exists ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800">업비트 API 키</h2>
            <p className="text-[11px] text-slate-500 font-medium">
              이 PC에만 저장 · OS 키체인 위임 · 서버 전송 없음
            </p>
          </div>
        </div>
        <a
          href="https://upbit.com/mypage/open_api_management"
          target="_blank"
          rel="noreferrer noopener"
          title="업비트 Open API 키 발급 페이지"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold transition-colors"
        >
          <ExternalLink size={12} />
          <span className="hidden sm:inline">키 발급</span>
        </a>
      </header>

      <div className="p-5">
        {exists ? (
          <SavedView
            status={status}
            summary={summary}
            loading={loading}
            error={error}
            onTest={onTest}
            onClear={onClear}
          />
        ) : (
          <InputForm loading={loading} error={error} onSave={onSave} />
        )}
      </div>
    </section>
  );
}

function InputForm({ loading, error, onSave }) {
  const [access, setAccess] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const canSubmit = access.trim() && secret.trim() && !loading;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const ok = await onSave(access.trim(), secret.trim());
    if (ok) {
      setAccess('');
      setSecret('');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Notice tone="amber">
        업비트 API 키 발급 시 <strong>자산조회·주문 권한</strong>만 체크하고, IP 허용 목록은
        현재 PC의 외부 IP로 좁히는 걸 권장합니다.
        <strong className="block mt-1">출금 권한은 절대 켜지 마세요.</strong>
      </Notice>

      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
          Access Key
        </label>
        <input
          type="text"
          value={access}
          onChange={(e) => setAccess(e.target.value)}
          placeholder="발급받은 access key"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-violet-400 transition-colors"
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
          Secret Key
        </label>
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="발급받은 secret key"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-sm font-mono outline-none focus:border-violet-400 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            title={showSecret ? '숨기기' : '보이기'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
          >
            {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p className="text-xs font-medium leading-relaxed">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-bold transition-colors"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
        {loading ? '검증 중…' : '저장하고 검증'}
      </button>
    </form>
  );
}

function SavedView({ status, summary, loading, error, onTest, onClear }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
        <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-emerald-800">키 저장됨</p>
          <p className="text-[11px] font-mono text-emerald-700 tabular-nums truncate">
            access · {status.accessMasked}
          </p>
        </div>
      </div>

      {summary && <SummaryBlock summary={summary} />}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p className="text-xs font-medium leading-relaxed">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onTest}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          재검증
        </button>
        <button
          onClick={onClear}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-bold transition-colors"
          title="이 PC에서 API 키 삭제"
        >
          <Trash2 size={14} />
          삭제
        </button>
      </div>
    </div>
  );
}

function SummaryBlock({ summary }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="KRW 잔고" value={fmtKrw(summary.krw)} />
      <Stat label="보유 자산" value={`${summary.assetCount}종`} />
      <Stat
        label="추정 평가액"
        value={fmtKrw(summary.totalAssetKrwEstimate)}
        hint="평균 매수가 기준"
      />
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" title={hint || ''}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-black text-slate-800 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function fmtKrw(v) {
  const n = Number(v) || 0;
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

function Notice({ tone = 'amber', children }) {
  const cls =
    tone === 'amber' ? 'bg-amber-50 border-amber-100 text-amber-800' :
    'bg-slate-50 border-slate-100 text-slate-700';
  return (
    <div className={`flex items-start gap-2 p-3 rounded-xl border ${cls}`}>
      <ShieldAlert size={14} className="mt-0.5 shrink-0" />
      <p className="text-[11px] font-medium leading-relaxed">{children}</p>
    </div>
  );
}
