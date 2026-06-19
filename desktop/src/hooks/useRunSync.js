import { useEffect, useRef } from 'react';

/**
 * 엔진 상태를 클라우드(LabRuns)에 주기적으로 push.
 * - 매 tick 직후 (engine.context 변화 감지) → PUT /runs/state
 * - state === 'stopped' 또는 logout 시 → DELETE /runs/state
 * - userId가 없으면 아무 것도 안 함
 *
 * 보안: 첫 버전은 logics CRUD와 동일하게 userId만 body로 보냄.
 * 향후 id_token 검증으로 강화 가능.
 */
const API_BASE = 'https://s8qnx3ch2k.execute-api.ap-northeast-2.amazonaws.com';

export function useRunSync(userId, engineState, engineContext) {
  const lastSentRef = useRef('');
  const lastStateRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    // 상태 정지 시: DELETE
    if (engineState === 'idle' && lastStateRef.current !== 'idle') {
      // idle은 시작 전 상태. 한 번도 안 켰으면 push 안 함.
      // 켜진 적 있으면 (lastSentRef 있음) DELETE
      if (lastSentRef.current) {
        deleteState(userId).catch(() => {});
        lastSentRef.current = '';
      }
    } else if (engineState === 'stopped') {
      // 중지 — DynamoDB 항목 삭제 (모바일은 "운영 중 아님" 표시)
      if (lastSentRef.current) {
        deleteState(userId).catch(() => {});
        lastSentRef.current = '';
      }
    } else if (engineState === 'running' && engineContext) {
      // 직렬화: 같은 상태를 두 번 push하지 않도록 간단 diff
      const payload = buildPayload(engineContext);
      const fingerprint = JSON.stringify(payload);
      if (fingerprint !== lastSentRef.current) {
        putState(userId, payload).catch((e) => {
          console.warn('[runSync] put failed:', e.message);
        });
        lastSentRef.current = fingerprint;
      }
    }
    lastStateRef.current = engineState;
  }, [userId, engineState, engineContext]);
}

function buildPayload(ctx) {
  // DynamoDB는 float OK (Decimal 변환은 Lambda에서). 다만 항목 크기 제한 400KB라
  // trades는 최근 50개만, lastEval.market만 보냄 (전체 market_state는 작음).
  return {
    state: ctx.state,
    mode: ctx.mode,
    limits: ctx.limits || null,
    logicId: ctx.logicId || null,
    logicName: ctx.logicName || '',
    symbol: ctx.symbol || '',
    startedAt: ctx.startedAt || null,
    ticks: ctx.ticks || 0,
    initialCash: ctx.initialCash || 0,
    cash: ctx.cash || 0,
    positionValue: ctx.positionValue || 0,
    equity: ctx.equity || 0,
    returnPct: ctx.returnPct || 0,
    position: ctx.position || null,
    lastEval: ctx.lastEval ? {
      timestamp: ctx.lastEval.timestamp,
      action: ctx.lastEval.action,
      market: ctx.lastEval.market,
      position: ctx.lastEval.position || null,
    } : null,
    lastError: ctx.lastError || null,
    tradeCount: ctx.tradeCount || 0,
    trades: (ctx.trades || []).slice(-50),
    dailyLoss: ctx.dailyLoss || 0,
    dailyLossDate: ctx.dailyLossDate || null,
    tradingBlocked: !!ctx.tradingBlocked,
    blockReason: ctx.blockReason || null,
  };
}

async function putState(userId, state) {
  const res = await fetch(`${API_BASE}/runs/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, state }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function deleteState(userId) {
  const res = await fetch(`${API_BASE}/runs/state?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
