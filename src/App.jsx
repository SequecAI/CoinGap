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
        <p>실시간 데이터 연결 중...</p>
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
      {/* 상단 고정 배너를 제거하여 pt-6으로 상단 여백을 대폭 줄였습니다. 
          이제 자동 광고(Auto Ads)가 알아서 적절한 위치에 광고를 노출합니다. */}

      <div className="max-w-4xl mx-auto space-y-6">

        {/* 헤더 섹션 */}
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
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter text-left">Alert Gap (%)</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter text-left">Target Coin</label>
              <select className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-44 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={selectedAlt} onChange={(e) => setSelectedAlt(e.target.value)}>
                {markets.map((m) => (<option key={m.market} value={m.market}>{m.korean_name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* 갭 수치 메인 카드 */}
        <div className="bg-slate-900 rounded-[2rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 text-left">
            <h3 className="text-slate-400 font-bold mb-2 text-sm md:text-base uppercase tracking-widest">BTC vs {altName} Gap</h3>
            <div className="flex items-baseline gap-3 mb-8">
              <span className="text-6xl md:text-8xl font-black tracking-tighter tabular-nums">{Math.abs(rateGap).toFixed(2)}%</span>
              <div className={`px-3 py-1 rounded-full text-xs font-black border ${rateGap > 0 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                {rateGap > 0 ? 'BTC STRONG' : 'ALT STRONG'}
              </div>
            </div>
            <div className="p-5 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl inline-block">
              <p className="text-sm md:text-base font-medium">
                현재 {altName}의 변동률이 비트코인보다 <span className={`font-black ${rateGap > 0 ? 'text-blue-400' : 'text-red-400'}`}>{Math.abs(rateGap).toFixed(2)}%p {rateGap > 0 ? '낮게' : '높게'}</span> 움직이고 있습니다.
              </p>
            </div>
          </div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] group-hover:bg-blue-600/30 transition-colors"></div>
        </div>

        {/* 상세 가격 정보 */}
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
            <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">{altName}</p>
            <p className="text-2xl md:text-3xl font-black mb-1 tracking-tight tabular-nums">{alt?.trade_price.toLocaleString()} KRW</p>
            <div className={`flex items-center gap-1 font-bold ${alt?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>
              {alt?.change === 'RISE' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{(alt?.signed_change_rate * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* 알람 영역 */}
        {Math.abs(rateGap) >= alertThreshold && (
          <div className="bg-red-600 text-white p-5 rounded-3xl flex items-center justify-between animate-pulse shadow-xl shadow-red-200 border-2 border-red-500">
            <div className="flex items-center gap-4">
              <Bell size={24} className="shrink-0" />
              <div className="text-left">
                <p className="font-black text-lg leading-none mb-1">GAP ALERT!</p>
                <p className="text-xs opacity-90 font-medium">격차가 {Math.abs(rateGap).toFixed(2)}% 발생했습니다.</p>
              </div>
            </div>
            <ChevronRight size={24} />
          </div>
        )}

        {/* 가이드 대시보드 */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-12 text-left">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="w-full p-6 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3 font-bold text-slate-800">
              <Info className="text-blue-600" size={20} />
              <span>활용 가이드 & 시장 분석</span>
            </div>
            <ChevronRight size={20} className={`transform transition-transform ${showInfo ? 'rotate-90' : ''}`} />
          </button>

          {showInfo && (
            <div className="p-8 space-y-8 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black">01</div>
                  <h4 className="font-bold text-slate-900">비트코인 지표</h4>
                  <p className="text-xs md:text-sm text-slate-500 leading-relaxed font-medium">전체 시장의 방향성을 보여주는 비트코인의 24시간 등락폭을 기준으로 설정합니다.</p>
                </div>
                <div className="space-y-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black">02</div>
                  <h4 className="font-bold text-slate-900">상대적 갭 측정</h4>
                  <p className="text-xs md:text-sm text-slate-500 leading-relaxed font-medium">선택한 코인이 비트코인보다 더 많이 빠졌거나, 덜 올랐을 때 생기는 갭을 확인합니다.</p>
                </div>
                <div className="space-y-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black">03</div>
                  <h4 className="font-bold text-slate-900">데이터 투명성</h4>
                  <p className="text-xs md:text-sm text-slate-500 leading-relaxed font-medium">업비트의 공개 API만을 실시간 연결하며, 어떠한 개인정보도 수집하지 않습니다.</p>
                </div>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl flex gap-4 items-center">
                <ShieldCheck className="text-green-600 shrink-0" size={24} />
                <p className="text-[11px] text-slate-500 leading-snug font-medium">
                  본 서비스는 투자 참고용이며 실제 거래 결과에 대한 책임을 지지 않습니다. 모든 데이터는 업비트 실시간 시세를 반영합니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 영역 */}
        <footer className="mt-12 pt-10 border-t border-slate-200 text-center space-y-6 px-4">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <button onClick={() => window.open('https://www.google.com/policies/technologies/ads', '_blank')} className="hover:text-blue-600 transition-colors">Cookies</button>
            <button onClick={() => window.open('https://policies.google.com/privacy', '_blank')} className="hover:text-blue-600 transition-colors">Privacy Policy</button>
            <span>Contact: adminsequenceai@gmail.com</span>
          </div>
          <div className="text-[10px] text-slate-300 leading-relaxed max-w-lg mx-auto">
            <p>Coin Gap Monitor is a real-time data visualization tool. Investing in cryptocurrency carries risk.</p>
            <p className="mt-3 font-black text-slate-400 tracking-tighter uppercase">© 2024 COIN GAP MONITOR. BUILT BY SEQUEC AI.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}