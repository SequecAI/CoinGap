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
  AlertTriangle,
  Info,
  ChevronRight,
  ShieldCheck
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

const TopAdBanner = () => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense load error", e);
    }
  }, []);

  return (
    <div className="w-full max-w-4xl h-[90px] flex items-center justify-center overflow-hidden">
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
  const [showInfo, setShowInfo] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchMarkets = async () => {
      try {
        const data = await safeFetch('https://api.upbit.com/v1/market/all?isDetails=false');
        if (isMounted && data) {
          const krwMarkets = data.filter(m => TARGET_ALTS.includes(m.market));
          setMarkets(krwMarkets);
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

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4 text-slate-500">
        <RefreshCcw className="animate-spin" size={32} />
        <p>암호화폐 시장 데이터 로딩 중...</p>
      </div>
    </div>
  );

  const btc = tickers['KRW-BTC'];
  const alt = tickers[selectedAlt];
  const btcRate = btc ? btc.signed_change_rate * 100 : 0;
  const altRate = alt ? alt.signed_change_rate * 100 : 0;
  const rateGap = btcRate - altRate;
  const altName = markets.find(m => m.market === selectedAlt)?.korean_name || selectedAlt;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pt-28 pb-20">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm flex items-center justify-center h-[90px]">
        <TopAdBanner />
      </div>

      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-8">

        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-2xl">
              <Activity size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">코인 갭 모니터</h1>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-[10px] font-bold uppercase">{lastUpdated.toLocaleTimeString()} 업데이트</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter text-left">Gap (%)</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none" value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter text-left">Compare</label>
              <select className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-40 font-bold outline-none" value={selectedAlt} onChange={(e) => setSelectedAlt(e.target.value)}>
                {markets.map((m) => (<option key={m.market} value={m.market}>{m.korean_name}</option>))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10 text-left">
              <h3 className="text-slate-400 font-bold mb-1 text-lg">BTC vs {altName} Gap Analysis</h3>
              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-7xl font-black tracking-tighter">{Math.abs(rateGap).toFixed(2)}%</span>
                <span className={`text-xl font-bold ${rateGap > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {rateGap > 0 ? 'BTC Strong' : 'Alt Strong'}
                </span>
              </div>
              <div className="p-5 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl">
                <p className="text-base font-medium leading-relaxed">
                  현재 {altName}의 변동률이 비트코인 대비 <span className={`font-black ${rateGap > 0 ? 'text-blue-400' : 'text-red-400'}`}>{Math.abs(rateGap).toFixed(2)}%p {rateGap > 0 ? '낮게' : '높게'}</span> 형성되어 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-left">
            <p className="text-xs font-black text-slate-400 mb-1">BITCOIN (BTC)</p>
            <p className="text-3xl font-black mb-1 tracking-tight">{btc?.trade_price.toLocaleString()} KRW</p>
            <p className={`text-sm font-bold ${btc?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>{(btc?.signed_change_rate * 100).toFixed(2)}%</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-left">
            <p className="text-xs font-black text-slate-400 mb-1">{altName.toUpperCase()}</p>
            <p className="text-3xl font-black mb-1 tracking-tight">{alt?.trade_price.toLocaleString()} KRW</p>
            <p className={`text-sm font-bold ${alt?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>{(alt?.signed_change_rate * 100).toFixed(2)}%</p>
          </div>
        </div>

        {Math.abs(rateGap) >= alertThreshold && (
          <div className="bg-red-600 text-white p-5 rounded-3xl flex items-center justify-between animate-pulse shadow-xl shadow-red-200 border-2 border-red-500">
            <div className="flex items-center gap-4">
              <Bell size={24} />
              <p className="font-black text-lg">GAP ALERT! ({Math.abs(rateGap).toFixed(2)}%)</p>
            </div>
            <ChevronRight size={24} />
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-12 text-left">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="w-full p-6 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Info className="text-blue-500" size={20} />
              <h2 className="text-lg font-bold text-slate-800">어떻게 활용하나요?</h2>
            </div>
            <div className={`transform transition-transform ${showInfo ? 'rotate-90' : ''}`}>
              <ChevronRight size={20} />
            </div>
          </button>

          {showInfo && (
            <div className="p-8 space-y-6 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black">1</div>
                  <h4 className="font-bold">비트코인 기준</h4>
                  <p className="text-sm text-slate-500">비트코인의 24시간 변동률을 시장의 기준으로 잡습니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black">2</div>
                  <h4 className="font-bold">상대적 갭 측정</h4>
                  <p className="text-sm text-slate-500">알트코인이 비트코인 대비 덜 상승/하락한 갭을 수치화합니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black">3</div>
                  <h4 className="font-bold">트레이딩 전략</h4>
                  <p className="text-sm text-slate-500">갭이 커지면 과매수, 작아지면 과매도 구간으로, 차액 매매에 활용할 수 있습니다.</p>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-start">
                <ShieldCheck className="text-blue-600 shrink-0" size={20} />
                <p className="text-xs text-blue-800">업비트 Public API만을 사용하며, 어떠한 개인 정보나 키를 요구하지 않는 안전한 모니터링 환경입니다.</p>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-12 pt-10 border-t border-slate-200 text-center space-y-6">
          <div className="flex justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <button onClick={() => window.open('https://www.google.com/policies/technologies/ads', '_blank')} className="hover:text-blue-600">Cookies</button>
            <button onClick={() => window.open('https://policies.google.com/privacy', '_blank')} className="hover:text-blue-600">Privacy</button>
            <span>Contact: adminsequenceai@gmail.com</span>
          </div>
          <div className="text-[10px] text-slate-300 leading-relaxed max-w-lg mx-auto">
            <p>본 서비스는 정보 제공을 위한 모니터링 도구입니다. 모든 투자 책임은 본인에게 있습니다.</p>
            <p className="mt-2 font-black text-slate-400 tracking-tighter">© 2024 COIN GAP MONITOR. BY SEQUEC AI.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}