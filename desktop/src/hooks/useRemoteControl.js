import { useEffect } from 'react';

const API_BASE = 'https://s8qnx3ch2k.execute-api.ap-northeast-2.amazonaws.com';
const POLL_MS = 5000; // 5초 주기 — 엔진 tick과 동일

/**
 * PC 측 원격 명령 폴러.
 * 매 5초 GET /runs/control → 명령이 있으면 메인의 engine.handleRemoteCommand에 전달.
 * userId가 없으면 폴링 안 함.
 */
export function useRemoteControl(userId) {
  useEffect(() => {
    if (!userId || !window.coingap?.engine?.remote) return;

    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `${API_BASE}/runs/control?userId=${encodeURIComponent(userId)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.command) {
            try {
              await window.coingap.engine.remote(data.command);
            } catch (e) {
              console.warn('[remoteControl] apply failed:', e?.message);
            }
          }
        }
      } catch (e) {
        // 네트워크 일시 오류는 무시 — 다음 polling에서 재시도
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId]);
}
