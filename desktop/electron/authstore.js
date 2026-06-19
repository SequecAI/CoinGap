/**
 * 로그인 세션을 메인 프로세스의 userData 폴더 파일에 저장.
 * prod 빌드의 file:// origin은 세션마다 새 partition을 받아 localStorage가
 * 유지되지 않으므로, 영구 유지를 위해 IPC + 디스크 파일 방식으로 옮긴다.
 *
 * 파일 위치: <userData>/auth.json
 * 내용: { userInfo, idToken, accessToken, refreshToken? }
 *
 * 시크릿 수준이 그렇게 높지 않아 평문 JSON으로 두지만, 파일 권한은 0o600.
 * 더 강화하려면 keystore와 동일하게 safeStorage로 암호화해도 무방.
 */
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function filePath() {
  return path.join(app.getPath('userData'), 'auth.json');
}

function load() {
  try {
    const p = filePath();
    if (!fs.existsSync(p)) return null;
    const text = fs.readFileSync(p, 'utf8');
    return JSON.parse(text);
  } catch (e) {
    console.warn('[authstore] load failed:', e.message);
    return null;
  }
}

function save(data) {
  try {
    fs.writeFileSync(filePath(), JSON.stringify(data), { mode: 0o600 });
  } catch (e) {
    console.warn('[authstore] save failed:', e.message);
  }
}

function clear() {
  try {
    const p = filePath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (e) {
    console.warn('[authstore] clear failed:', e.message);
  }
}

module.exports = { load, save, clear };
