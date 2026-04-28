import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  Activity,
  Coins,
  Bell,
  Info,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  LineChart
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans font-medium text-slate-400">
      <div className="flex flex-col items-center gap-4">
        <RefreshCcw className="animate-spin" size={32} />
        <p>암호화폐 실시간 데이터 분석 중...</p>
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pt-6 pb-20 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 상단 컨트롤러 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
              <Activity size={24} />
            </div>
            <div className="text-left">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">코인 갭 모니터</h1>
              <div className="flex items-center gap-2 text-slate-400 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-[10px] font-bold uppercase tracking-wider">{lastUpdated.toLocaleTimeString()} Live</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter">Alert Threshold (%)</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter">Target Asset</label>
              <select className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-44 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer" value={selectedAlt} onChange={(e) => setSelectedAlt(e.target.value)}>
                {markets.map((m) => (<option key={m.market} value={m.market}>{m.korean_name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* 갭 메인 분석 보드 */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 text-left">
            <h3 className="text-slate-400 font-bold mb-2 text-sm md:text-base uppercase tracking-widest">Market Rate Analysis</h3>
            <div className="flex items-baseline gap-3 mb-8">
              <span className="text-6xl md:text-8xl font-black tracking-tighter tabular-nums">{Math.abs(rateGap).toFixed(2)}%</span>
              <div className={`px-3 py-1 rounded-full text-xs font-black border ${rateGap > 0 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                {rateGap > 0 ? '비트 강세' : '알트 강세'}
              </div>
            </div>
            <div className="p-5 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl">
              <p className="text-sm md:text-base font-medium leading-relaxed">
                현재 <span className="font-bold underline decoration-blue-500 decoration-2 underline-offset-4 text-white">{altName}</span>의 변동률이 비트코인 대비 <span className={`font-black ${rateGap > 0 ? 'text-blue-400' : 'text-red-400'}`}>{Math.abs(rateGap).toFixed(2)}%p {rateGap > 0 ? '낮은' : '높은'}</span> 흐름을 보이고 있습니다.
              </p>
            </div>
          </div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px]"></div>
        </div>

        {/* 가격 정보 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-left">
            <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Bitcoin (BTC)</p>
            <p className="text-2xl md:text-3xl font-black mb-1 tracking-tight tabular-nums">{btc?.trade_price.toLocaleString()} KRW</p>
            <div className={`flex items-center gap-1 font-bold ${btc?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>
              {btc?.change === 'RISE' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{(btc?.signed_change_rate * 100).toFixed(2)}%</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-left">
            <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">{altName} (Market)</p>
            <p className="text-2xl md:text-3xl font-black mb-1 tracking-tight tabular-nums">{alt?.trade_price.toLocaleString()} KRW</p>
            <div className={`flex items-center gap-1 font-bold ${alt?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>
              {alt?.change === 'RISE' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{(alt?.signed_change_rate * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* 알람 바 */}
        {Math.abs(rateGap) >= alertThreshold && (
          <div className="bg-red-600 text-white p-5 rounded-3xl flex items-center justify-between animate-pulse shadow-xl shadow-red-200 border-2 border-red-500">
            <div className="flex items-center gap-4">
              <Bell size={24} className="shrink-0" />
              <div className="text-left font-black">
                <p className="text-lg leading-none mb-1 uppercase">Gap Limit Exceeded</p>
                <p className="text-xs opacity-90">{Math.abs(rateGap).toFixed(2)}% 차이 발생</p>
              </div>
            </div>
            <ChevronRight size={24} />
          </div>
        )}

        {/* 정보성 텍스트 보강 섹션 (애드센스 승인용) */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-left space-y-6">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <BookOpen size={20} />
            <h2 className="text-lg font-bold">암호화폐 시장 분석 가이드</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-medium">
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 border-l-4 border-blue-500 pl-3">비트코인 동조화와 시간차</h4>
              <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                암호화폐 시장에서 비트코인은 지배적인 지표입니다. 보통 비트코인이 먼저 움직이고 알트코인이 그 흐름을 따르는 동조화 현상이 발생합니다. 본 모니터링 도구는 이 과정에서 발생하는 미세한 시간차(%p 갭)를 포착하여 시각화합니다.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 border-l-4 border-blue-500 pl-3">분석 데이터의 가치</h4>
              <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                갭이 평소보다 과하게 벌어질 때 시장 참여자들의 심리 변화를 유추할 수 있습니다. 예를 들어 비트코인은 상승하지만 알트코인이 하락하여 갭이 커질 경우, 시장의 자금이 대장주로 쏠리는 '도미넌스 상승' 구간으로 해석될 수 있습니다.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-50">
            <div className="flex items-center gap-2 text-slate-800 font-bold mb-4">
              <LineChart size={18} className="text-blue-500" />
              <span>실시간 시장 분석 지표 설명</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-slate-700 mb-1">24시간 변동률 (Rate)</p>
                <p className="text-[11px] text-slate-500 leading-snug">업비트 종가 기준, 당일 자정부터 현재까지의 시세 변화를 백분율로 나타낸 실시간 값입니다.</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-slate-700 mb-1">퍼센트포인트 (Gap)</p>
                <p className="text-[11px] text-slate-500 leading-snug">비트코인과 알트코인 변동률 간의 단순 수치 차이로, 시장의 상대적 강도를 의미합니다.</p>
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <footer className="mt-12 pt-10 border-t border-slate-200 text-center space-y-6 px-4">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <button onClick={() => window.open('https://www.google.com/policies/technologies/ads', '_blank')} className="hover:text-blue-600 transition-colors">Cookies</button>
            <button onClick={() => window.open('https://policies.google.com/privacy', '_blank')} className="hover:text-blue-600 transition-colors">Privacy Policy</button>
            <span>Contact: adminsequenceai@gmail.com</span>
          </div>
          <div className="text-[10px] text-slate-300 leading-relaxed max-w-lg mx-auto">
            <p>모든 데이터는 실시간 통신 환경에 따라 실제와 차이가 있을 수 있으며, 투자에 대한 모든 책임은 사용자 본인에게 있습니다.</p>
            <p className="mt-3 font-black text-slate-400 tracking-tighter uppercase">© 2024 COIN GAP MONITOR. EMPOWERED BY SEQUEC AI.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}