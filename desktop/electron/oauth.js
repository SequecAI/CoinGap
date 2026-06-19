/**
 * Google OAuth — Desktop loopback flow (RFC 8252).
 *
 * 절차:
 *  1) 임시 http 서버를 127.0.0.1 임의 포트에 띄움
 *  2) shell.openExternal로 OS 기본 브라우저를 열어 Google 인증 화면 표시
 *     (Electron BrowserWindow를 쓰면 Google이 User-Agent 기준으로 거부함)
 *  3) 사용자 인증 → 콜백 ?code=... 수신 → PKCE verifier로 token 교환
 *  4) id_token 디코드해서 userInfo 구성, 임시 서버 종료
 *
 * Desktop OAuth는 "public client"라 client_secret이 비밀이 아니지만,
 * Google 표준 흐름은 여전히 secret 전송을 요구한다 (+ PKCE 권장).
 */
const http = require('http');
const crypto = require('crypto');
const { shell } = require('electron');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TIMEOUT_MS = 5 * 60 * 1000; // 5분 안에 인증 안 끝나면 취소

function b64url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function decodeIdToken(token) {
  const payload = token.split('.')[1];
  const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(json);
}

function htmlPage(message, success) {
  const color = success ? '#10b981' : '#ef4444';
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>CoinGap Desktop</title>
<style>
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:1rem;padding:2.5rem 3rem;
box-shadow:0 1px 3px rgba(0,0,0,.06);text-align:center;max-width:380px}
.icon{width:48px;height:48px;border-radius:9999px;background:${color}22;color:${color};
display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;margin:0 auto 1rem}
h1{font-size:1rem;margin:0 0 .5rem;color:#0f172a;font-weight:900}
p{font-size:.8125rem;color:#64748b;margin:0;line-height:1.5}
small{display:block;margin-top:1.5rem;font-size:.6875rem;color:#94a3b8}
</style></head><body><div class="card">
<div class="icon">${success ? '✓' : '!'}</div>
<h1>CoinGap Desktop</h1><p>${message}</p>
<small>이 탭은 닫으셔도 됩니다.</small>
</div></body></html>`;
}

/**
 * @param {{clientId:string, clientSecret?:string}} opts
 * @returns {Promise<{idToken:string, accessToken:string, refreshToken?:string, userInfo:object}>}
 */
function loginWithGoogle({ clientId, clientSecret }) {
  return new Promise((resolve, reject) => {
    const { verifier, challenge } = pkce();
    const state = b64url(crypto.randomBytes(16));
    let done = false;
    const finish = (err, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { server.close(); } catch {}
      err ? reject(err) : resolve(value);
    };

    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://127.0.0.1`);
        if (url.pathname !== '/callback') {
          res.writeHead(404).end();
          return;
        }
        const error = url.searchParams.get('error');
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(htmlPage(`로그인이 취소되었습니다: ${error}`, false));
          finish(new Error(error));
          return;
        }
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        if (!code || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(htmlPage('인증 응답이 잘못되었습니다 (state mismatch).', false));
          finish(new Error('Invalid callback'));
          return;
        }

        const port = server.address().port;
        const redirectUri = `http://127.0.0.1:${port}/callback`;
        const body = new URLSearchParams({
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        });
        if (clientSecret) body.set('client_secret', clientSecret);

        const tokenRes = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const tokenJson = await tokenRes.json();
        if (!tokenJson.id_token) {
          const msg = tokenJson.error_description || tokenJson.error || JSON.stringify(tokenJson);
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(htmlPage(`토큰 교환 실패: ${msg}`, false));
          finish(new Error(`Token exchange failed: ${msg}`));
          return;
        }

        const payload = decodeIdToken(tokenJson.id_token);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlPage('로그인 성공! CoinGap Desktop 창으로 돌아가주세요.', true));
        finish(null, {
          idToken: tokenJson.id_token,
          accessToken: tokenJson.access_token,
          refreshToken: tokenJson.refresh_token,
          userInfo: {
            userId: payload.sub,
            email: payload.email,
            nickname: payload.name || (payload.email ? payload.email.split('@')[0] : '사용자'),
            profileImage: payload.picture || '',
          },
        });
      } catch (e) {
        try { res.writeHead(500).end(); } catch {}
        finish(e);
      }
    });

    server.on('error', (e) => finish(e));

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      const url = new URL(AUTH_URL);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'select_account');
      shell.openExternal(url.toString());
    });

    const timer = setTimeout(() => finish(new Error('Login timeout (5분 초과)')), TIMEOUT_MS);
  });
}

module.exports = { loginWithGoogle };
