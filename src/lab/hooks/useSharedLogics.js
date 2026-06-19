import { useEffect, useState } from 'react';
import { labApi } from '../api.js';

/**
 * 공유 로직(SEED) 목록을 한 번만 받아온다.
 * 출시 시점에는 SEED 한 개뿐. 추후 커뮤니티 공유가 들어오면 같은 응답 형태로 확장.
 */
export function useSharedLogics() {
  const [logics, setLogics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await labApi.getSharedLogics();
        if (!cancelled) setLogics(Array.isArray(data.logics) ? data.logics : []);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { logics, loading, error };
}
