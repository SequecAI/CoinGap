import React, { useRef, useState } from 'react';
import { TrendingDown, TrendingUp, ShieldX } from 'lucide-react';
import BasicSettings from './components/BasicSettings.jsx';
import VariablePalette from './components/VariablePalette.jsx';
import SectionEditor from './components/SectionEditor.jsx';
import BacktestPanel from './components/BacktestPanel.jsx';
import ResultCard from './components/ResultCard.jsx';
import MyLogicsLocker from './components/MyLogicsLocker.jsx';
import OrderStrategyCard from './components/OrderStrategyCard.jsx';
import { useVariables } from './hooks/useVariables.js';
import { useMyLogics } from './hooks/useMyLogics.js';
import { labApi } from './api.js';
import { humanizeValidationError } from './errorMessages.js';
import { logicToBuilderState } from './rulesetCodec.js';
import {
  DEFAULT_NAME,
  DEFAULT_SYMBOL,
  DEFAULT_DAYS,
  DEFAULT_PARAMS,
  DEFAULT_ENTRY_ORDER,
  DEFAULT_TAKE_PROFIT_ORDER,
  DEFAULT_STOP_LOSS_ORDER,
} from './constants.js';

const emptyCond = () => ({ lhs: '', op: '<=', rhs: '' });
const emptyGroups = () => [[emptyCond()]];

/**
 * 섹션 메타. 룰셋 스키마의 entry / takeProfit / stopLoss와 1:1 매핑된다.
 * ctx는 백엔드 /validate의 컨텍스트 (entry는 시장·수학 변수, exit는 + 포지션 변수).
 */
const SECTIONS = [
  {
    key: 'entry',
    title: '진입 조건',
    ctx: 'entry',
    tone: 'blue',
    icon: TrendingDown,
    desc: '이 조건을 만족하면 매수합니다.',
  },
  {
    key: 'takeProfit',
    title: '익절 조건',
    ctx: 'exit',
    tone: 'emerald',
    icon: TrendingUp,
    desc: '보유 중 이 조건을 만족하면 매도(이익 실현)합니다.',
  },
  {
    key: 'stopLoss',
    title: '손절 조건',
    ctx: 'exit',
    tone: 'rose',
    icon: ShieldX,
    desc: '보유 중 이 조건을 만족하면 매도(손실 제한)합니다.',
  },
];

const initialSections = () => ({
  entry: emptyGroups(),
  takeProfit: emptyGroups(),
  stopLoss: emptyGroups(),
});

const initialErrors = () => ({
  entry: {},
  takeProfit: {},
  stopLoss: {},
});

/**
 * 빌더 메인. 룰셋 전체 상태(이름·종목·기간·params·3섹션)를 보유한다.
 * 단계 6: 3섹션 동시 표시. 단계 7: 백테스트 실행 / 결과 카드. 단계 8: 보관함.
 *
 * props.isLoggedIn / props.userInfo는 LabPage에서 useAuth로 받아 내려준다.
 * 보관함(8c)은 로그인 시에만 노출되며, userInfo.userId(Google sub)를
 * 그대로 DynamoDB PK로 사용한다.
 */
