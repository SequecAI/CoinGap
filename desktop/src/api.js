/**
 * PC 앱 → coingap Lab 백엔드 (API Gateway).
 * coingap web/mobile의 src/lab/api.js와 동일 엔드포인트를 호출하지만,
 * 인증·실행 흐름이 다르므로 별도 파일로 둔다.
 *
 * 현재 단계(C3)는 보관함 조회만. C7에서 다음이 추가됨:
 *   · 백엔드 호출 시 Authorization: Bearer <idToken> 첨부
 *   · 운영 상태 push (POST /runs/heartbeat 같은 새 엔드포인트)
 */
const API_BASE = 'https://s8qnx3ch2k.execute-api.ap-northeast-2.amazonaws.com';

async function _get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json();
}

export const labApi = {
  listMyLogics: (userId) =>
    _get(`/logics/mine?userId=${encodeURIComponent(userId)}`),
};
