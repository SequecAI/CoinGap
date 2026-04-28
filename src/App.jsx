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
  BookOpen
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

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
      <div className="flex flex-col items-center gap-4 text-slate-500">
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pt-6 pb-20 px-4 text-left">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 상단 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
              <Activity size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">코인 갭 모니터</h1>
              <div className="flex items-center gap-2 text-slate-400 mt-1">
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
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter">Gap Alarm(%)</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all tabular-nums" value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter">Compare</label>
              <select className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-40 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 transition-all" value={selectedAlt} onChange={(e) => setSelectedAlt(e.target.value)}>
                {markets.map((m) => (<option key={m.market} value={m.market}>{m.korean_name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* 갭 수치 메인 카드 */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="text-slate-400 font-bold mb-1 text-lg uppercase tracking-widest">BTC vs {altName} Spread</h3>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-6xl md:text-8xl font-black tracking-tighter tabular-nums">{Math.abs(rateGap).toFixed(2)}%</span>
              <div className={`px-3 py-1 rounded-full text-xs font-black border ${rateGap > 0 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                {rateGap > 0 ? 'BTC STRONG' : 'ALT STRONG'}
              </div>
            </div>
            <div className="p-5 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl inline-block">
              <p className="text-base font-medium leading-relaxed">
                현재 {altName}의 변동률이 비트코인 대비 <span className={`font-black ${rateGap > 0 ? 'text-blue-400' : 'text-red-400'}`}>{Math.abs(rateGap).toFixed(2)}%p {rateGap > 0 ? '낮게' : '높게'}</span> 형성되어 있습니다.
              </p>
            </div>
          </div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px]"></div>
        </div>

        {/* 상세 정보 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-widest">Bitcoin (BTC)</p>
            <p className="text-3xl font-black mb-1 tracking-tight tabular-nums">{btc?.trade_price.toLocaleString()} KRW</p>
            <div className={`flex items-center gap-1 font-bold ${btc?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>
              {btc?.change === 'RISE' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{(btc?.signed_change_rate * 100).toFixed(2)}%</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-widest">{altName}</p>
            <p className="text-3xl font-black mb-1 tracking-tight tabular-nums">{alt?.trade_price.toLocaleString()} KRW</p>
            <div className={`flex items-center gap-1 font-bold ${alt?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>
              {alt?.change === 'RISE' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{(alt?.signed_change_rate * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* 알림 메시지 */}
        {Math.abs(rateGap) >= alertThreshold && (
          <div className="bg-red-600 text-white p-5 rounded-3xl flex items-center justify-between animate-pulse shadow-xl shadow-red-200 border-2 border-red-500">
            <div className="flex items-center gap-4">
              <Bell size={24} className="shrink-0" />
              <p className="font-black text-lg uppercase leading-none">Gap Alert! ({Math.abs(rateGap).toFixed(2)}%)</p>
            </div>
            <ChevronRight size={24} />
          </div>
        )}

        {/* 정보성 섹션 (통합 가이드) */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-12">
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
            <div className="p-8 space-y-8 border-t border-slate-100">
              {/* 1-2-3 단계 가이드 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black">1</div>
                  <h4 className="font-bold">비트코인 기준</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">비트코인의 최근 24시간 변동률을 시장의 기준으로 잡습니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black">2</div>
                  <h4 className="font-bold">상대적 갭 측정</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">알트코인이 비트코인 대비 덜 상승/하락한 갭을 수치화합니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black">3</div>
                  <h4 className="font-bold">트레이딩 전략</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">갭이 + 방향으로 커지면 <strong className="text-red-600 font-bold underline decoration-red-200 underline-offset-2">과매수</strong>, - 방향으로 커지면 <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2">과매도</strong> 구간으로, 갭상승/갭하락 투자에 활용할 수 있습니다.</p>
                </div>
              </div>

              {/* 시장 분석 가이드 (Tip) 섹션 업데이트 */}
              <div className="pt-6 border-t border-slate-50 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold mb-2">
                  <BookOpen size={18} className="text-blue-500" />
                  <span>시장 분석 가이드 (Tip)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Relative Indicators</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      <strong className="text-red-600 font-bold underline decoration-red-200 underline-offset-2">과매수</strong>가 발생했을 경우, 알트코인의 <strong>하락</strong> 가능성을 체크해 보세요. <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2">과매도</strong>가 발생했을 경우, 알트코인의 <strong>상승</strong> 가능성을 체크해 보세요.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Gap Recovery</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      갭이 평소보다 과하게 벌어진 이후에는 원상태로 돌아가려는 경향이 있습니다. 이 성질을 잘 활용해보세요.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-start">
                <ShieldCheck className="text-blue-600 shrink-0" size={20} />
                <p className="text-xs text-blue-800 font-medium leading-tight">업비트 Public API를 사용하여 어떠한 개인 정보나 키를 요구하지 않는 안전한 모니터링 환경입니다.</p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 영역 */}
        <footer className="mt-12 pt-10 border-t border-slate-200 text-center space-y-6">
          <div className="flex justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <button onClick={() => window.open('https://www.google.com/policies/technologies/ads', '_blank')} className="hover:text-blue-600 transition-colors">Cookies</button>
            <button onClick={() => window.open('https://policies.google.com/privacy', '_blank')} className="hover:text-blue-600 transition-colors">Privacy Policy</button>
            <span>Contact: adminsequenceai@gmail.com</span>
          </div>
          <div className="text-[10px] text-slate-300 leading-relaxed max-w-lg mx-auto italic font-medium px-4 tabular-nums">
            <p>본 서비스는 정보 제공을 위한 모니터링 도구입니다. 모든 투자 책임은 본인에게 있습니다.</p>
            <p className="mt-2 font-black text-slate-400 tracking-tighter not-italic uppercase tracking-widest">© 2024 COIN GAP MONITOR. BY SEQUEC AI.</p>
          </div>
        </footer>
      </div>
      <Analytics />
    </div>
  );
}