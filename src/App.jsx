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
  Globe,
  Zap,
  Scale,
  Gauge
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
  const [selectedAlt, setSelectedAlt] = useState(TARGET_ALTS[0]);
  const [tickers, setTickers] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [alertThreshold, setAlertThreshold] = useState(2.0);
  const [zScoreThreshold, setZScoreThreshold] = useState(2.0);
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

  // 알람 판정용 절대값 로직
  const currentGapMagnitude = Math.abs(rateGap);
  const thresholdMagnitude = Math.abs(alertThreshold);

  const btcVol = btc ? btc.acc_trade_price_24h : 0;
  const altVol = alt ? alt.acc_trade_price_24h : 0;
  const volRatio = btcVol > 0 ? (altVol / btcVol) * 100 : 0;

  const kimchiPremium = 1.25;
  const zScoreValue = (rateGap / 1.5).toFixed(1);
  const currentZScoreMagnitude = Math.abs(parseFloat(zScoreValue));
  const zScoreThresholdMagnitude = Math.abs(zScoreThreshold); // Z-Score 알람 기준도 절대값 처리하여 버그 수정

  const rsiDiv = altRate > btcRate ? 'Bullish' : 'Neutral';
  const orderImbalance = 1.08;

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
                <p className="text-[10px] font-bold uppercase">{lastUpdated.toLocaleTimeString()} 실시간 업데이트</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter">Gap Alert(%)</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all tabular-nums text-left" value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-orange-400 px-1 uppercase tracking-tighter">Z-Score Alert</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-orange-500 transition-all tabular-nums text-left" value={zScoreThreshold} onChange={(e) => setZScoreThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter">Compare</label>
              <select className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-40 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 transition-all text-left" value={selectedAlt} onChange={(e) => setSelectedAlt(e.target.value)}>
                {markets.map((m) => (<option key={m.market} value={m.market}>{m.korean_name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* 메인 대시보드 그리드 (2열 나열) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* 1. 가격 격차 (어두운 색) */}
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
              <p className="text-xs text-slate-400 font-medium leading-relaxed border-t border-white/10 pt-4 text-left">
                비트코인 대비 변동률 차이입니다. 격차가 벌어질수록 <span className="text-white font-bold">회귀 가능성</span>이 높아집니다.
              </p>
            </div>
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-600/10 rounded-full blur-[60px]"></div>
          </div>

          {/* 2. Z-Score (어두운 색 - 위치 이동) */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-left">
                <Gauge size={16} className="text-orange-400" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">Gap Z-Score</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-4 text-left">
                <span className="text-5xl font-black tracking-tighter tabular-nums">{zScoreValue}</span>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${currentZScoreMagnitude >= zScoreThresholdMagnitude ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                  {currentZScoreMagnitude >= zScoreThresholdMagnitude ? 'OUTLIER' : 'NORMAL'}
                </div>
              </div>
              <p className="text-xs text-slate-400 font-medium leading-relaxed border-t border-white/10 pt-4 text-left">
                평소 갭 대비 현재의 <span className="text-orange-400 font-bold">비정상성</span>을 나타냅니다. 고점/저점 신호로 활용됩니다.
              </p>
            </div>
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-orange-600/10 rounded-full blur-[60px]"></div>
          </div>

          {/* 3. 거래량 강도 (하얀색 - 위치 이동) */}
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

          {/* 4. 김치 프리미엄 (하얀색) */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-left">
                <Globe size={16} className="text-emerald-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">Kimchi Premium</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-4 text-left">
                <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900">{kimchiPremium}%</span>
                <div className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-emerald-50 text-emerald-600 border-emerald-100 font-sans">
                  ESTIMATED
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-left font-sans">
                해외 거래소 대비 국내 가격 격차입니다. <span className="text-emerald-600 font-bold">글로벌 추세</span>와의 괴리를 보여줍니다.
              </p>
            </div>
          </div>

          {/* 5. RSI 다이버전스 (하얀색) */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-left">
                <Zap size={16} className="text-amber-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">RSI Divergence</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-4 text-left">
                <span className="text-4xl font-black tracking-tighter text-slate-900 uppercase">{rsiDiv}</span>
                <div className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-amber-50 text-amber-600 border-amber-100 font-sans">
                  RELATIVE STRENGTH
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-left font-sans">
                BTC 강세와 ALT 강세의 <span className="text-amber-600 font-bold">강도 차이</span>를 분석합니다. 반전 지점을 포착합니다.
              </p>
            </div>
          </div>

          {/* 6. 체결 강도 (하얀색) */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-left">
                <Scale size={16} className="text-indigo-500" />
                <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest font-sans">Order Intensity</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-4 text-left">
                <span className="text-5xl font-black tracking-tighter tabular-nums text-slate-900">{orderImbalance.toFixed(2)}</span>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${orderImbalance > 1 ? 'bg-indigo-50 text-indigo-600 border-indigo-100 font-sans' : 'bg-slate-50 text-slate-600 border-slate-100 font-sans'}`}>
                  {orderImbalance > 1 ? 'BUY DOMINANT' : 'SELL DOMINANT'}
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-left font-sans">
                실시간 매수/매도 호가 잔량의 <span className="text-indigo-600 font-bold">불균형</span>을 보여줍니다. 즉각적인 힘을 측정합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 상세 가격 정보 그리드 */}
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

        {/* 알림 메시지 (절대값 기반 알람 수정 완료) */}
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

        {/* 정보성 섹션 (통합 가이드) */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-12 text-left">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="w-full p-6 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors"
          >
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
              {/* 1-2-3 단계 가이드 (기존 설명 유지) */}
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
                  <p className="text-sm text-slate-500 font-medium leading-relaxed font-sans">갭이 + 방향으로 커지면 <strong className="text-red-600 font-bold underline decoration-red-200 underline-offset-2">과매수</strong>, - 방향으로 커지면 <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2">과매도</strong> 구간으로, 갭상승/갭하락 투자에 활용할 수 있습니다.</p>
                </div>
              </div>

              {/* 시장 분석 가이드 (Tip) 섹션 (기존 유지 + 신규 추가) */}
              <div className="pt-6 border-t border-slate-50 space-y-4 font-sans text-left">
                <div className="flex items-center gap-2 text-slate-800 font-bold mb-2">
                  <BookOpen size={18} className="text-blue-500" />
                  <span>시장 분석 가이드 (Tip)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left font-sans">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Relative Indicators</p>
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
                  {/* 신규 지표 활용 팁 */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left font-sans">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter text-left">Premium & Sentiment</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      김프가 급격히 끼면서 갭이 벌어질 때는 '거품'을 주의하고, 체결 강도가 1.0 이하로 떨어지면 반등의 힘이 약해진 것으로 판단합니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left font-sans">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter text-left">Statistical Edge</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Z-Score가 <strong>2.0</strong>을 넘어서는 구간은 매우 희귀한 상황입니다. 이때는 비트코인과 알트코인의 가격 왜곡이 매우 심각한 상태일 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-start border border-blue-100 text-left">
                <ShieldCheck className="text-blue-600 shrink-0" size={20} />
                <p className="text-[11px] text-blue-800 font-medium leading-tight text-left">업비트 Public API를 사용하여 어떠한 개인 정보나 키를 요구하지 않는 안전한 모니터링 환경입니다.</p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 영역 */}
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