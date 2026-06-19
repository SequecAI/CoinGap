/**
 * Renderer ↔ Main bridge.
 * 모든 Node API는 메인에서 처리하고, renderer에는 좁은 API 표면만 노출한다.
 *
 * 다음 단계에서 채워질 IPC 채널:
 *   coingap.auth.startLogin()    → 메인이 loopback 서버 띄움 (C2)
 *   coingap.keys.save({ access, secret })  → safeStorage 암호화 후 저장 (C4)
 *   coingap.keys.test()          → /v1/accounts 호출로 검증 (C4)
 *   coingap.engine.start(logic)  → 실행 엔진 시작 (C5)
 *   coingap.engine.stop(runId)
 *   coingap.engine.subscribe(cb) → 실시간 상태 push
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coingap', {
  app: {
    version: '1.0.0',
    platform: process.platform,
  },
  auth: {
    // 메인 프로세스가 OS 브라우저를 띄우고 OAuth 콜백을 처리한다.
    // 성공 시 { idToken, accessToken, refreshToken?, userInfo } 반환.
    start: () => ipcRenderer.invoke('auth:start'),
    // userData 폴더의 auth.json에 영구 저장/조회 (prod file:// 환경에서도 유지).
    load: () => ipcRenderer.invoke('auth:load'),
    save: (data) => ipcRenderer.invoke('auth:save', data),
    clear: () => ipcRenderer.invoke('auth:clear'),
  },
  keys: {
    // 저장 여부 + 마스킹된 access 조회 (secret은 절대 안 나옴)
    status: () => ipcRenderer.invoke('keys:status'),
    // 저장 + 즉시 검증. 성공 시 { masked, summary }
    save: (access, secret) => ipcRenderer.invoke('keys:save', { access, secret }),
    // 저장된 키로 재검증. 성공 시 summary
    test: () => ipcRenderer.invoke('keys:test'),
    // 삭제
    clear: () => ipcRenderer.invoke('keys:clear'),
  },
  engine: {
    start: (logic, options) => ipcRenderer.invoke('engine:start', { logic, options }),
    stop: () => ipcRenderer.invoke('engine:stop'),
    status: () => ipcRenderer.invoke('engine:status'),
    // 원격 명령 처리 ('stop' 또는 { action: 'start', logic })
    remote: (command) => ipcRenderer.invoke('engine:remote', { command }),
    // 이벤트 구독. 반환된 함수를 호출하면 해지.
    on: (event, cb) => {
      const channel = `engine:${event}`;
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
});
