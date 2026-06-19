/**
 * Upbit 인증 호출 헬퍼 (메인 프로세스 전용).
 *
 * - JWT(HS256) 서명을 Node crypto만으로 구현. 외부 패키지 의존 X.
 * - 쿼리 파라미터가 있는 호출(예: 주문)은 query_hash 추가. /v1/accounts는 GET이라 불필요.
 * - 메인에서만 호출 — renderer는 secret을 모름.
 *
 * Upbit JWT payload:
 *   { access_key, nonce, [query_hash, query_hash_alg='SHA512'] }
 */
const crypto = require('crypto');

const UPBIT_BASE = 'https://api.upbit.com';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const head = b64url(JSON.stringify({ typ: 'JWT', alg: 'HS256' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(
    crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest()
  );
  return `${head}.${body}.${sig}`;
}

function authHeader(access, secret, queryString = '') {
  const payload = {
    access_key: access,
    nonce: crypto.randomUUID(),
  };
  if (queryString) {
    payload.query_hash = crypto.createHash('sha512').update(queryString).digest('hex');
    payload.query_hash_alg = 'SHA512';
  }
  return `Bearer ${signJwt(payload, secret)}`;
}

/**
 * Upbit query_hash 입력용 query string.
 *
 * Upbit 공식 Python 예제는 unquote(urlencode(...))로 URL 인코딩을 다시 풀고
 * 입력 순서를 그대로 유지한 raw 형태(예: "market=KRW-SOL&side=bid&...")를 SHA512 한다.
 * 인코딩이 남아있거나 키를 정렬하면 서버가 받은 body로 재계산한 hash와 어긋나
 * "Jwt의 query를 검증하는데 실패하였습니다" 에러가 난다.
 */
function buildQueryString(params) {
  return Object.keys(params)
    .filter((k) => params[k] != null && params[k] !== '')
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

async function _readError(res) {
  let detail = `HTTP ${res.status}`;
  try {
    const j = await res.json();
    detail = j?.error?.message || j?.error?.name || JSON.stringify(j);
  } catch {}
  return detail;
}

/**
 * 계정 잔고 조회. 키 유효성 검증 + 잔고 표시에 같이 사용.
 * 성공: 계정 배열 그대로 반환.
 */
async function getAccounts(access, secret) {
  const res = await fetch(`${UPBIT_BASE}/v1/accounts`, {
    headers: { Authorization: authHeader(access, secret) },
  });
  if (!res.ok) throw new Error(`업비트 계정 조회 실패: ${await _readError(res)}`);
  return res.json();
}

/**
 * 시장가 주문.
 *   buy(시장가 매수): { side:'bid', ord_type:'price', price:'KRW금액(문자열)' }
 *   sell(시장가 매도): { side:'ask', ord_type:'market', volume:'수량(문자열)' }
 * Upbit는 body 파라미터들을 그대로 query string으로 만든 후 SHA512 → query_hash로 서명.
 * Content-Type은 application/json.
 */
async function placeOrder(access, secret, params) {
  const query = buildQueryString(params);
  const res = await fetch(`${UPBIT_BASE}/v1/orders`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(access, secret, query),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`업비트 주문 실패: ${await _readError(res)}`);
  return res.json();
}

/** 주문 단건 조회. 시장가 주문 직후 체결가/체결량 확인용. */
async function getOrder(access, secret, uuid) {
  const params = { uuid };
  const query = buildQueryString(params);
  const res = await fetch(`${UPBIT_BASE}/v1/order?${query}`, {
    headers: { Authorization: authHeader(access, secret, query) },
  });
  if (!res.ok) throw new Error(`업비트 주문 조회 실패: ${await _readError(res)}`);
  return res.json();
}

module.exports = { authHeader, getAccounts, placeOrder, getOrder };
