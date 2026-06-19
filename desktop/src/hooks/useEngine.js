import { useCallback, useEffect, useState } from 'react';

/**
 * PC 엔진 상태 훅.
 * 메인 프로세스의 EngineService와 IPC로 연결.
 * 'engine:tick' 등 이벤트로 자동 갱신.
 */
export function useEngine() {
  const [status, setStatus] = useState({ state: 'idle', context: null });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!window.coingap?.engine) return;
    let cancelled = false;

    // 초기 상태 fetch (앱 새로고침해도 메인 프로세스 상태가 살아있음)
    window.coingap.engine.status().then((s) => {
      if (!cancelled) setStatus(s);
    });

    const updateFromCtx = (ctx) => {
      if (!cancelled) setStatus({ state: ctx?.state || 'idle', context: ctx });
    };
    const offStarted = window.coingap.engine.on('started', updateFromCtx);
    const offTick = window.coingap.engine.on('tick', updateFromCtx);
    const offStopped = window.coingap.engine.on('stopped', updateFromCtx);

    return () => {
      cancelled = true;
      offStarted?.(); offTick?.(); offStopped?.();
    };
  }, []);

  const start = useCallback(async (logic, options = {}) => {
    setError(null);
    try {
      const s = await window.coingap.engine.start(logic, options);
      setStatus(s);
      return true;
    } catch (e) {
      setError(e?.message || String(e));
      return false;
    }
  }, []);

  const stop = useCallback(async () => {
    setError(null);
    try {
      const s = await window.coingap.engine.stop();
      setStatus(s);
    } catch (e) {
      setError(e?.message || String(e));
    }
  }, []);

  return {
    state: status.state,           // 'idle' | 'running' | 'stopped'
    context: status.context,        // 위 publicContext()
    error,
    start,
    stop,
  };
}
