import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Activity, RefreshCw, Loader2, AlertTriangle,
  LogIn, MonitorSmartphone,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useRunState } from './hooks/useRunState.js';
import { useTradesHistory } from './hooks/useTradesHistory.js';
import RunCard from './components/RunCard.jsx';
import HistoryCard from './components/HistoryCard.jsx';

/**
 * 운영 현황 페이지 (/live).
 * PC 앱이 push한 LabRuns 상태를 read-only로 표시.
 *
 * 비로그인: 로그인 안내만.
 * 로그인 + 운영 중: RunCard 표시 (30초 폴링).
 * 로그인 + 운영 안 함: "PC 앱에서 로직 실행" 안내.
 */
export default function LivePage() {
  const { isLoggedIn, userInfo } = useAuth();
  const { state, loading, error, reload } = useRunState(userInfo?.userId);
  const history = useTradesHistory(userInfo?.userId);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pt-6 pb-20 px-4 text-left">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-100">
              <Activity size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                운영 현황
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                PC App · Live Monitoring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reload}
              disabled={loading}
              title="다시 불러오기"
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 text-xs font-bold transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
            >
              <ArrowLeft size={14} />
              coingap으로
            </Link>
          </div>
        </div>

        {!isLoggedIn ? (
          <LoginRequired />
        ) : (
          <>
            {error ? (
              <ErrorView message={error} onRetry={reload} />
            ) : state ? (
              <RunCard state={state} />
            ) : loading ? (
              <LoadingView />
            ) : (
              <EmptyState />
            )}

            <HistoryCard
              preset={history.preset}
              setPreset={history.setPreset}
              customFrom={history.customFrom}
              setCustomFrom={history.setCustomFrom}
              customTo={history.customTo}
              setCustomTo={history.setCustomTo}
              range={history.range}
              trades={history.trades}
              stats={history.stats}
              loading={history.loading}
              error={history.error}
              onReload={history.reload}
            />
          </>
        )}

        <footer className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            © 2026 Asset Indicator Monitor — Live Preview
          </p>
        </footer>
      </div>
    </div>
  );
}

function LoginRequired() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center">
      <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl inline-flex">
        <LogIn size={24} />
      </div>
      <h2 className="mt-3 text-sm font-black text-slate-800">로그인이 필요합니다</h2>
      <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">
        PC 앱과 같은 Google 계정으로 로그인하면<br />
        현재 운영 중인 로직의 상태를 실시간으로 볼 수 있어요.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 mt-4 px-3 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold transition-colors"
      >
        coingap 메인에서 로그인
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-slate-50 text-slate-500 rounded-xl shrink-0">
          <MonitorSmartphone size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-slate-800">현재 운영 중인 로직이 없습니다</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
            PC 앱(CoinGap Desktop)을 켜고 보관함에서 로직을 실행하면 여기에 자동으로 표시됩니다.
            <br />이 페이지는 30초마다 자동으로 갱신됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorView({ message, onRetry }) {
  return (
    <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0">
          <AlertTriangle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-rose-700">조회 실패</h2>
          <p className="text-xs text-rose-600 mt-1 font-medium leading-relaxed break-all">{message}</p>
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors"
          >
            <RefreshCw size={13} />
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center text-slate-400">
      <Loader2 size={18} className="animate-spin mx-auto mb-2" />
      <p className="text-xs font-bold">불러오는 중…</p>
    </div>
  );
}
