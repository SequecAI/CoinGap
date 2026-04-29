import { useState, useEffect } from 'react';

export const TARGET_ALTS = ['KRW-ETH', 'KRW-XRP', 'KRW-SOL', 'KRW-DOGE', 'KRW-TRX'];

export const safeFetch = async (url) => {
  const proxies = ['', 'https://api.codetabs.com/v1/proxy?quest=', 'https://corsproxy.io/?'];
  for (const proxy of proxies) {
    try {
      const fetchUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
      const response = await fetch(fetchUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && !data.error) return data;
      }
    } catch (error) { }
  }
  return null;
};

export function useUpbitData() {
  const [markets, setMarkets] = useState([]);
  const [selectedAlt, setSelectedAlt] = useState(TARGET_ALTS[0]);
  const [tickers, setTickers] = useState({});
  const [dominance, setDominance] = useState(52.5);
  const [ma20, setMa20] = useState(0);
  const [momentum5m, setMomentum5m] = useState(0);
  const [candles5m, setCandles5m] = useState([]);
  const [dayCandles, setDayCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // 1. 마켓 목록 및 거시 지표 가져오기
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const [marketData, domData] = await Promise.all([
          safeFetch('https://api.upbit.com/v1/market/all?isDetails=false'),
          safeFetch('https://api.coinlore.net/api/global/')
        ]);
        if (isMounted) {
          if (marketData) {
            const krwMarkets = marketData.filter(m => TARGET_ALTS.includes(m.market));
            setMarkets(krwMarkets);
          }
          if (domData && domData[0] && domData[0].btc_d) {
            setDominance(parseFloat(domData[0].btc_d));
          }
        }
      } catch (error) { }
    };
    initData();
    return () => { isMounted = false; };
  }, []);

  // 2. 이격도 및 5분 모멘텀 계산
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    const fetchAnalyticsData = async () => {
      try {
        const [dayCandles, minCandles] = await Promise.all([
          safeFetch(`https://api.upbit.com/v1/candles/days?market=${selectedAlt}&count=20`),
          safeFetch(`https://api.upbit.com/v1/candles/minutes/5?market=${selectedAlt}&count=12`)
        ]);
        if (isMounted) {
          if (dayCandles && dayCandles.length > 0) {
            const avg = dayCandles.reduce((acc, curr) => acc + curr.trade_price, 0) / dayCandles.length;
            setMa20(avg);
            setDayCandles([...dayCandles].reverse());
          }
          if (minCandles && minCandles.length > 0) {
            const candle5m = minCandles[0];
            const currentPrice = tickers[selectedAlt]?.trade_price || candle5m.trade_price;
            const rate = ((currentPrice / candle5m.opening_price) - 1) * 100;
            setMomentum5m(rate);
            setCandles5m([...minCandles].reverse());
          }
        }
      } catch (error) { }
      timeoutId = setTimeout(fetchAnalyticsData, 10000);
    };
    fetchAnalyticsData();
    return () => { isMounted = false; if (timeoutId) clearTimeout(timeoutId); };
  }, [selectedAlt, tickers]);

  // 3. 실시간 시세 업데이트
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    const fetchAllTickers = async () => {
      if (!isMounted) return;
      try {
        const upbitQuery = ['KRW-BTC', ...TARGET_ALTS].join(',');
        const upbitData = await safeFetch(`https://api.upbit.com/v1/ticker?markets=${upbitQuery}`);
        if (isMounted && upbitData) {
          const newTickers = {};
          upbitData.forEach(t => { newTickers[t.market] = t; });
          setTickers(newTickers);
          setLastUpdated(new Date());
          setLoading(false);
        }
      } catch (error) { }
      finally { if (isMounted) timeoutId = setTimeout(fetchAllTickers, 2000); }
    };
    if (markets.length > 0 || !loading) fetchAllTickers();
    return () => { isMounted = false; if (timeoutId) clearTimeout(timeoutId); };
  }, [markets]);

  return {
    markets,
    selectedAlt,
    setSelectedAlt,
    tickers,
    dominance,
    ma20,
    momentum5m,
    candles5m,
    dayCandles,
    loading,
    lastUpdated
  };
}
