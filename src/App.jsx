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

// 광고 컴포넌트 (사용자 ID ca-pub-7947485317948024 적용)
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

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans"><RefreshCcw className="animate-spin text-slate-400" size={32} /></div>;

  const btc = tickers['KRW-BTC'];
  const alt = tickers[selectedAlt];
  const btcRate = btc ? btc.signed_change_rate * 100 : 0;
  const altRate = alt ? alt.signed_change_rate * 100 : 0;
  const rateGap = btcRate - altRate;
  const altName = markets.find(m => m.market === selectedAlt)?.korean_name || selectedAlt;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pt-28 pb-12">
      {/* 상단 고정 광고 영역 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm flex items-center justify-center h-[90px]">
        <TopAdBanner />
      </div>

      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-8">
        {/* 헤더 및 설정 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Activity size={28} /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">비트코인 갭 모니터</h1>
              <p className="text-xs text-slate-400 tracking-wider">최근 업데이트: {lastUpdated.toLocaleTimeString()}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 px-1">알림 기준 (%)</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2 w-full sm:w-24 font-bold outline-none" value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 px-1">코인 선택</label>
              <select className="bg-slate-50 border border-slate-200 rounded-xl p-2 w-full sm:w-40 font-bold outline-none" value={selectedAlt} onChange={(e) => setSelectedAlt(e.target.value)}>
                {markets.map((m) => (<option key={m.market} value={m.market}>{m.korean_name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* 메인 갭 분석 */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-slate-400 font-medium mb-1 uppercase tracking-tighter">BTC vs {altName} Gap</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-6xl font-black">{Math.abs(rateGap).toFixed(2)}%p</span>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
              <p className="text-sm">현재 {altName}의 변동률이 비트코인 대비 <span className={rateGap > 0 ? 'text-blue-400' : 'text-red-400'}>{Math.abs(rateGap).toFixed(2)}%p {rateGap > 0 ? '낮습니다' : '높습니다'}</span>.</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
        </div>

        {/* 가격 정보 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 mb-1">비트코인 (BTC)</p>
            <p className="text-2xl font-bold">{btc?.trade_price.toLocaleString()} KRW</p>
            <p className={`text-sm font-bold ${btc?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>{(btc?.signed_change_rate * 100).toFixed(2)}%</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 mb-1">{altName} ({selectedAlt.replace('KRW-', '')})</p>
            <p className="text-2xl font-bold">{alt?.trade_price.toLocaleString()} KRW</p>
            <p className={`text-sm font-bold ${alt?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>{(alt?.signed_change_rate * 100).toFixed(2)}%</p>
          </div>
        </div>

        {Math.abs(rateGap) >= alertThreshold && (
          <div className="bg-red-600 text-white p-5 rounded-2xl flex items-center gap-4 animate-pulse shadow-lg">
            <Bell size={28} />
            <span className="font-bold">🚨 갭 위험 수준: 현재 {Math.abs(rateGap).toFixed(2)}%p 차이가 발생했습니다!</span>
          </div>
        )}

        {/* 하단 푸터 영역 (애드센스 승인 필수 문구) */}
        <footer className="mt-12 pt-8 border-t border-slate-200 text-center space-y-4">
          <div className="flex justify-center gap-6 text-xs font-medium text-slate-500">
            <button onClick={() => window.open('https://www.google.com/policies/technologies/ads', '_blank')} className="hover:text-blue-600">
              쿠키 정책
            </button>
            <button onClick={() => window.open('https://policies.google.com/privacy', '_blank')} className="hover:text-blue-600">
              개인정보 처리방침
            </button>
            <span>연락처: support@sequecai.com</span>
          </div>

          <div className="text-[10px] text-slate-400 leading-relaxed max-w-2xl mx-auto italic">
            <p>본 서비스는 정보 제공만을 목적으로 하며, 특정 자산의 매수/매도를 권유하지 않습니다.</p>
            <p>데이터의 정확성을 보장하지 않으며, 투자에 대한 모든 책임은 사용자 본인에게 있습니다.</p>
            <p>© 2024 Coin Gap Monitor. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}