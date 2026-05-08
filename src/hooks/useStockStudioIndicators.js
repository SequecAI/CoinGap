import { useState, useEffect } from 'react';

const STORAGE_KEY = 'coinGap_stockStudioIndicators';

const DEFAULT_STATE = {
  indicators: []
};

const API_BASE = 'https://oo78pteio2.execute-api.ap-northeast-2.amazonaws.com';

export function useStockStudioIndicators(userId = null) {
  const [state, setState] = useState(() => {
    try {
      const key = userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;
      const item = window.localStorage.getItem(key);
      if (!item) return DEFAULT_STATE;
      const parsed = JSON.parse(item);
      if (Array.isArray(parsed)) return { indicators: parsed };
      return parsed.indicators ? parsed : DEFAULT_STATE;
    } catch (error) {
      console.warn('Error reading localStorage', error);
      return DEFAULT_STATE;
    }
  });

  // userId가 변경될 때(로그인/로그아웃 등) 데이터 재로드 및 클라우드 동기화
  useEffect(() => {
    try {
      if (userId) {
        // 1. 로그인 상태: 서버 데이터(userInfo)를 최우선으로 사용
        const savedAuth = localStorage.getItem('coinGap_auth');
        if (savedAuth) {
          const authData = JSON.parse(savedAuth);
          if (authData.userId === userId && authData.stockIndicators) {
            setState({ indicators: authData.stockIndicators });
            // 로컬 캐시도 업데이트
            const key = `${STORAGE_KEY}_${userId}`;
            window.localStorage.setItem(key, JSON.stringify({ indicators: authData.stockIndicators }));
            return;
          }
        }
        // 서버 데이터가 없다면 로컬 계정별 캐시 확인
        const key = `${STORAGE_KEY}_${userId}`;
        const item = window.localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          setState(Array.isArray(parsed) ? { indicators: parsed } : (parsed.indicators ? parsed : DEFAULT_STATE));
        } else {
          setState(DEFAULT_STATE);
        }
      } else {
        // 2. 로그아웃 상태: 공용 로컬스토리지 사용
        const item = window.localStorage.getItem(STORAGE_KEY);
        if (item) {
          const parsed = JSON.parse(item);
          setState(Array.isArray(parsed) ? { indicators: parsed } : (parsed.indicators ? parsed : DEFAULT_STATE));
        } else {
          setState(DEFAULT_STATE);
        }
      }
    } catch (error) {
      console.warn('Error reloading stock indicators', error);
    }
  }, [userId]);

  const persist = (next) => {
    try {
      const key = userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;
      window.localStorage.setItem(key, JSON.stringify(next));
      
      // 로그인 상태라면 클라우드(백엔드)에도 동기화
      if (userId) {
        fetch(`${API_BASE}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            userId: userId,
            action: 'update_stock_indicators',
            stockIndicators: next.indicators
          }),
        }).catch(err => console.warn('[useStockStudioIndicators] 클라우드 동기화 실패:', err));
      }
    } catch (err) {
      console.warn('Error setting localStorage', err);
    }
    return next;
  };

  const addIndicator = (indicator) => {
    setState((prev) => persist({
      ...prev,
      indicators: [...prev.indicators, indicator]
    }));
  };

  const updateIndicator = (id, patch) => {
    setState((prev) => persist({
      ...prev,
      indicators: prev.indicators.map(i => i.id === id ? { ...i, ...patch } : i)
    }));
  };

  const removeIndicator = (id) => {
    setState((prev) => persist({
      ...prev,
      indicators: prev.indicators.filter(i => i.id !== id)
    }));
  };

  return {
    indicators: state.indicators,
    addIndicator,
    updateIndicator,
    removeIndicator
  };
}
