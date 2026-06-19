/**
 * Lab 백엔드 API 클라이언트.
 * AWS API Gateway → Lambda (coingap-backtest).
 * 기존 coingap 백엔드(/users, /posts)와는 완전 분리된 인스턴스.
 */

const API_BASE = 'https://s8qnx3ch2k.execute-api.ap-northeast-2.amazonaws.com';

async function _get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json();
}

async function _post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json();
}

async function _delete(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json();
}

export const labApi = {
  getVariables: () => _get('/variables'),
  // 공유 로직은 이제 커뮤니티(/posts?type=logic)에서 받는다. /logics/shared 제거됨.
  validateExpr: (expr, section = 'exit') => _post('/validate', { expr, section }),
  runBacktest: (ruleset, days = 28) => _post('/backtest', { ruleset, days }),

  // 내 로직 보관함 (사용자 인증 필요)
  listMyLogics: (userId) => _get(`/logics/mine?userId=${encodeURIComponent(userId)}`),
  saveLogic: (userId, logic) => _post('/logics', { userId, logic }),
  // saveLogic은 슬롯 가득 시 HTTP 409로 응답 — 호출부에서 res.ok=false + error=slot_full 처리.
  // 위 _post는 !res.ok에서 throw하므로 saveLogic은 별도 처리:
  saveLogicSafe: async (userId, logic) => {
    const res = await fetch(`${API_BASE}/logics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, logic }),
    });
    return res.json(); // 409여도 본문은 정상 JSON
  },
  deleteLogic: (userId, logicId) =>
    _delete(`/logics/${encodeURIComponent(logicId)}?userId=${encodeURIComponent(userId)}`),

  // PC 앱이 push한 현재 운영 상태. 없으면 state=null.
  getRunState: (userId) => _get(`/runs/state?userId=${encodeURIComponent(userId)}`),

  // 기간별 거래 내역. fromIso/toIso는 ISO8601 UTC. 누락 시 전체 범위.
  getTrades: (userId, fromIso, toIso) => {
    const qp = new URLSearchParams({ userId });
    if (fromIso) qp.set('from', fromIso);
    if (toIso) qp.set('to', toIso);
    return _get(`/trades?${qp.toString()}`);
  },

  // 원격 제어 명령 발행 (PC 앱이 GET /runs/control로 폴링해 처리).
  // command: 'stop' 또는 { action: 'start', logicId, logic }
  setControlCommand: (userId, command) => {
    return fetch(`${API_BASE}/runs/control`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, command }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  },
};
