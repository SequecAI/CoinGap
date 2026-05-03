import { useState, useEffect } from 'react';

const STORAGE_KEY = 'coinGap_customViewSettings';

const DEFAULT_SETTINGS = {
  indicators: {
    bollinger: true,
    momentum: true,
    priceMomentum: true,
    intensity: true,
    rsi: true,
    zscore: true,
    macd: true,
    mfi: true,
    stochrsi: true
  }
};

export function useCustomSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      return item ? JSON.parse(item) : DEFAULT_SETTINGS;
    } catch (error) {
      console.warn('Error reading localStorage', error);
      return DEFAULT_SETTINGS;
    }
  });

  const toggleIndicator = (key) => {
    setSettings((prev) => {
      const newSettings = {
        ...prev,
        indicators: {
          ...prev.indicators,
          [key]: !prev.indicators[key]
        }
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      } catch (err) {
        console.warn('Error setting localStorage', err);
      }
      return newSettings;
    });
  };

  return { settings, toggleIndicator };
}
