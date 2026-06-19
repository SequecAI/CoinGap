/**
 * 업비트 API 키 영구 저장소.
 *
 * - Electron safeStorage가 OS에 위임해 암호화 (Windows DPAPI / macOS Keychain / Linux libsecret).
 * - 암호문은 app.getPath('userData')/upbit-keys.bin에 저장.
 * - 평문은 디스크에 절대 닿지 않으며, 메인 프로세스 내에서만 일시적으로 복호된다.
 * - renderer는 secret 평문을 결코 받지 못한다 (load는 access만 반환, 검증·서명은 메인에서).
 *
 * HANDOFF 결정사항 1: "개인 거래소 API 키는 서버에 절대 수집·저장 안 함." 그대로 준수.
 */
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

function filePath() {
  return path.join(app.getPath('userData'), 'upbit-keys.bin');
}

function ensureAvailable() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      '이 OS에서 안전한 키 저장(safeStorage)이 사용 불가합니다. ' +
      '(Linux의 경우 secret service가 필요할 수 있습니다)'
    );
  }
}

/** access/secret을 암호화해 디스크에 저장. 같은 파일을 덮어쓴다. */
function saveKeys(access, secret) {
  ensureAvailable();
  const trimmed = {
    access: String(access || '').trim(),
    secret: String(secret || '').trim(),
  };
  if (!trimmed.access || !trimmed.secret) {
    throw new Error('access/secret이 비어 있습니다.');
  }
  const buf = safeStorage.encryptString(JSON.stringify(trimmed));
  fs.writeFileSync(filePath(), buf, { mode: 0o600 });
}

/** 메인 프로세스 내부용. 평문 access/secret 반환. */
function loadKeysPlain() {
  const p = filePath();
  if (!fs.existsSync(p)) return null;
  ensureAvailable();
  const buf = fs.readFileSync(p);
  const text = safeStorage.decryptString(buf);
  const { access, secret } = JSON.parse(text);
  return { access, secret };
}

/** renderer 노출용. 마스킹된 access만 + 저장 여부. secret은 절대 노출 안 함. */
function loadKeysMasked() {
  const keys = loadKeysPlain();
  if (!keys) return { exists: false };
  return {
    exists: true,
    accessMasked: maskAccess(keys.access),
  };
}

function clearKeys() {
  const p = filePath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function maskAccess(s) {
  if (!s) return '';
  if (s.length <= 8) return '*'.repeat(s.length);
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

module.exports = { saveKeys, loadKeysPlain, loadKeysMasked, clearKeys };
