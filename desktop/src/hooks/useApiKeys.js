import { useCallback, useEffect, useState } from 'react';

/**
 * 업비트 API 키 상태 훅.
 * 실제 secret은 메인 프로세스에만 있고, 여기서는 마스킹된 access + 잔고 요약만 다룬다.
 */
export function useApiKeys() {
  const [status, setStatus] = useState({ exists: false }); // { exists, accessMasked? }
  const [summary, setSummary] = useState(null);            // { krw, assetCount, ... }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!window.coingap?.keys) return;
    try {
      const s = await window.coingap.keys.status();
      setStatus(s);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (access, secret) => {
    setLoading(true);
    setError(null);
    try {
      const r = await window.coingap.keys.save(access, secret);
      setStatus(r.masked);
      setSummary(r.summary);
      return true;
    } catch (e) {
      setError(e.message || String(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const test = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await window.coingap.keys.test();
      setSummary(s);
      return true;
    } catch (e) {
      setError(e.message || String(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await window.coingap.keys.clear();
      setStatus(s);
      setSummary(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { status, summary, loading, error, save, test, clear };
}