export default function Builder({ isLoggedIn = false, userInfo = null }) {
  const [name, setName] = useState(DEFAULT_NAME);
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [sections, setSections] = useState(initialSections);
  const [errors, setErrors] = useState(initialErrors);
  const [entryOrder, setEntryOrder] = useState(DEFAULT_ENTRY_ORDER);
  const [takeProfitOrder, setTakeProfitOrder] = useState(DEFAULT_TAKE_PROFIT_ORDER);
  const [stopLossOrder, setStopLossOrder] = useState(DEFAULT_STOP_LOSS_ORDER);

  // 백테스트 실행 상태
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState(null);

  const { variables, loading: varsLoading, error: varsError } = useVariables();
  const focusedRef = useRef(null); // { sec, gi, ci, side }

  // 내 로직 보관함 (DynamoDB)
  const userId = userInfo?.userId || null;
  const {
    logics: myLogics,
    limit: slotLimit,
    loading: locckerLoading,
    error: lockerError,
    slotFull,
    dismissSlotFull,
    save: saveLogic,
    remove: removeLogic,
  } = useMyLogics(userId);

  // 슬롯 가득 모달에서 "삭제 후 재시도"를 위해, 마지막으로 시도한 logic을 보관.
  const pendingSaveRef = useRef(null);

  const handleBasic = (key, value) => {
    if (key === 'name') setName(value);
    else if (key === 'symbol') setSymbol(value);
    else if (key === 'days') setDays(value);
    else if (key === 'params') setParams(value);
  };

  const handleOrderStrategy = (which, next) => {
    if (which === 'entry') setEntryOrder(next);
    else if (which === 'takeProfit') setTakeProfitOrder(next);
    else if (which === 'stopLoss') setStopLossOrder(next);
  };

  const updateCond = (sec, gi, ci, next) => {
    setSections((prev) => ({
      ...prev,
      [sec]: prev[sec].map((group, gIdx) =>
        gIdx === gi ? group.map((c, cIdx) => (cIdx === ci ? next : c)) : group
      ),
    }));
  };

  const addCond = (sec, gi) => {
    let newCi = 0;
    setSections((prev) => {
      newCi = prev[sec][gi].length; // 새 row의 인덱스
      return {
        ...prev,
        [sec]: prev[sec].map((group, gIdx) => (gIdx === gi ? [...group, emptyCond()] : group)),
      };
    });
    focusCoord(`${sec}-${gi}-${newCi}-lhs`);
  };

  const removeCond = (sec, gi, ci) => {
    setSections((prev) => {
      let nextGroups = prev[sec].map((group, gIdx) =>
        gIdx === gi ? group.filter((_, cIdx) => cIdx !== ci) : group
      );
      nextGroups = nextGroups.filter((g) => g.length > 0);
      if (nextGroups.length === 0) nextGroups = emptyGroups();
      return { ...prev, [sec]: nextGroups };
    });
    // 인덱스 재정렬 단순화: 해당 섹션 에러만 비움 (다음 blur에 다시 채워짐).
    setErrors((prev) => ({ ...prev, [sec]: {} }));
  };

  const addGroup = (sec) => {
    let newGi = 0;
    setSections((prev) => {
      newGi = prev[sec].length; // 새 그룹의 인덱스
      return {
        ...prev,
        [sec]: [...prev[sec], [emptyCond()]],
      };
    });
    focusCoord(`${sec}-${newGi}-0-lhs`);
  };

  const removeGroup = (sec, gi) => {
    setSections((prev) => {
      const next = prev[sec].filter((_, gIdx) => gIdx !== gi);
      return { ...prev, [sec]: next.length > 0 ? next : emptyGroups() };
    });
    setErrors((prev) => ({ ...prev, [sec]: {} }));
  };

  const condFocus = (sec, gi, ci, side) => {
    focusedRef.current = { sec, gi, ci, side };
  };

  // 새로 추가된 조건/그룹의 lhs input으로 포커스 이동.
  // setState → DOM 반영 한 프레임 미룬 뒤 querySelector로 잡는다.
  const focusCoord = (coord) => {
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-cond-coord="${coord}"]`);
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const condBlur = async (sec, ctx, gi, ci, cond) => {
    const key = `${gi}-${ci}`;
    if (!cond.lhs.trim() || !cond.rhs.trim()) {
      setErrors((prev) => ({
        ...prev,
        [sec]: { ...prev[sec], [key]: null },
      }));
      return;
    }
    const expr = `${cond.lhs} ${cond.op} ${cond.rhs}`;
    try {
      const r = await labApi.validateExpr(expr, ctx);
      const msg = r.ok ? null : humanizeValidationError(r.error, ctx, variables);
      setErrors((prev) => ({
        ...prev,
        [sec]: { ...prev[sec], [key]: msg },
      }));
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [sec]: { ...prev[sec], [key]: `검증 호출 실패: ${e.message || e}` },
      }));
    }
  };

  // 룰셋 빌드: 현재 빌더 상태 → 백엔드 /backtest body의 ruleset 형태.
  // entry_order/exit_order는 실거래 시 PC 엔진이 사용. 백테스트는 무시.
  const buildRuleset = () => ({
    name,
    symbol,
    allocation_pct: Number(params.allocation_pct),
    fee_pct: Number(params.fee_pct),
    slippage_pct: Number(params.slippage_pct),
    entry: { groups: sections.entry.map((g) => g.map(condToStr)) },
    takeProfit: { groups: sections.takeProfit.map((g) => g.map(condToStr)) },
    stopLoss: { groups: sections.stopLoss.map((g) => g.map(condToStr)) },
    entry_order: entryOrder,
    takeProfit_order: takeProfitOrder,
    stopLoss_order: stopLossOrder,
  });

  const handleRunBacktest = async () => {
    setRunning(true);
    setResult(null);
    setRunError(null);
    try {
      const r = await labApi.runBacktest(buildRuleset(), days);
      if (r.ok) setResult(r.result);
      else setRunError(r.error);
    } catch (e) {
      setRunError(e.message || String(e));
    } finally {
      setRunning(false);
    }
  };

  // 현재 빌더 상태 → DynamoDB에 저장할 dict.
  // 룰셋 + 기간(days) + 백테스트 결과 스냅샷(있으면) 포함.
  const buildLogicForSave = () => ({
    ...buildRuleset(),
    days,
    backtest: result || undefined,
  });

  const handleSaveCurrent = async () => {
    const logic = buildLogicForSave();
    pendingSaveRef.current = logic;
    const res = await saveLogic(logic);
    if (res?.ok) pendingSaveRef.current = null;
  };

  const handleDeleteAndRetry = async (logicId) => {
    const ok = await removeLogic(logicId);
    if (!ok) return;
    dismissSlotFull();
    // 직전에 시도하던 저장을 재실행
    const pending = pendingSaveRef.current;
    if (pending) {
      await saveLogic(pending);
      pendingSaveRef.current = null;
    }
  };

  const handleLoadLogic = (logic) => {
    const next = logicToBuilderState(logic);
    setName(next.name);
    setSymbol(next.symbol);
    setDays(next.days);
    setParams(next.params);
    setSections(next.sections);
    setEntryOrder(next.entryOrder);
    setTakeProfitOrder(next.takeProfitOrder);
    setStopLossOrder(next.stopLossOrder);
    setErrors(initialErrors());
    // 저장 시점에 함께 저장된 백테스트 결과 스냅샷이 있으면 그것도 복원.
    setResult(logic?.backtest || null);
    setRunError(null);
    // 페이지 상단으로 스크롤 (불러왔다는 시각적 피드백)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 공유 로직 가져오기: 현재 빌더에 내용이 있으면 확인을 받고 덮어쓴다.
  const handleApplyShared = (logic) => {
    const builderHasContent =
      name !== DEFAULT_NAME ||
      sections.entry.some((g) => g.some((c) => c.lhs || c.rhs)) ||
      sections.takeProfit.some((g) => g.some((c) => c.lhs || c.rhs)) ||
      sections.stopLoss.some((g) => g.some((c) => c.lhs || c.rhs));
    if (builderHasContent) {
      const ok = window.confirm(
        `현재 빌더 내용을 "${logic.name}" 로직으로 덮어씁니다. 진행할까요?`
      );
      if (!ok) return;
    }
    handleLoadLogic(logic);
  };
  // 공유 로직은 이제 커뮤니티 "로직 랭킹" 탭에서 직접 가져온다.
  // (이전의 SharedLogicsPanel은 제거됨)

  // 변수 팔레트 클릭 → 마지막 포커스 칸 끝에 토큰 추가.
  const handleInsertToken = (token) => {
    const f = focusedRef.current;
    if (!f) return;
    setSections((prev) => ({
      ...prev,
      [f.sec]: prev[f.sec].map((group, gIdx) => {
        if (gIdx !== f.gi) return group;
        return group.map((c, cIdx) => {
          if (cIdx !== f.ci) return c;
          return { ...c, [f.side]: (c[f.side] || '') + token };
        });
      }),
    }));
  };

  return (
    <div className="space-y-5">
      <BasicSettings
        name={name}
        symbol={symbol}
        days={days}
        params={params}
        onChange={handleBasic}
      />

      <OrderStrategyCard
        entryOrder={entryOrder}
        takeProfitOrder={takeProfitOrder}
        stopLossOrder={stopLossOrder}
        onChange={handleOrderStrategy}
      />

      <VariablePalette
        variables={variables}
        loading={varsLoading}
        error={varsError}
        onInsert={handleInsertToken}
      />

      {SECTIONS.map((s) => {
        const Icon = s.icon;
        return (
          <SectionEditor
            key={s.key}
            title={s.title}
            icon={<Icon size={16} />}
            tone={s.tone}
            desc={s.desc}
            sectionKey={s.key}
            groups={sections[s.key]}
            errors={errors[s.key]}
            onChangeCond={(gi, ci, next) => updateCond(s.key, gi, ci, next)}
            onAddCond={(gi) => addCond(s.key, gi)}
            onRemoveCond={(gi, ci) => removeCond(s.key, gi, ci)}
            onAddGroup={() => addGroup(s.key)}
            onRemoveGroup={(gi) => removeGroup(s.key, gi)}
            onFocus={(gi, ci, side) => condFocus(s.key, gi, ci, side)}
            onBlur={(gi, ci, cond) => condBlur(s.key, s.ctx, gi, ci, cond)}
          />
        );
      })}

      <BacktestPanel
        running={running}
        error={runError}
        symbol={symbol}
        days={days}
        onRun={handleRunBacktest}
      />

      {result && <ResultCard result={result} />}

      <MyLogicsLocker
        isLoggedIn={isLoggedIn}
        userInfo={userInfo}
        logics={myLogics}
        limit={slotLimit}
        loading={locckerLoading}
        error={lockerError}
        onSaveCurrent={handleSaveCurrent}
        onLoad={handleLoadLogic}
        onDelete={removeLogic}
        slotFull={slotFull}
        onDismissSlotFull={dismissSlotFull}
        onDeleteAndRetry={handleDeleteAndRetry}
      />

      {/* 다음 단계: 공유 로직 import (단계 9) */}

      {/* 개발 보조: 현재 룰셋 상태 (단계 8에서 제거) */}
      <details className="bg-slate-50 border border-slate-200 rounded-xl p-3">
        <summary className="text-[10px] font-black text-slate-400 uppercase tracking-wider cursor-pointer select-none">
          현재 룰셋 (개발 중)
        </summary>
        <pre className="mt-2 text-[10px] font-mono text-slate-600 overflow-x-auto">
{JSON.stringify({ ...buildRuleset(), days }, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function condToStr(c) {
  return `${c.lhs} ${c.op} ${c.rhs}`.trim();
}
