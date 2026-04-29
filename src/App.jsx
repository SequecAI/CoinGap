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
  BarChart3,
  Zap,
  Gauge,
  PieChart,
  MoveUpRight
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
  return null;
};

export default function App() {
  const [markets, setMarkets] = useState([]);
  const [selectedAlt, setSelectedAlt] = useState(TARGET_ALTS[0]);
  const [tickers, setTickers] = useState({});
  const [dominance, setDominance] = useState(52.5);
  const [ma20, setMa20] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [alertThreshold, setAlertThreshold] = useState(2.0);
  const [zScoreThreshold, setZScoreThreshold] = useState(3.0);
  const [showInfo, setShowInfo] = useState(true);

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

  // 2. 이격도 계산을 위한 과거 데이터 가져오기
  useEffect(() => {
    let isMounted = true;
    const fetchCandles = async () => {
      try {
        const data = await safeFetch(`https://api.upbit.com/v1/candles/days?market=${selectedAlt}&count=20`);
        if (isMounted && data && data.length > 0) {
          const avg = data.reduce((acc, curr) => acc + curr.trade_price, 0) / data.length;
          setMa20(avg);
        }
      } catch (error) { }
    };
    fetchCandles();
    return () => { isMounted = false; };
  }, [selectedAlt]);

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
  const currentGapMagnitude = Math.abs(rateGap);
  const thresholdMagnitude = Math.abs(alertThreshold);

  const zScoreValue = (rateGap / 1.2).toFixed(1);
  const zNum = parseFloat(zScoreValue);
  const currentZScoreMagnitude = Math.abs(zNum);
  const zScoreThresholdMagnitude = Math.abs(zScoreThreshold);

  const getZLabel = (val) => {
    if (val >= 3.0) return { text: 'Alt Undervalued', color: 'text-red-500', bg: 'bg-red-500/10' };
    if (val >= 1.5) return { text: 'Alt Weak', color: 'text-orange-400', bg: 'bg-orange-400/10' };
    if (val <= -3.0) return { text: 'Alt Overheated', color: 'text-blue-500', bg: 'bg-blue-500/10' };
    if (val <= -1.5) return { text: 'Alt Strong', color: 'text-indigo-400', bg: 'bg-indigo-400/10' };
    return { text: 'Neutral', color: 'text-slate-400', bg: 'bg-slate-400/10' };
  };
  const zLabel = getZLabel(zNum);

  const btcVol = btc ? btc.acc_trade_price_24h : 0;
  const altVol = alt ? alt.acc_trade_price_24h : 0;
  const volRatio = btcVol > 0 ? (altVol / btcVol) * 100 : 0;

  const rsiStrength = altRate > btcRate ? 'Stronger' : 'Weaker';
  const disparity = (alt && ma20 > 0) ? (alt.trade_price / ma20) * 100 : 100;
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
            <div className="text-left">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">코인 갭 모니터</h1>
              <div className="flex items-center gap-2 text-slate-400 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-[10px] font-bold uppercase tracking-wider">{lastUpdated.toLocaleTimeString()} 업데이트</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-blue-500 px-1 uppercase tracking-tighter">Gap Alert(%)</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all tabular-nums text-left" value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-orange-400 px-1 uppercase tracking-tighter">Z-Score Alert</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-orange-500 transition-all tabular-nums text-left" value={zScoreThreshold} onChange={(e) => setZScoreThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter">Compare</label>
              <select className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-40 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 transition-all text-left" value={selectedAlt} onChange={(e) => setSelectedAlt(e.target.value)}>
                {markets.length > 0 ? markets.map((m) => (<option key={m.market} value={m.market}>{m.korean_name}</option>)) : <option value={selectedAlt}>{selectedAlt}</option>}
              </select>
            </div>
          </div>
        </div>

        {/* 대시보드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-left">
                <Coins size={16} className="text-blue-400" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">Price Spread</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-4 text-left">
                <span className="text-5xl font-black tracking-tighter tabular-nums">{currentGapMagnitude.toFixed(2)}%</span>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${rateGap > 0 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                  {rateGap > 0 ? 'BTC STRONG' : 'ALT STRONG'}
                </div>
              </div>
              <p className="text-xs text-slate-400 font-medium leading-relaxed border-t border-white/10 pt-4 text-left font-sans">
                비트코인 대비 <span className="text-blue-400 font-bold">변동률 차이</span>입니다. 격차가 벌어질수록 회귀 가능성이 높아집니다.
              </p>
            </div>
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-600/10 rounded-full blur-[60px]"></div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-left">
                <Gauge size={16} className="text-orange-400" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">Gap Z-Score</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-4 text-left">
                <span className="text-5xl font-black tracking-tighter tabular-nums">{zScoreValue}</span>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-tighter ${zLabel.bg} ${zLabel.color} border-white/10`}>
                  {zLabel.text}
                </div>
              </div>
              <p className="text-xs text-slate-400 font-medium leading-relaxed border-t border-white/10 pt-4 text-left font-sans">
                비트코인 대비 <span className="text-orange-400 font-bold">상대적 가격 괴리 지수</span>입니다. +3.0 초과 시 알트 저평가 매수 신호, -3.0 미만 시 알트 고평가 매도 신호로 활용합니다.
              </p>
            </div>
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-orange-600/10 rounded-full blur-[60px]"></div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-left">
                <BarChart3 size={16} className="text-purple-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">Volume Intensity</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-4 text-left">
                <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900">{volRatio.toFixed(1)}%</span>
                <div className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-purple-50 text-purple-600 border-purple-100 font-sans">
                  RELATIVE TO BTC
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-left font-sans">
                BTC 거래대금 대비 {altName}의 비율입니다. 수치가 높을수록 <span className="text-purple-600 font-bold">시장 관심도</span>가 높음을 의미합니다.
              </p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-left">
                <Zap size={16} className="text-amber-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">Relative Strength</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-4 text-left">
                <span className={`text-4xl font-black tracking-tighter uppercase ${rsiStrength === 'Stronger' ? 'text-amber-600' : 'text-slate-400'}`}>
                  {rsiStrength}
                </span>
                <div className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-amber-50 text-amber-600 border-amber-100 font-sans">
                  MOMENTUM
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-left font-sans">
                비트코인 대비 탄력성입니다. <span className="text-amber-600 font-bold">Stronger</span>는 알트 우세, <span className="text-slate-400 font-bold">Weaker</span>는 비트코인 위주 장세를 뜻합니다.
              </p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-left">
                <PieChart size={16} className="text-orange-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">BTC Dominance</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-4 text-left">
                <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900">{dominance.toFixed(1)}%</span>
                <div className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-orange-50 text-orange-600 border-orange-100 font-sans">
                  MARKET SHARE
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-left font-sans">
                전체 시장 중 <span className="text-orange-600 font-bold">BTC 비중</span>입니다. 점유율 하락 시 알트코인 반등 확률이 높아집니다.
              </p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-left">
                <MoveUpRight size={16} className="text-emerald-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">MA20 Disparity</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-4 text-left">
                <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900">{disparity.toFixed(1)}%</span>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${disparity > 105 ? 'bg-red-50 text-red-600 border-red-100' : disparity < 95 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'} font-sans uppercase`}>
                  {disparity > 105 ? 'Overheated' : disparity < 95 ? 'Oversold' : 'Stable'}
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-left font-sans">
                20일 평균가 대비 <span className="text-emerald-600 font-bold">괴리율</span>입니다. 100%를 기준으로 현재 가격의 과열도를 판단합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 상세 가격 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-left">
            <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Bitcoin (BTC)</p>
            <p className="text-3xl font-black mb-1 tracking-tight tabular-nums">{btc?.trade_price.toLocaleString()} KRW</p>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1 font-bold ${btc?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>
                <span>{(btc?.signed_change_rate * 100).toFixed(2)}%</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold tabular-nums">Vol: {(btcVol / 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}억</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-left">
            <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">{altName}</p>
            <p className="text-3xl font-black mb-1 tracking-tight tabular-nums">{alt?.trade_price.toLocaleString()} KRW</p>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1 font-bold ${alt?.change === 'RISE' ? 'text-red-500' : 'text-blue-500'}`}>
                <span>{(alt?.signed_change_rate * 100).toFixed(2)}%</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold tabular-nums">Vol: {(altVol / 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}억</span>
            </div>
          </div>
        </div>

        {/* 알림 메시지 */}
        {(currentGapMagnitude >= thresholdMagnitude || currentZScoreMagnitude >= zScoreThresholdMagnitude) && (
          <div className="bg-red-600 text-white p-5 rounded-3xl flex items-center justify-between animate-pulse shadow-xl shadow-red-200 border-2 border-red-500">
            <div className="flex items-center gap-4 text-left">
              <Bell size={24} className="shrink-0" />
              <div className="text-left">
                <p className="font-black text-lg uppercase leading-none text-left tracking-tighter">Market Volatility Alert!</p>
                <p className="text-xs font-bold opacity-90 mt-1">
                  {currentGapMagnitude >= thresholdMagnitude && `Gap: ${currentGapMagnitude.toFixed(2)}% `}
                  {currentZScoreMagnitude >= zScoreThresholdMagnitude && `Z-Score: ${zScoreValue}`}
                </p>
              </div>
            </div>
            <ChevronRight size={24} />
          </div>
        )}

        {/* 정보성 섹션 */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-12 text-left">
          <button onClick={() => setShowInfo(!showInfo)} className="w-full p-6 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <Info className="text-blue-500" size={20} />
              <h2 className="text-lg font-bold text-slate-800 leading-none font-sans">어떻게 활용하나요?</h2>
            </div>
            <div className={`transform transition-transform ${showInfo ? 'rotate-90' : ''}`}>
              <ChevronRight size={20} />
            </div>
          </button>

          {showInfo && (
            <div className="p-8 space-y-8 border-t border-slate-100 text-left font-sans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black">1</div>
                  <h4 className="font-bold">비트코인 기준</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed font-sans">비트코인의 최근 24시간 변동률을 시장의 기준으로 잡습니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black">2</div>
                  <h4 className="font-bold">상대적 갭 측정</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed font-sans">알트코인이 비트코인 대비 덜 상승/하락한 갭을 수치화합니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black">3</div>
                  <h4 className="font-bold">트레이딩 전략</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed font-sans">갭이 + 방향으로 커지면 <strong className="text-red-600 font-bold underline decoration-red-200 underline-offset-2 font-sans">과매수</strong>, - 방향으로 커지면 <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2 font-sans">과매도</strong> 구간으로 활용합니다.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 space-y-4 font-sans text-left">
                <div className="flex items-center gap-2 text-slate-800 font-bold mb-2">
                  <BookOpen size={18} className="text-blue-500" />
                  <span>시장 분석 가이드 (Tip)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left font-sans">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter text-left">Relative Indicators</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      <strong className="text-red-600 font-bold underline decoration-red-200 underline-offset-2 font-sans">과매수</strong>가 발생했을 경우, 알트코인의 <strong>하락</strong> 가능성을 체크해 보세요. <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2 font-sans">과매도</strong>가 발생했을 경우, 알트코인의 <strong>상승</strong> 가능성을 체크해 보세요.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left font-sans">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter text-left">Gap Recovery</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      갭이 평소보다 과하게 벌어진 이후에는 원상태로 돌아가려는 경향이 있습니다. 이 성질을 잘 활용해보세요.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left font-sans">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter text-left">Statistical Edge</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Z-Score가 <strong className="text-orange-600 font-bold">3.0</strong>을 넘어서면 비트코인이 알트 대비 통계적 한계치까지 과하게 상승한 <strong className="text-red-600 font-bold">가격 왜곡</strong> 상태를 의미하며, 이후 갭이 좁혀지며 알트코인이 <strong className="text-blue-600 font-bold">키맞추기 상승</strong>을 할 가능성이 높습니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left font-sans">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter text-left">Dominance Context</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      비트코인 도미넌스가 <span className="text-orange-600 font-bold">강하게 상승</span> 중일 때는 갭이 벌어져도 알트코인 반등이 약할 수 있으니 주의가 필요합니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-start border border-blue-100 text-left">
                <ShieldCheck className="text-blue-600 shrink-0" size={20} />
                <p className="text-[11px] text-blue-800 font-medium leading-tight text-left">업비트 및 글로벌 금융 API를 사용하여 실시간으로 데이터를 분석하는 투명한 모니터링 환경입니다.</p>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-12 pt-10 border-t border-slate-200 text-center space-y-6 px-4">
          <div className="flex justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
            <button onClick={() => window.open('https://www.google.com/policies/technologies/ads', '_blank')} className="hover:text-blue-600 transition-colors">Cookies</button>
            <button onClick={() => window.open('https://policies.google.com/privacy', '_blank')} className="hover:text-blue-600 transition-colors">Privacy Policy</button>
            <span>Contact: adminsequenceai@gmail.com</span>
          </div>
          <div className="text-[10px] text-slate-300 leading-relaxed max-w-lg mx-auto tabular-nums text-center italic font-medium">
            <p>본 서비스는 정보 제공을 위한 모니터링 도구입니다. 모든 투자 책임은 본인에게 있습니다.</p>
            <p className="mt-2 font-black text-slate-400 tracking-tighter not-italic uppercase tracking-widest text-center">© 2024 COIN GAP MONITOR. BY SEQUEC AI.</p>
          </div>
        </footer>
      </div>
      <Analytics />
    </div>
  );
}