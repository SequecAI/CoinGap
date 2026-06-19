/**
 * Electron 메인 프로세스.
 * - 브라우저 윈도우 생성
 * - dev 모드: Vite dev 서버를 로드, prod: dist/index.html 로드
 * - sandbox + contextIsolation + nodeIntegration 비활성 (보안 기본값 강제)
 *
 * Phase C 이후로 추가될 책임:
 *   · safeStorage 기반 API 키 저장 IPC (C4)
 *   · 거래 엔진 워커 spawn / 제어 (C5~C6)
 *   · LabRuns push 스케줄러 (C7)
 *   · OAuth loopback 서버 (C2)
 */
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

const isDev = !!process.env.ELECTRON_RENDERER_URL;

// .env 로드 (Google Client ID/Secret 등). 패키지 dependency 없이 동작.
// dev: desktop/.env, prod: 인스톨러가 풀어둔 resources/.env
{
  const candidates = isDev
    ? [path.join(__dirname, '..', '.env')]
    : [
        path.join(process.resourcesPath, '.env'),
        path.join(__dirname, '..', '.env'), // 폴백
      ];
  try {
    const fs = require('fs');
    for (const envPath of candidates) {
      if (!fs.existsSync(envPath)) continue;
      const text = fs.readFileSync(envPath, 'utf8');
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
      break; // 첫 번째 발견된 .env만 사용
    }
  } catch (e) {
    console.warn('[main] .env load skipped:', e.message);
  }
}

const { loginWithGoogle } = require('./oauth');
const keystore = require('./keystore');
const authstore = require('./authstore');
const upbit = require('./upbit');
const { EngineService } = require('./engine');

const engine = new EngineService();

// 종료 시 LabRuns 항목을 직접 DELETE — renderer의 useRunSync가 처리하기 전에
// 창이 파괴되는 경우 백엔드에 stale 상태가 남는 걸 막는다.
const BACKEND_BASE = 'https://s8qnx3ch2k.execute-api.ap-northeast-2.amazonaws.com';
async function deleteRunStateForCurrentUser() {
  try {
    const auth = authstore.load();
    const userId = auth?.userInfo?.userId;
    if (!userId) return;
    await fetch(
      `${BACKEND_BASE}/runs/state?userId=${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
  } catch (e) {
    console.warn('[main] deleteRunState on shutdown failed:', e.message);
  }
}

// 메인 프로세스의 unhandled exception/rejection이 다이얼로그로 떠 사용자를 놀라게 하지 않도록 콘솔로만 기록.
// (특히 창을 닫는 순간 in-flight tick의 fetch reject가 발생하기 쉬움)
process.on('uncaughtException', (e) => {
  console.error('[main] uncaughtException:', e);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason);
});

ipcMain.handle('auth:start', async () => {
  const clientId = process.env.GOOGLE_DESKTOP_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DESKTOP_CLIENT_SECRET;
  if (!clientId) {
    throw new Error(
      'GOOGLE_DESKTOP_CLIENT_ID가 설정되지 않았습니다. desktop/.env 파일을 확인하세요.'
    );
  }
  return loginWithGoogle({ clientId, clientSecret });
});

ipcMain.handle('auth:load', () => authstore.load());
ipcMain.handle('auth:save', (_e, data) => { authstore.save(data); return { ok: true }; });
ipcMain.handle('auth:clear', () => { authstore.clear(); return { ok: true }; });

// ─── API 키 IPC ─────────────────────────────────────────
ipcMain.handle('keys:status', () => keystore.loadKeysMasked());

ipcMain.handle('keys:save', async (_e, { access, secret }) => {
  keystore.saveKeys(access, secret);
  // 저장 직후 즉시 검증 — 잘못된 키면 던져서 renderer가 처리.
  const accounts = await upbit.getAccounts(access, secret);
  return {
    masked: keystore.loadKeysMasked(),
    summary: summarizeAccounts(accounts),
  };
});

ipcMain.handle('keys:test', async () => {
  const keys = keystore.loadKeysPlain();
  if (!keys) throw new Error('저장된 API 키가 없습니다.');
  const accounts = await upbit.getAccounts(keys.access, keys.secret);
  return summarizeAccounts(accounts);
});

ipcMain.handle('keys:clear', () => {
  keystore.clearKeys();
  return { exists: false };
});

// ─── 엔진 IPC ───────────────────────────────────────────
ipcMain.handle('engine:start', async (_e, { logic, options }) => {
  await engine.start(logic, options || {});
  return engine.status();
});
ipcMain.handle('engine:stop', () => {
  engine.stop();
  return engine.status();
});
ipcMain.handle('engine:status', () => engine.status());
ipcMain.handle('engine:remote', async (_e, { command }) => engine.handleRemoteCommand(command));

function summarizeAccounts(accounts) {
  let krw = 0;
  let assetCount = 0;
  let totalAssetKrwEstimate = 0;
  for (const a of accounts || []) {
    const bal = parseFloat(a.balance || '0');
    const locked = parseFloat(a.locked || '0');
    const total = bal + locked;
    if (a.currency === 'KRW') {
      krw = total;
    } else if (total > 0) {
      assetCount += 1;
      const avgBuy = parseFloat(a.avg_buy_price || '0');
      totalAssetKrwEstimate += total * avgBuy;
    }
  }
  return {
    krw,
    assetCount,
    // 평균 매수가 기준 추정치 (현재가 X). UI에 "평가 추정"으로 표기.
    totalAssetKrwEstimate,
    totalCount: (accounts || []).length,
  };
}

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'CoinGap Desktop',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // 외부 링크는 OS 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow = win;
  engine.setWindow(win);
  // 'close'는 파괴 직전. 엔진 timer 정리 + 백엔드 LabRuns DELETE까지 끝내고 destroy.
  // preventDefault 후 cleanup → destroy 패턴으로 안전하게 정리.
  let cleaningUp = false;
  win.on('close', (e) => {
    if (cleaningUp) return;
    if (engine.state === 'running') engine.stop();
    e.preventDefault();
    cleaningUp = true;
    deleteRunStateForCurrentUser().finally(() => {
      try { win.destroy(); } catch {}
    });
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

// 앱 종료 직전에도 엔진을 한 번 더 정리 + DELETE (close 이벤트가 누락되는 종료 경로 안전망)
app.on('before-quit', () => {
  if (engine.state === 'running') engine.stop();
  // fire-and-forget — quit을 막을 수 없음 (close에서 이미 처리되는 게 정상 흐름)
  deleteRunStateForCurrentUser();
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
