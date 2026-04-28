import React, { useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCcw,
  Activity,
  Coins,
  Bell,
  AlertTriangle
} from 'lucide-react';

const TARGET_ALTS = ['KRW-ETH', 'KRW-XRP', 'KRW-SOL', 'KRW-DOGE', 'KRW-TRX'];

// CORS 우회를 위한 안전한 다중 프록시 페칭 함수
const safeFetch = async (url) => {
  const proxies = [
    '',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://corsproxy.io/?'
  ];

  for (const proxy of proxies) {
    try {
      const fetchUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
      const response = await fetch(fetchUrl);

      if (response.ok) {
        const data = await response.json();
        if (data && !data.error) {
          return data;
        }
      }
    } catch (error) {
      console.warn(`[네트워크 헬퍼] ${proxy || 'Direct URL'} 접근 실패`);
    }
  }

  throw new Error('모든 API 서버 연결 시도에 실패했습니다.');
};

export default function App() {
  const [markets, setMarkets] = useState([]);
  const [selectedAlt, setSelectedAlt] = useState('KRW-SOL');
  const [tickers, setTickers] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [alertThreshold, setAlertThreshold] = useState(2.0);
  const [fetchError, setFetchError] = useState(null);

  // 1. 마켓 목록 가져오기
  useEffect(() => {
    let isMounted = true;
    const fetchMarkets = async () => {
      try {
        const data = await safeFetch('https://api.upbit.com/v1/market/all?isDetails=false');
        if (isMounted && data) {
          const krwMarkets = data.filter(m => TARGET_ALTS.includes(m.market));
          krwMarkets.sort((a, b) => TARGET_ALTS.indexOf(a.market) - TARGET_ALTS.indexOf(b.market));
          setMarkets(krwMarkets);
          setFetchError(null);
        }
      } catch (error) {
        if (isMounted) {
          setFetchError("마켓 데이터를 불러올 수 없습니다. 광고 차단기를 일시 중지해 보세요.");
        }
      }
    };
    fetchMarkets();
    return () => { isMounted = false; };
  }, []);

  // 2. 실시간 시세 일괄 조회
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const fetchTickers = async () => {
      if (!isMounted) return;

      try {
        const query = ['KRW-BTC', ...TARGET_ALTS].join(',');
        const data = await safeFetch(`https://api.upbit.com/v1/ticker?markets=${query}`);

        if (isMounted && data && data.length > 0) {
          const newTickers = {};
          data.forEach(t => {
            newTickers[t.market] = t;
          });

          setTickers(newTickers);
          setLastUpdated(new Date());
          setFetchError(null);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setFetchError("데이터 연결이 불안정합니다. 백그라운드에서 재연결을 시도 중입니다...");
        }
      } finally {
        if (isMounted) {
          timeoutId = setTimeout(fetchTickers, 2000);
        }
      }
    };

    if (markets.length > 0) {
      fetchTickers();
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [markets]);

  const formatPrice = (price) => {
    if (!price) return '0';
    return price.toLocaleString('ko-KR');
  };

  const formatRate = (rate) => {
    if (!rate && rate !== 0) return '0.00';
    return (rate * 100).toFixed(2);
  };

  const getColorClass = (change) => {
    if (change === 'RISE') return 'text-red-500';
    if (change === 'FALL') return 'text-blue-500';
    return 'text-slate-600';
  };

  const getIcon = (change) => {
    if (change === 'RISE') return <TrendingUp size={20} />;
    if (change === 'FALL') return <TrendingDown size={20} />;
    return <Minus size={20} />;
  };

  if (loading && fetchError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 flex flex-col items-center gap-4 text-center max-w-md">
          <div className="p-4 bg-red-50 text-red-500 rounded-full">
            <AlertTriangle size={48} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">네트워크 연결 오류</h2>
          <p className="text-slate-600 font-medium">{fetchError}</p>
          <RefreshCcw className="animate-spin text-slate-400 mt-4" size={24} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <RefreshCcw className="animate-spin" size={32} />
          <p>업비트 실시간 데이터를 연결 중...</p>
        </div>
      </div>
    );
  }

  const btc = tickers['KRW-BTC'];
  const alt = tickers[selectedAlt];

  const btcRate = btc ? btc.signed_change_rate * 100 : 0;
  const altRate = alt ? alt.signed_change_rate * 100 : 0;
  const rateGap = btcRate - altRate;

  const altName = markets.find(m => m.market === selectedAlt)?.korean_name || selectedAlt.replace('KRW-', '');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pt-28">
      {/* pt-28: 상단 고정 광고에 가려지지 않도록 메인 컨텐츠의 위쪽 여백 확보 */}

      {/* 최상단 고정 광고 영역 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm flex items-center justify-center">
        {/* 모바일 화면에서는 보통 320x50 또는 320x100 사이즈를 많이 씁니다 */}
        <div className="w-full max-w-4xl h-[90px] bg-slate-100 flex flex-col items-center justify-center text-slate-400 text-sm">
          <span className="font-bold text-slate-500">최상단 광고 배너 영역</span>
          <span>구글 애드센스 코드를 여기에 삽입하세요 (예: 728x90 또는 자동 반응형)</span>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-500 text-white p-2 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-md relative z-40">
          <AlertTriangle size={16} />
          {fetchError}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-8">

        {/* 헤더 및 컨트롤 영역 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <Activity size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">비트코인 vs 알트코인 갭 모니터</h1>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <RefreshCcw size={12} className={fetchError ? "" : "animate-spin-slow"} />
                최근 업데이트: {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-600 px-1">알림 기준 갭 (%p)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-base rounded-xl focus:ring-red-500 focus:border-red-500 block w-full sm:w-32 p-3 font-medium outline-none transition-shadow hover:shadow-sm"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(Number(e.target.value))}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <Bell size={16} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-600 px-1">비교할 알트코인 선택</label>
              <select
                className="bg-slate-50 border border-slate-200 text-slate-800 text-base rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-48 p-3 font-medium outline-none transition-shadow hover:shadow-sm"
                value={selectedAlt}
                onChange={(e) => setSelectedAlt(e.target.value)}
              >
                {markets.map((market) => (
                  <option key={market.market} value={market.market}>
                    {market.korean_name} ({market.market.replace('KRW-', '')})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 현재가 패널 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <span className="font-bold text-orange-500">₿</span>
                </div>
                <h2 className="text-xl font-bold">비트코인 (BTC)</h2>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">기준 마켓</span>
            </div>

            {btc && (
              <div>
                <div className="text-3xl font-extrabold mb-2 tracking-tight">
                  {formatPrice(btc.trade_price)} <span className="text-lg font-medium text-slate-400">KRW</span>
                </div>
                <div className={`flex items-center gap-1 font-bold text-lg ${getColorClass(btc.change)}`}>
                  {getIcon(btc.change)}
                  <span>{btc.change === 'RISE' ? '+' : ''}{formatRate(btc.signed_change_rate)}%</span>
                  <span className="text-sm font-medium ml-1">
                    ({btc.change === 'RISE' ? '+' : ''}{formatPrice(btc.signed_change_price)}원)
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                  <Coins size={18} />
                </div>
                <h2 className="text-xl font-bold">{altName} ({selectedAlt.replace('KRW-', '')})</h2>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-600 rounded-lg">비교 대상</span>
            </div>

            {alt && (
              <div className="relative z-10">
                <div className="text-3xl font-extrabold mb-2 tracking-tight">
                  {formatPrice(alt.trade_price)} <span className="text-lg font-medium text-slate-400">KRW</span>
                </div>
                <div className={`flex items-center gap-1 font-bold text-lg ${getColorClass(alt.change)}`}>
                  {getIcon(alt.change)}
                  <span>{alt.change === 'RISE' ? '+' : ''}{formatRate(alt.signed_change_rate)}%</span>
                  <span className="text-sm font-medium ml-1">
                    ({alt.change === 'RISE' ? '+' : ''}{formatPrice(alt.signed_change_price)}원)
                  </span>
                </div>
              </div>
            )}

            <ArrowRightLeft className="absolute -right-4 -bottom-4 text-slate-50 opacity-50" size={120} />
          </div>
        </div>

        {/* 갭 분석 패널 */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-slate-400 font-medium mb-1">상승률/하락률 갭 분석 (24H 기준)</h3>
            <div className="flex items-baseline gap-4 mb-6">
              <span className="text-5xl font-extrabold tracking-tight">
                {Math.abs(rateGap).toFixed(2)}%p
              </span>
              <span className="text-lg text-slate-300">차이</span>
            </div>

            <div className="p-4 bg-white/10 rounded-xl border border-white/5 backdrop-blur-sm">
              <p className="text-lg font-medium">
                현재 <span className="font-bold text-white">{altName}</span>의 변동률이 비트코인 대비{' '}
                <span className={`font-bold ${rateGap > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {Math.abs(rateGap).toFixed(2)}%p {rateGap > 0 ? '낮습니다' : '높습니다'}.
                </span>
              </p>
              <p className="text-slate-400 text-sm mt-2">
                {rateGap > 0
                  ? "비트코인이 알트코인보다 강세를 보이고 있습니다."
                  : "알트코인이 비트코인보다 강한 퍼포먼스를 내고 있습니다."}
              </p>
            </div>
          </div>

          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-20 -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full blur-[80px] opacity-20 -ml-20 -mb-20"></div>
        </div>

        {/* 갭 알림 (분석 패널 하단에 자연스럽게 위치) */}
        {Math.abs(rateGap) >= alertThreshold && (
          <div className="bg-red-600 text-white p-6 rounded-3xl animate-[pulse_2s_ease-in-out_infinite] shadow-[0_10px_20px_rgba(220,38,38,0.3)] border-2 border-red-500">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
              <div className="p-3 bg-red-700 rounded-full shrink-0">
                <Bell size={28} className="animate-bounce" />
              </div>
              <span className="text-lg md:text-xl font-bold tracking-wide">
                🚨 긴급 알림: {altName}의 변동률 갭({Math.abs(rateGap).toFixed(2)}%p)이 설정값({alertThreshold}%p)을 초과했습니다!
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}