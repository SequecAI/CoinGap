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

export const labApi = {
  getVariables: () => _get('/variables'),
  getSharedLogics: () => _get('/logics/shared'),
  validateExpr: (expr, section = 'exit') => _post('/validate', { expr, section }),
  runBacktest: (ruleset, days = 28) => _post('/backtest', { ruleset, days }),
};
