import { useState, useEffect, useCallback, useRef } from 'react';

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
  const [selectedAlt, setSelectedAlt] = useState('KRW-ETH');
  const [tickers, setTickers] = useState({});
  const [dominance, setDominance] = useState(52.5);
  const [ma20, setMa20] = useState(0);
  const [momentum5m, setMomentum5m] = useState(0);
  const [candles5m, setCandles5m] = useState([]);
  const [dayCandles, setDayCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [searchResults, setSearchResults] = useState([]);

  const searchTimeoutRef = useRef(null);

  // ── 종목 검색 (클라이언트 사이드 필터) ──
  const searchCoin = useCallback((query) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      const results = markets.filter(m => {
        const code = m.market.replace('KRW-', '').toLowerCase();
        return (
          m.korean_name?.toLowerCase().includes(q) ||
          m.english_name?.toLowerCase().includes(q) ||
          code.includes(q)
        );
      }).slice(0, 8);
      setSearchResults(results);
    }, 150);
  }, [markets]);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

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
            const krwMarkets = marketData
              .filter(m => m.market.startsWith('KRW-'))
              .sort((a, b) => a.korean_name.localeCompare(b.korean_name, 'ko'));
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
          safeFetch(`https://api.upbit.com/v1/candles/days?market=${selectedAlt}&count=60`),
          safeFetch(`https://api.upbit.com/v1/candles/minutes/5?market=${selectedAlt}&count=60`)
        ]);
        if (isMounted) {
          if (dayCandles && dayCandles.length > 0) {
            const recent20 = dayCandles.slice(0, 20);
            const avg = recent20.reduce((acc, curr) => acc + curr.trade_price, 0) / recent20.length;
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

  // 3. 실시간 시세 업데이트 — BTC + 선택 알트만, 5초 간격
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    const fetchTickers = async () => {
      if (!isMounted) return;
      try {
        const query = selectedAlt === 'KRW-BTC'
          ? 'KRW-BTC'
          : `KRW-BTC,${selectedAlt}`;
        const upbitData = await safeFetch(`https://api.upbit.com/v1/ticker?markets=${query}`);
        if (isMounted && upbitData) {
          const newTickers = {};
          upbitData.forEach(t => { newTickers[t.market] = t; });
          setTickers(newTickers);
          setLastUpdated(new Date());
          setLoading(false);
        }
      } catch (error) { }
      finally { if (isMounted) timeoutId = setTimeout(fetchTickers, 5000); }
    };
    if (markets.length > 0) fetchTickers();
    return () => { isMounted = false; if (timeoutId) clearTimeout(timeoutId); };
  }, [markets, selectedAlt]);

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
    lastUpdated,
    searchCoin,
    searchResults,
    clearSearch
  };
}
