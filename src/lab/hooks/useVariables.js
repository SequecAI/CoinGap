import { useEffect, useState } from 'react';
import { labApi } from '../api.js';

/**
 * /variables 응답을 한 번 받아와 메모리에 보관한다.
 * 변수 팔레트는 종목·기간 무관하므로 페이지 마운트 시 한 번 호출하면 충분.
 *
 * 반환: { variables, loading, error, reload }
 *   variables = { entry: [...groups], exit: [...groups], operators: [...] }
 */
export function useVariables() {
  const [variables, setVariables] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await labApi.getVariables();
      setVariables(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { variables, loading, error, reload: load };
}
