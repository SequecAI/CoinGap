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

const safeFetch = async (url) => {
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
  throw new Error('API 연결 실패');
};

// 광고 컴포넌트
const TopAdBanner = () => {
  useEffect(() => {
    try {
      // 광고 엔진에 이 영역을 광고로 등록
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense load error", e);
    }
  }, []);

  return (
    <div className="w-full max-w-4xl h-[90px] flex items-center justify-center overflow-hidden bg-slate-50">
      {/* 자동광고만 켰을 경우 이 자리에 구글이 광고를 안 넣을 수도 있습니다.
         심사 통과 후 '디스플레이 광고 단위'를 만들어 data-ad-slot을 넣으면 100% 이 자리에 나옵니다.
      */}
      <ins className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '90px' }}
        data-ad-client="ca-pub-7947485317948024"
        data-ad-format="horizontal"
        data-full-width-responsive="true"></ins>
    </div>
  );
};

export default function App() {
  const [markets, setMarkets] = useState([]);
  const [selectedAlt, setSelectedAlt] = useState('KRW-SOL');
  const [tickers, setTickers] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [alertThreshold, setAlertThreshold] = useState(2.0);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchMarkets = async () => {
      try {
        const data = await safeFetch('https://api.upbit.com/v1/market/all?isDetails=false');
        if (isMounted && data) {
          const krwMarkets = data.filter(m => TARGET_ALTS.includes(m.market));
          setMarkets(krwMarkets);
          setFetchError(null);
        }
      } catch (error) { }
    };
    fetchMarkets();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    const fetchTickers = async () => {
      if (!isMounted) return;
      try {
        const query = ['KRW-BTC', ...TARGET_ALTS].join(',');
        const data = await safeFetch(`https://api.upbit.com/v1/ticker?markets=${query}`);
        if (isMounted && data) {
          const newTickers = {};
          data.forEach(t => { newTickers[t.market] = t; });
          setTickers(newTickers);
          setLastUpdated(new Date());
          setLoading(false);
        }
      } catch (error) { }
      finally { if (isMounted) timeoutId = setTimeout(fetchTickers, 2000); }
    };
    if (markets.length > 0) fetchTickers();
    return () => { isMounted = false; if (timeoutId) clearTimeout(timeoutId); };
  }, [markets]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans"><RefreshCcw className="animate-spin text-slate-400" size={32} /></div>;

  const btc = tickers['KRW-BTC'];
  const alt = tickers[selectedAlt];
  const btcRate = btc ? btc.signed_change_rate * 100 : 0;
  const altRate = alt ? alt.signed_change_rate * 100 : 0;
  const rateGap = btcRate - altRate;
  const altName = markets.find(m => m.market === selectedAlt)?.korean_name || selectedAlt;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pt-28">
      {/* 상단 고정 광고 레이아웃 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm flex items-center justify-center h-[90px]">
        <TopAdBanner />
      </div>

      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-8">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Activity size={28} /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">비트코인 갭 모니터</h1>
              <p className="text-xs text-slate-400 uppercase tracking-wider">{lastUpdated.toLocaleTimeString()}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 px-1">ALERT GAP (%)</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2 w-full sm:w-24 font-bold" value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 px-1">SELECT COIN</label>
              <select className="bg-slate-50 border border-slate-200 rounded-xl p-2 w-full sm:w-40 font-bold" value={selectedAlt} onChange={(e) => setSelectedAlt(e.target.value)}>
                {markets.map((m) => (<option key={m.market} value={m.market}>{m.korean_name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* 갭 분석 카드 */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-slate-400 font-medium mb-1">상승률 갭</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-6xl font-black">{Math.abs(rateGap).toFixed(2)}%p</span>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-sm">현재 <span className="font-bold">{altName}</span> 변동률이 비트코인 대비 <span className={rateGap > 0 ? 'text-blue-400' : 'text-red-400'}>{Math.abs(rateGap).toFixed(2)}%p {rateGap > 0 ? '낮음' : '높음'}</span></p>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
        </div>

        {/* 가격 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 mb-1">BITCOIN (BTC)</p>
            <p className="text-2xl font-bold">{btc?.trade_price.toLocaleString()} KRW</p>
            <p className={`text-sm font-bold ${btc?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>{(btc?.signed_change_rate * 100).toFixed(2)}%</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 mb-1">{altName.toUpperCase()}</p>
            <p className="text-2xl font-bold">{alt?.trade_price.toLocaleString()} KRW</p>
            <p className={`text-sm font-bold ${alt?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>{(alt?.signed_change_rate * 100).toFixed(2)}%</p>
          </div>
        </div>

        {/* 알람 바 */}
        {Math.abs(rateGap) >= alertThreshold && (
          <div className="bg-red-600 text-white p-4 rounded-2xl flex items-center gap-3 animate-pulse">
            <Bell size={24} />
            <span className="font-bold text-sm">설정하신 {alertThreshold}%p 갭을 초과했습니다!</span>
          </div>
        )}
      </div>
    </div>
  );
}