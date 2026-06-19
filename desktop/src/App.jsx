import React, { useState } from 'react';
import { Bot, ShieldAlert, LogOut, User } from 'lucide-react';
import { useAuth } from './hooks/useAuth.js';
import { useMyLogics } from './hooks/useMyLogics.js';
import { useApiKeys } from './hooks/useApiKeys.js';
import { useEngine } from './hooks/useEngine.js';
import { useRunSync } from './hooks/useRunSync.js';
import { useTradeSync } from './hooks/useTradeSync.js';
import LoginScreen from './components/LoginScreen.jsx';
import LogicsPanel from './components/LogicsPanel.jsx';
import ApiKeysCard from './components/ApiKeysCard.jsx';
import EngineCard from './components/EngineCard.jsx';
import RunModal from './components/RunModal.jsx';

/**
 * Phase C2: 로그인 화면 ↔ 메인 화면 분기.
 * 로그인 완료 시 userInfo.nickname 표시 + 로그아웃 버튼.
 * C3부터 보관함 카드가 placeholder를 대체한다.
 */
export default function App() {
  const { isReady, isLoggedIn, userInfo, loading, error, login, logout } = useAuth();

  // 디스크에서 세션 로드 중에는 빈 화면 — 깜빡임 방지
  if (!isReady) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (!isLoggedIn) {
    return <LoginScreen onLogin={login} loading={loading} error={error} />;
  }

  return <MainScreen userInfo={userInfo} onLogout={logout} />;
}

function MainScreen({ userInfo, onLogout }) {
  const platform = window.coingap?.app?.platform || 'unknown';
  const version = window.coingap?.app?.version || '0.1.0';
  const logics = useMyLogics(userInfo?.userId);
  const apiKeys = useApiKeys();
  const engine = useEngine();
  useRunSync(userInfo?.userId, engine.state, engine.context);
  useTradeSync(userInfo?.userId);

  const engineRunning = engine.state === 'running';
  const runningLogicId = engine.context?.logicId || null;

  const [modalLogic, setModalLogic] = useState(null);

  const handleRun = (logic) => {
    setModalLogic(logic);
  };

  const handleConfirmRun = async ({ mode, limits }) => {
    const logic = modalLogic;
    setModalLogic(null);
    if (!logic) return;
    const ok = await engine.start(logic, { mode, limits });
    if (ok) {
      setTimeout(() => {
        document.getElementById('engine-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-600 text-white rounded-xl shadow-lg shadow-violet-100">
            <Bot size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none">CoinGap Desktop</h1>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
              로컬 자동매매 에이전트 · v{version} · {platform}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            title={userInfo?.email || ''}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold"
          >
            <User size={13} />
            <span className="max-w-[140px] truncate">{userInfo?.nickname || '사용자'}</span>
          </div>
          <button
            onClick={onLogout}
            title="로그아웃"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
          >
            <LogOut size={13} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-[11px] font-bold">
            <ShieldAlert size={13} />
            개발 미리보기
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <LogicsPanel
          logics={logics.logics}
          selected={logics.selected}
          selectedId={logics.selectedId}
          setSelectedId={logics.setSelectedId}
          loading={logics.loading}
          error={logics.error}
          onReload={logics.reload}
          onRun={handleRun}
          engineRunning={engineRunning}
          runningLogicId={runningLogicId}
        />

        <div id="engine-card">
          <EngineCard
            state={engine.state}
            context={engine.context}
            error={engine.error}
            onStop={engine.stop}
          />
        </div>

        <ApiKeysCard
          status={apiKeys.status}
          summary={apiKeys.summary}
          loading={apiKeys.loading}
          error={apiKeys.error}
          onSave={apiKeys.save}
          onTest={apiKeys.test}
          onClear={apiKeys.clear}
        />

        <RunModal
          open={!!modalLogic}
          logic={modalLogic}
          apiKeySaved={!!apiKeys.status?.exists}
          onClose={() => setModalLogic(null)}
          onConfirm={handleConfirmRun}
        />

        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
            Phase C 진행 상황
          </h2>
          <ul className="space-y-1.5 text-xs font-bold">
            <Milestone done label="C1 · Electron 골격" />
            <Milestone done label="C2 · Google 로그인" />
            <Milestone done label="C3 · 보관함에서 로직 불러오기" />
            <Milestone done label="C4 · 업비트 API 키 + OS 키체인 저장" />
            <Milestone done label="C5 · 페이퍼 트레이딩 실행 엔진" />
            <Milestone label="C6 · 실거래 토글 + 안전장치" />
            <Milestone label="C7 · 운영 상태 클라우드 동기화" />
            <Milestone label="C8 · 모바일 운영 현황 화면" />
            <Milestone label="C9 · 약관·면책 + 설치 패키지" />
          </ul>
        </section>
      </main>
    </div>
  );
}

function Milestone({ label, done = false }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`w-4 h-4 rounded-full border-2 ${done ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`} />
      <span className={done ? 'text-slate-800' : 'text-slate-400'}>{label}</span>
    </li>
  );
}

