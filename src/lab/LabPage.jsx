import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Beaker, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { labApi } from './api.js';

/**
 * Lab 메인 페이지 (Phase A 시작점, 자동매매 백테스트 빌더 진입점).
 *
 * 지금은 백엔드 4개 라우트가 잘 동작하는지만 확인하는 헬스체크 페이지.
 * 다음 단계에서 빌더·결과 컴포넌트로 점진적으로 채운다.
 *
 * 기존 coingap 라우트(/stock, /crypto, /community)와 분리되어
 * src/main.jsx의 <Route path="/lab/*"> 로 연결된다.
 */
export default function LabPage() {
  const [checks, setChecks] = useState({
    variables: { status: 'pending', detail: '' },
    sharedLogics: { status: 'pending', detail: '' },
    validate: { status: 'pending', detail: '' },
    backtest: { status: 'pending', detail: '' },
  });

  useEffect(() => {
    runHealthChecks();
  }, []);

  const runHealthChecks = async () => {
    setChecks({
      variables: { status: 'loading', detail: '' },
      sharedLogics: { status: 'loading', detail: '' },
      validate: { status: 'loading', detail: '' },
      backtest: { status: 'loading', detail: '' },
    });

    await runOne('variables', async () => {
      const r = await labApi.getVariables();
      return `entry ${r.entry?.length ?? 0}개 그룹, exit ${r.exit?.length ?? 0}개 그룹, 연산자 ${r.operators?.length ?? 0}개`;
    });

    await runOne('sharedLogics', async () => {
      const r = await labApi.getSharedLogics();
      return `공유 로직 ${r.logics?.length ?? 0}개 (${r.logics?.[0]?.name ?? '없음'})`;
    });

    await runOne('validate', async () => {
      const r = await labApi.validateExpr('Z_SCORE <= -2 and RSI_14 < 30', 'entry');
      return r.ok ? '수식 검증 통과' : `거부됨: ${r.error}`;
    });

    await runOne('backtest', async () => {
      const SEED = {
        name: 'Healthcheck',
        symbol: 'KRW-SOL',
        allocation_pct: 25,
        fee_pct: 0.05,
        slippage_pct: 0.02,
        entry: { groups: [['Z_SCORE <= -2.9', 'DROP_3M <= -1.6'], ['DROP_3M <= -2.0']] },
        takeProfit: { groups: [['Z_SCORE >= -1.8'], ['HOLD_MIN >= 5', 'PNL_PCT <= 0']] },
        stopLoss: { groups: [['PNL_PCT <= -1.8']] },
      };
      const r = await labApi.runBacktest(SEED, 28);
      if (!r.ok) return `백테스트 실패: ${r.error}`;
      const { total_return_pct, total_trades, win_rate_pct, mdd_pct } = r.result;
      return `${total_trades}건 거래, 수익률 ${total_return_pct}%, 승률 ${win_rate_pct}%, MDD ${mdd_pct}%`;
    });
  };

  const runOne = async (key, fn) => {
    try {
      const detail = await fn();
      setChecks((prev) => ({ ...prev, [key]: { status: 'ok', detail } }));
    } catch (err) {
      setChecks((prev) => ({ ...prev, [key]: { status: 'fail', detail: err.message } }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pt-6 pb-20 px-4 text-left">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-100">
              <Beaker size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                Lab
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                Backtest Builder · Preview
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
          >
            <ArrowLeft size={14} />
            coingap으로
          </Link>
        </div>

        {/* 백엔드 헬스체크 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-slate-900">백엔드 헬스체크</h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Lambda 4개 라우트가 정상 응답하는지 확인합니다.
              </p>
            </div>
            <button
              onClick={runHealthChecks}
              className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black transition-colors"
            >
              다시 실행
            </button>
          </div>

          <div className="space-y-2">
            <CheckRow label="GET /variables" check={checks.variables} />
            <CheckRow label="GET /logics/shared" check={checks.sharedLogics} />
            <CheckRow label="POST /validate" check={checks.validate} />
            <CheckRow label="POST /backtest (28일)" check={checks.backtest} />
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-violet-50 p-5 rounded-2xl border border-violet-100">
          <p className="text-xs text-violet-800 font-medium leading-relaxed">
            <strong>다음 단계:</strong> 빌더 컴포넌트(진입·익절·손절 조건 작성), 백테스트 결과 차트,
            내 로직 보관함을 차례로 추가합니다. 지금은 백엔드 연결만 확인하는 단계입니다.
          </p>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            © 2026 Asset Indicator Monitor — Lab Preview
          </p>
        </footer>
      </div>
    </div>
  );
}

function CheckRow({ label, check }) {
  const icon =
    check.status === 'ok' ? <CheckCircle2 size={18} className="text-emerald-500" /> :
    check.status === 'fail' ? <XCircle size={18} className="text-red-500" /> :
    check.status === 'loading' ? <Loader2 size={18} className="text-slate-400 animate-spin" /> :
    <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-200" />;

  const tone =
    check.status === 'ok' ? 'bg-emerald-50 border-emerald-100' :
    check.status === 'fail' ? 'bg-red-50 border-red-100' :
    'bg-slate-50 border-slate-100';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${tone}`}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-slate-700">{label}</p>
        {check.detail && (
          <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
            {check.detail}
          </p>
        )}
      </div>
    </div>
  );
}
