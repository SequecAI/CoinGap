import { useCallback, useEffect, useMemo, useState } from 'react';
import { labApi } from '../../lab/api.js';

/**
 * 기간별 거래 내역 + 집계 통계.
 * preset: 'today' | '7d' | '30d' | 'month' | 'custom'
 * custom일 때 fromDate / toDate(YYYY-MM-DD)로 직접 지정.
 *
 * 반환:
 *   trades: 시간 오름차순 정렬된 raw items
 *   stats: { count, wins, losses, totalPnlKrw, winRate, bestPnlPct, worstPnlPct }
 */
export function useTradesHistory(userId) {
  const [preset, setPreset] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const range = useMemo(() => computeRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!userId) {
      setTrades([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await labApi.getTrades(userId, range.fromIso, range.toIso);
      setTrades(Array.isArray(data.trades) ? data.trades : []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [userId, range.fromIso, range.toIso]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => computeStats(trades), [trades]);

  return {
    preset, setPreset,
    customFrom, setCustomFrom, customTo, setCustomTo,
    range,
    trades, stats, loading, error,
    reload: load,
  };
}

function computeRange(preset, customFrom, customTo) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const kstY = kstNow.getUTCFullYear();
  const kstM = kstNow.getUTCMonth();
  const kstD = kstNow.getUTCDate();
  // KST 자정 → UTC로 변환 (KST 자정 = UTC 전날 15:00)
  const kstMidnightUtcMs = Date.UTC(kstY, kstM, kstD) - 9 * 60 * 60 * 1000;

  let fromMs, toMs = now.getTime();
  switch (preset) {
    case 'today':
      fromMs = kstMidnightUtcMs;
      break;
    case '7d':
      fromMs = kstMidnightUtcMs - 6 * 86400_000;
      break;
    case '30d':
      fromMs = kstMidnightUtcMs - 29 * 86400_000;
      break;
    case 'month': {
      const ms = Date.UTC(kstY, kstM, 1) - 9 * 60 * 60 * 1000;
      fromMs = ms;
      break;
    }
    case 'custom':
      // 사용자가 입력한 YYYY-MM-DD는 KST 기준으로 해석
      if (customFrom) fromMs = parseKstDate(customFrom);
      else fromMs = kstMidnightUtcMs - 6 * 86400_000;
      if (customTo) toMs = parseKstDate(customTo) + 86400_000 - 1;
      break;
    default:
      fromMs = kstMidnightUtcMs - 6 * 86400_000;
  }
  return {
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
    fromMs, toMs,
  };
}

function parseKstDate(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !d) return Date.now();
  return Date.UTC(y, m - 1, d) - 9 * 60 * 60 * 1000;
}

function computeStats(trades) {
  let count = 0, wins = 0, losses = 0, totalPnlKrw = 0;
  let bestPnlPct = null, worstPnlPct = null;
  // 복리 누적: 각 거래의 (1 + pnlPct/100)을 곱하면 최종 자본 배수가 된다.
  // 단순 합산보다 정확 (+10% 후 -10% = -1%, 합산은 0%).
  let factor = 1;
  let pctCount = 0;
  for (const t of trades) {
    if (t.action === 'ENTER') continue; // 통계는 청산 기준
    count += 1;
    const pnlKrw = Number(t.pnlKrw) || 0;
    const pnlPct = Number(t.pnlPct);
    totalPnlKrw += pnlKrw;
    if (pnlKrw > 0) wins += 1;
    else if (pnlKrw < 0) losses += 1;
    if (isFinite(pnlPct)) {
      if (bestPnlPct == null || pnlPct > bestPnlPct) bestPnlPct = pnlPct;
      if (worstPnlPct == null || pnlPct < worstPnlPct) worstPnlPct = pnlPct;
      factor *= 1 + pnlPct / 100;
      pctCount += 1;
    }
  }
  const winRate = count > 0 ? (wins / count) * 100 : null;
  const cumReturnPct = pctCount > 0 ? (factor - 1) * 100 : null;
  return { count, wins, losses, totalPnlKrw, winRate, bestPnlPct, worstPnlPct, cumReturnPct };
}
