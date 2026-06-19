import { useCallback, useEffect, useState } from 'react';
import { labApi } from '../api.js';

/**
 * PC 앱은 로직을 "받아서 실행"만 하므로 save/delete는 없다.
 * 보관함 list + 선택 상태만 관리.
 */
export function useMyLogics(userId) {
  const [logics, setLogics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLogics([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await labApi.listMyLogics(userId);
      const items = Array.isArray(data.logics) ? data.logics : [];
      setLogics(items);
      // 선택된 항목이 없거나, 목록에서 사라진 경우 첫 항목을 자동 선택.
      setSelectedId((prev) => {
        if (prev && items.some((l) => l.logicId === prev)) return prev;
        return items[0]?.logicId || null;
      });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = logics.find((l) => l.logicId === selectedId) || null;

  return {
    logics,
    selected,
    selectedId,
    setSelectedId,
    loading,
    error,
    reload: load,
  };
}
