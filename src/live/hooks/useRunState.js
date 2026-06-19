import { useCallback, useEffect, useState } from 'react';
import { labApi } from '../../lab/api.js';

/**
 * PC 앱이 push한 운영 상태를 폴링.
 * - 마운트 시 즉시 1회 + intervalMs 주기로 갱신
 * - 페이지가 백그라운드(탭 비활성)이면 폴링 멈춤 → 비용 절약
 * - 수동 새로고침은 reload()
 */
export function useRunState(userId, intervalMs = 30_000) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  const fetchState = useCallback(async () => {
    if (!userId) {
      setState(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await labApi.getRunState(userId);
      setState(data?.state || null);
      setLastFetchedAt(Date.now());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchState();
    if (!userId) return;
    let id = setInterval(fetchState, intervalMs);

    const onVis = () => {
      if (document.hidden) {
        clearInterval(id);
      } else {
        fetchState();
        id = setInterval(fetchState, intervalMs);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [userId, intervalMs, fetchState]);

  return { state, loading, error, lastFetchedAt, reload: fetchState };
}
