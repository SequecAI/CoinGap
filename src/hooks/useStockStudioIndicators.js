import { useState } from 'react';

const STORAGE_KEY = 'coinGap_stockStudioIndicators';

const DEFAULT_STATE = {
  indicators: []
};

export function useStockStudioIndicators() {
  const [state, setState] = useState(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (!item) return DEFAULT_STATE;
      const parsed = JSON.parse(item);
      // 복사하기 버그로 인해 배열이 저장되었던 경우 복구
      if (Array.isArray(parsed)) return { indicators: parsed };
      return parsed.indicators ? parsed : DEFAULT_STATE;
    } catch (error) {
      console.warn('Error reading localStorage', error);
      return DEFAULT_STATE;
    }
  });

  const persist = (next) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
