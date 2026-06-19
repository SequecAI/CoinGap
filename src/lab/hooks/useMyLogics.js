import { useCallback, useEffect, useState } from 'react';
import { labApi } from '../api.js';

/**
 * 내 보관함 (DynamoDB) CRUD를 메모리·로컬 상태에 동기화한다.
 *
 * - 마운트 시 userId가 있으면 한 번 list 호출. 비로그인이면 빈 배열.
 * - save: 슬롯 가득 시 saveLogicSafe 응답의 {error:'slot_full', existing:[...]}
 *         그대로 slotFull 상태에 저장 → 부모가 "어떤 로직을 지울까요?" 모달 표시.
 * - delete 성공 시 slotFull 비우고 다시 list로 동기화.
 *
 * 반환: {
 *   logics, limit, loading, error,        // 데이터
 *   slotFull, dismissSlotFull,             // 슬롯 가득 모달용
 *   reload, save, remove                   // 동작
 * }
 *   save(logic): 성공 시 {ok:true, mode:'created'|'overwritten'}, 슬롯 가득이면 null 반환
 *                (slotFull 상태가 채워지므로 호출부는 모달만 띄우면 됨)
 *   remove(logicId): 성공 시 true / 실패 시 false
 */
export function useMyLogics(userId) {
  const [logics, setLogics] = useState([]);
  const [limit, setLimit] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [slotFull, setSlotFull] = useState(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLogics([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await labApi.listMyLogics(userId);
      setLogics(Array.isArray(data.logics) ? data.logics : []);
      if (typeof data.limit === 'number') setLimit(data.limit);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (logic) => {
    if (!userId) {
      setError('로그인이 필요합니다.');
      return null;
    }
    setError(null);
    try {
      const res = await labApi.saveLogicSafe(userId, logic);
      // 슬롯 가득: 409 응답이라도 본문은 정상 JSON
      if (res?.error === 'slot_full') {
        setSlotFull({
          attemptedName: logic?.name || '',
          existing: res.existing || [],
          limit: res.limit || limit,
          currentCount: res.current_count || (res.existing?.length ?? 0),
        });
        return null;
      }
      if (res?.error === 'name_required') {
        setError('로직 이름이 필요합니다.');
        return null;
      }
      if (!res?.ok) {
        setError(res?.error || '저장 실패');
        return null;
      }
      await load();
      return res;
    } catch (e) {
      setError(e.message || String(e));
      return null;
    }
  }, [userId, load, limit]);

  const remove = useCallback(async (logicId) => {
    if (!userId || !logicId) return false;
    setError(null);
    try {
      const res = await labApi.deleteLogic(userId, logicId);
      if (!res?.ok) {
        setError(res?.error || '삭제 실패');
        return false;
      }
      await load();
      return true;
    } catch (e) {
      setError(e.message || String(e));
      return false;
    }
  }, [userId, load]);

  const dismissSlotFull = useCallback(() => setSlotFull(null), []);

  return {
    logics,
    limit,
    loading,
    error,
    slotFull,
    dismissSlotFull,
    reload: load,
    save,
    remove,
  };
}
