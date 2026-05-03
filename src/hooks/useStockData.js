import { useState, useEffect, useCallback, useRef } from 'react';
import { safeFetch } from './useUpbitData';

const NAVER_BASE = 'https://m.stock.naver.com';

// 기본 종목 리스트 (시가총액 상위)
export const DEFAULT_STOCKS = [
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { code: '373220', name: 'LG에너지솔루션', market: 'KOSPI' },
  { code: '207940', name: '삼성바이오로직스', market: 'KOSPI' },
  { code: '005380', name: '현대차', market: 'KOSPI' },
  { code: '000270', name: '기아', market: 'KOSPI' },
  { code: '035420', name: 'NAVER', market: 'KOSPI' },
  { code: '035720', name: '카카오', market: 'KOSPI' },
  { code: '068270', name: '셀트리온', market: 'KOSPI' },
  { code: '005490', name: 'POSCO홀딩스', market: 'KOSPI' },
];

// 네이버 API에서 숫자 파싱 (콤마 제거)
function parseNaverNumber(str) {
  if (str === undefined || str === null) return 0;
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

export function useStockData() {
  const [selectedStock, setSelectedStock] = useState(DEFAULT_STOCKS[0]);
  const [stockBasic, setStockBasic] = useState(null);
  const [stockDetail, setStockDetail] = useState(null);
  const [dayPrices, setDayPrices] = useState([]);
  const [kospiData, setKospiData] = useState(null);
  const [kosdaqData, setKosdaqData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [minuteMomentum, setMinuteMomentum] = useState(0);

  // 검색 debounce
  const searchTimeoutRef = useRef(null);

  // ── 종목 검색 (자동완성) ──
  const searchStock = useCallback((query) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await safeFetch(
          `${NAVER_BASE}/front-api/search/autoComplete?query=${encodeURIComponent(query)}&target=stock`
        );
        if (data && data.isSuccess && data.result && data.result.items) {
          // 국내 주식만 필터링
          const domestic = data.result.items.filter(
            item => item.nationCode === 'KOR' && item.category === 'stock'
          );
          setSearchResults(domestic.slice(0, 8));
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        setSearchResults([]);
      }
    }, 300);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  // ── 1. 실시간 시세 + 지수 (5초 간격) ──
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const fetchRealtime = async () => {
      if (!isMounted) return;
      try {
        const [basicData, kospi, kosdaq] = await Promise.all([
          safeFetch(`${NAVER_BASE}/api/stock/${selectedStock.code}/basic`),
          safeFetch(`${NAVER_BASE}/api/index/KOSPI/basic`),
          safeFetch(`${NAVER_BASE}/api/index/KOSDAQ/basic`),
        ]);

        if (isMounted) {
          if (basicData && basicData.stockName) {
            setStockBasic(basicData);
            setLoading(false);
            setLastUpdated(new Date());
          }
          if (kospi) setKospiData(kospi);
          if (kosdaq) setKosdaqData(kosdaq);

          // ── 5분 모멘텀 가져오기 ──
          try {
            const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${selectedStock.code}&requestType=0&count=6&timeframe=minute`;
            const xmlRes = await fetch(url);
            const text = await xmlRes.text();
            const matches = [...text.matchAll(/<item data="([^"]+)"/g)];
            if (matches.length >= 6) {
              const currentPrice = parseFloat(matches[matches.length - 1][1].split('|')[4]);
              const pastPrice = parseFloat(matches[0][1].split('|')[4]);
              if (pastPrice > 0) {
                setMinuteMomentum(((currentPrice - pastPrice) / pastPrice) * 100);
              }
            }
          } catch (me) {
            console.error('Momentum fetch error', me);
          }
        }
      } catch (e) { }
      if (isMounted) timeoutId = setTimeout(fetchRealtime, 5000);
    };

    fetchRealtime();
    return () => { isMounted = false; if (timeoutId) clearTimeout(timeoutId); };
  }, [selectedStock]);

  // ── 2. 상세 데이터 (30초 간격) ──
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const fetchDetail = async () => {
      if (!isMounted) return;
      try {
        const data = await safeFetch(
          `${NAVER_BASE}/api/stock/${selectedStock.code}/integration`
        );
        if (isMounted && data) {
          setStockDetail(data);
        }
      } catch (e) { }
      if (isMounted) timeoutId = setTimeout(fetchDetail, 30000);
    };

    fetchDetail();
    return () => { isMounted = false; if (timeoutId) clearTimeout(timeoutId); };
  }, [selectedStock]);

  // ── 3. 일별 가격 데이터 (60초 간격) ──
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const fetchPrices = async () => {
      if (!isMounted) return;
      try {
        const data = await safeFetch(
          `${NAVER_BASE}/api/stock/${selectedStock.code}/price?pageSize=60&page=1&type=day`
        );
        if (isMounted && data && Array.isArray(data)) {
          // API가 최신이 앞에 오므로 reverse
          setDayPrices([...data].reverse());
        }
      } catch (e) { }
      if (isMounted) timeoutId = setTimeout(fetchPrices, 60000);
    };

    fetchPrices();
    return () => { isMounted = false; if (timeoutId) clearTimeout(timeoutId); };
  }, [selectedStock]);

  // ── 파생 데이터 계산 ──

  // 현재가 (숫자)
  const currentPrice = stockBasic ? parseNaverNumber(stockBasic.closePrice) : 0;
  // 등락률
  const changeRate = stockBasic ? parseFloat(stockBasic.fluctuationsRatio) || 0 : 0;
  // 전일비
  const changeAmount = stockBasic ? parseNaverNumber(stockBasic.compareToPreviousClosePrice) : 0;
  // 상승/하락
  const changeDirection = stockBasic?.compareToPreviousPrice?.name || 'UNCHANGED';

  // integration 데이터에서 지표 추출
  const getInfoValue = (code) => {
    if (!stockDetail || !stockDetail.totalInfos) return null;
    const info = stockDetail.totalInfos.find(i => i.code === code);
    return info ? info.value : null;
  };

  const marketCap = getInfoValue('marketValue');
  const foreignRate = getInfoValue('foreignRate');
  const per = getInfoValue('per');
  const pbr = getInfoValue('pbr');
  const eps = getInfoValue('eps');
  const bps = getInfoValue('bps');
  const dividendYield = getInfoValue('dividendYieldRatio');
  const high52w = getInfoValue('highPriceOf52Weeks');
  const low52w = getInfoValue('lowPriceOf52Weeks');
  const volume = getInfoValue('accumulatedTradingVolume');
  const tradingValue = getInfoValue('accumulatedTradingValue');

  // 투자자별 매매동향
  const dealTrends = stockDetail?.dealTrendInfos || [];

  // 동종업계 비교
  const industryCompare = stockDetail?.industryCompareInfo || [];

  // 일봉 데이터를 AnalysisTab 호환 형태로 변환
  const dayCandles = dayPrices.map(d => ({
    trade_price: parseNaverNumber(d.closePrice),
    opening_price: parseNaverNumber(d.openPrice),
    high_price: parseNaverNumber(d.highPrice),
    low_price: parseNaverNumber(d.lowPrice),
    candle_acc_trade_volume: typeof d.accumulatedTradingVolume === 'number'
      ? d.accumulatedTradingVolume
      : parseNaverNumber(d.accumulatedTradingVolume),
    candle_date_time_kst: d.localTradedAt ? `${d.localTradedAt}T00:00:00` : '',
  }));

  // KOSPI 파생 데이터
  const kospiPrice = kospiData ? parseNaverNumber(kospiData.closePrice) : 0;
  const kospiChange = kospiData ? parseFloat(kospiData.fluctuationsRatio) || 0 : 0;
  const kospiDirection = kospiData?.compareToPreviousPrice?.name || 'UNCHANGED';

  // KOSDAQ 파생 데이터
  const kosdaqPrice = kosdaqData ? parseNaverNumber(kosdaqData.closePrice) : 0;
  const kosdaqChange = kosdaqData ? parseFloat(kosdaqData.fluctuationsRatio) || 0 : 0;
  const kosdaqDirection = kosdaqData?.compareToPreviousPrice?.name || 'UNCHANGED';

  const stockMomentum = dayCandles.length > 0
    ? ((dayCandles[dayCandles.length - 1].trade_price / dayCandles[dayCandles.length - 1].opening_price) - 1) * 100
    : 0;

  return {
    // 종목 관리
    selectedStock,
    setSelectedStock,
    searchStock,
    searchResults,
    clearSearch,

    // 실시간 데이터
    stockBasic,
    currentPrice,
    changeRate,
    changeAmount,
    changeDirection,
    loading,
    lastUpdated,

    // 상세 데이터
    stockDetail,
    marketCap,
    foreignRate,
    per, pbr, eps, bps,
    dividendYield,
    high52w, low52w,
    volume, tradingValue,
    dealTrends,
    industryCompare,

    // 차트/분석 데이터
    dayCandles,
    dayPrices,
    momentum: minuteMomentum,

    // 지수
    kospiPrice, kospiChange, kospiDirection,
    kosdaqPrice, kosdaqChange, kosdaqDirection,
  };
}
