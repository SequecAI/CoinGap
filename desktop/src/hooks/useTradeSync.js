import { useEffect } from 'react';

const API_BASE = 'https://s8qnx3ch2k.execute-api.ap-northeast-2.amazonaws.com';

/**
 * 메인 프로세스의 'engine:trade' 이벤트를 받아 백엔드 POST /trades로 영구 저장.
 * userId가 없으면 아무 것도 안 한다.
 *
 * 거래는 매번 한 건씩 들어오므로 dedup이나 마지막 추적이 필요 없다.
 */
export function useTradeSync(userId) {
  useEffect(() => {
    if (!userId || !window.coingap?.engine) return;
    const off = window.coingap.engine.on('trade', async (trade) => {
      try {
        const res = await fetch(`${API_BASE}/trades`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, trade }),
        });
        if (!res.ok) console.warn('[tradeSync] put failed:', res.status);
      } catch (e) {
        console.warn('[tradeSync] put error:', e.message);
      }
    });
    return () => off?.();
  }, [userId]);
}
