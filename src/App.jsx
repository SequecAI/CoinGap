import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Info,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  RefreshCcw
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { useUpbitData } from './hooks/useUpbitData';
import DashboardTab from './tabs/DashboardTab';
import AnalysisTab from './tabs/AnalysisTab';

export default function App() {
  const {
    markets,
    selectedAlt,
    setSelectedAlt,
    tickers,
    dominance,
    ma20,
    momentum5m,
    candles5m,
    dayCandles,
    loading,
    lastUpdated
  } = useUpbitData();

  const [dropThreshold, setDropThreshold] = useState(2.0);
  const [zScoreThreshold, setZScoreThreshold] = useState(3.0);
  const [showInfo, setShowInfo] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // 탭 상태 추가

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
  const zScoreValue = (rateGap / 1.2).toFixed(1);
  const zNum = parseFloat(zScoreValue);

  const currentDropMagnitude = Math.abs(momentum5m);
  const currentZScoreMagnitude = Math.abs(zNum);

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

  // 명칭 변환: 긴 이름 축약 처리
  const getDisplayName = (m) => {
    if (m.market === 'KRW-XRP') return '리플';
    if (m.market === 'KRW-DOGE') return '도지';
    return m.korean_name;
  };
  const currentMarket = markets.find(m => m.market === selectedAlt);
  const altName = currentMarket ? getDisplayName(currentMarket) : selectedAlt;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pt-6 pb-20 px-4 text-left">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 상단 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-4 text-left font-sans">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
              <Activity size={28} />
            </div>
            <div className="text-left font-sans">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none font-sans">코인 갭 모니터</h1>
              <div className="flex items-center gap-2 text-slate-400 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-[10px] font-bold uppercase tracking-wider">{lastUpdated.toLocaleTimeString()} 업데이트</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 font-sans text-left">
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-blue-500 px-1 uppercase tracking-tighter">DROP ALERT</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all tabular-nums text-left" value={dropThreshold} onChange={(e) => setDropThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-orange-400 px-1 uppercase tracking-tighter">Z-Score Alert</label>
              <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-orange-500 transition-all tabular-nums text-left" value={zScoreThreshold} onChange={(e) => setZScoreThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-tighter">Compare</label>
              <select className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-40 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 transition-all text-left font-sans" value={selectedAlt} onChange={(e) => setSelectedAlt(e.target.value)}>
                {markets.map((m) => (<option key={m.market} value={m.market}>{getDisplayName(m)}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* 탭 내비게이션 추가 */}
        <div className="flex gap-2 bg-slate-200/50 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            Divergence
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('multi')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'multi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            Multi-View
          </button>
        </div>

        {/* 탭 내용 */}
        {activeTab === 'dashboard' && (
          selectedAlt === 'KRW-BTC' ? (
            <div className="bg-white p-16 rounded-[2.5rem] border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center">
              <Info size={48} className="text-blue-500 mb-4 opacity-80" />
              <p className="text-slate-700 font-black text-xl mb-2 tracking-tight">Divergence 기능은 알트코인 전용입니다.</p>
              <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-sm mx-auto">
                이 탭은 비트코인 대비 알트코인의 상대적 흐름(Gap)을 분석합니다. <br />상단 Compare 메뉴에서 <strong className="text-blue-500">알트코인</strong>을 선택해 주세요.
              </p>
            </div>
          ) : (
            <DashboardTab
              momentum5m={momentum5m}
              zScoreValue={zScoreValue}
              zLabel={zLabel}
              volRatio={volRatio}
              rsiStrength={rsiStrength}
              dominance={dominance}
              disparity={disparity}
              altName={altName}
              btc={btc}
              alt={alt}
              btcVol={btcVol}
              altVol={altVol}
            />
          )
        )}
        
        {activeTab === 'analysis' && (
          <AnalysisTab
            candles5m={candles5m}
            dayCandles={dayCandles}
            btcRate={btcRate}
            altRate={altRate}
            altName={altName}
            alt={alt}
            momentum5m={momentum5m}
          />
        )}

        {activeTab === 'multi' && (
          <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
            <p className="text-slate-500 font-bold">Multi-View 준비중...</p>
          </div>
        )}

        {/* 알림 메시지 (두 줄 구성 및 명칭 통일) - 탭과 무관하게 상시 표시 */}
        {(currentDropMagnitude >= dropThreshold || currentZScoreMagnitude >= zScoreThreshold) && (
          <div className="bg-red-600 text-white p-5 rounded-3xl flex items-center justify-between animate-pulse shadow-xl shadow-red-200 border-2 border-red-500 font-sans">
            <div className="flex items-center gap-4 text-left">
              <Bell size={24} className="shrink-0" />
              <div className="text-left font-sans space-y-1">
                <p className="font-black text-lg uppercase leading-none tracking-tighter">Market Alert!</p>
                {currentDropMagnitude >= dropThreshold && (
                  <p className="text-xs font-bold opacity-90">
                    Momentum: <span className="tabular-nums">{momentum5m.toFixed(2)}%</span> (Threshold Exceeded)
                  </p>
                )}
                {currentZScoreMagnitude >= zScoreThreshold && (
                  <p className="text-xs font-bold opacity-90">
                    Z-Score: <span className="tabular-nums">{zScoreValue}</span> (Price Distortion Detected)
                  </p>
                )}
              </div>
            </div>
            <ChevronRight size={24} />
          </div>
        )}

        {/* 정보성 섹션 */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-12 text-left font-sans">
          <button onClick={() => setShowInfo(!showInfo)} className="w-full p-6 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 font-sans">
              <Info className="text-blue-500" size={20} />
              <h2 className="text-lg font-bold text-slate-800 leading-none">어떻게 활용하나요?</h2>
            </div>
            <div className={`transform transition-transform ${showInfo ? 'rotate-90' : ''}`}>
              <ChevronRight size={20} />
            </div>
          </button>

          {showInfo && activeTab === 'dashboard' && (
            <div className="p-8 space-y-8 border-t border-slate-100 text-left font-sans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
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
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">갭이 + 방향으로 커지면 <strong className="text-red-600 font-bold underline decoration-red-200 underline-offset-2">과매수</strong>, - 방향으로 커지면 <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2">과매도</strong> 구간으로 활용합니다.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 space-y-4 font-sans text-left">
                <div className="flex items-center gap-2 text-slate-800 font-bold mb-2">
                  <BookOpen size={18} className="text-blue-500" />
                  <span>시장 분석 가이드 (Tip)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Relative Indicators</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      <strong className="text-red-600 font-bold underline decoration-red-200 underline-offset-2 font-sans">과매수</strong>가 발생했을 경우, 알트코인의 <strong>하락</strong> 가능성을 체크해 보세요. <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2 font-sans">과매도</strong>가 발생했을 경우, 알트코인의 <strong>상승</strong> 가능성을 체크해 보세요.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Gap Recovery</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      갭이 평소보다 과하게 벌어진 이후에는 <strong className="text-orange-600 font-bold">원상태로 돌아가려는 경향</strong>이 있습니다. 이 성질을 잘 활용해보세요.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Statistical Edge</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Z-Score가 <strong className="text-orange-600 font-bold">3.0</strong>을 넘어서면 비트코인이 알트 대비 통계적 한계치까지 과하게 상승한 가격 왜곡 상태를 의미하며, 이후 갭이 좁혀지며 알트코인이 키맞추기 <strong className="text-red-600 font-bold">상승</strong>을 할 가능성이 높습니다. 반대로 <strong className="text-blue-600 font-bold">-3.0</strong>을 초과한다면 알트코인이 키맞추기 <strong className="text-blue-600 font-bold">하락</strong>을 할 가능성이 높습니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Dominance Context</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      비트코인 도미넌스가 <span className="text-orange-600 font-bold">강하게 상승</span> 중일 때는 갭이 벌어져도 알트코인 반등이 약할 수 있으니 주의가 필요합니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-red-100 text-left md:col-span-2">
                    <p className="text-xs font-black text-red-400 mb-1 uppercase tracking-tighter">Dual Signal Alert (Extreme Signal)</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Drop Alert(단기 모멘텀)와 Z-Score Alert(통계적 왜곡)가 <strong className="text-red-600 font-bold">동시에</strong> 작동한다면, 이는 시장의 탄력이 한계치에 도달했다는 강력한 증거입니다. 이 경우 해당 지점이 단기 <strong className="text-red-600 font-bold underline decoration-red-200 underline-offset-4">고점</strong> 또는 <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2 font-sans">저점</strong>의 신호일 확률이 매우 높으므로 <strong>반전 매매(Mean Reversion)</strong> 전략을 고려해볼 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-start border border-blue-100 text-left">
                <ShieldCheck className="text-blue-600 shrink-0" size={20} />
                <p className="text-[11px] text-blue-800 font-medium leading-tight">업비트 및 글로벌 금융 API를 사용하여 실시간으로 데이터를 분석하는 투명한 모니터링 환경입니다.</p>
              </div>
            </div>
          )}

          {showInfo && activeTab === 'analysis' && (
            <div className="p-8 space-y-8 border-t border-slate-100 text-left font-sans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-black">1</div>
                  <h4 className="font-bold">통계 지표 활용</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">단일 지표에 의존하지 않고 여러 보조지표의 교차 검증을 통해 신뢰도를 높입니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-black">2</div>
                  <h4 className="font-bold">시그널 점수</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">RSI, 볼린저 밴드 등 4가지 지표를 하나의 점수로 압축하여 직관적인 매매 기준을 제공합니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-black">3</div>
                  <h4 className="font-bold">단기 흐름 포착</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">5분봉 단위의 체결 강도와 모멘텀을 통해 시장의 즉각적인 수급 변화를 읽어냅니다.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 space-y-4 font-sans text-left">
                <div className="flex items-center gap-2 text-slate-800 font-bold mb-2">
                  <BookOpen size={18} className="text-purple-500" />
                  <span>통계 지표 분석 가이드 (Tip)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Bollinger Bands & RSI</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      볼린저 밴드 하단을 이탈(%B &lt; 0)하면서 RSI가 30 이하의 <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2">과매도</strong> 상태일 때는 반등을 노린 매수 관점으로 접근하기 좋습니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Trade Intensity</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      체결 강도가 <strong className="text-red-600 font-bold">매수(Buy) 우위</strong>일 경우 실질적인 자금 유입이 일어나고 있음을 의미하므로, 가격 상승 추세의 신뢰도를 높여줍니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left md:col-span-2">
                    <p className="text-xs font-black text-violet-400 mb-1 uppercase tracking-tighter">Signal Score (종합 시그널)</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      0부터 100까지의 수치로 나타나는 종합 시그널 점수는 <strong className="text-emerald-600 font-bold">높을수록 강한 매수 신호(저평가/반등 예상)</strong>를, <strong className="text-red-600 font-bold">낮을수록 강한 매도 신호(과열/하락 예상)</strong>를 의미합니다. 다중 지표의 교집합이 발생할 때 점수가 극단으로 치우치며, 이는 확률 높은 트레이딩 시점을 시사합니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-2xl flex gap-3 items-start border border-purple-100 text-left">
                <ShieldCheck className="text-purple-600 shrink-0" size={20} />
                <p className="text-[11px] text-purple-800 font-medium leading-tight">통계적 분석은 과거의 패턴을 바탕으로 확률을 계산할 뿐, 미래의 확실한 수익을 보장하지 않습니다. 리스크 관리를 병행하세요.</p>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-12 pt-10 border-t border-slate-200 text-center space-y-6 px-4 font-sans">
          <div className="flex justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
            <button onClick={() => window.open('https://www.google.com/policies/technologies/ads', '_blank')} className="hover:text-blue-600 transition-colors font-sans">Cookies</button>
            <button onClick={() => window.open('https://policies.google.com/privacy', '_blank')} className="hover:text-blue-600 transition-colors font-sans">Privacy Policy</button>
            <span>Contact: adminsequenceai@gmail.com</span>
          </div>
          <div className="text-[10px] text-slate-300 leading-relaxed max-w-lg mx-auto tabular-nums text-center italic font-medium font-sans">
            <p>본 서비스는 정보 제공을 위한 모니터링 도구입니다. 모든 투자 책임은 본인에게 있습니다.</p>
            <p className="mt-2 font-black text-slate-400 tracking-tighter not-italic uppercase tracking-widest text-center">© 2024 COIN GAP MONITOR. BY SEQUEC AI.</p>
          </div>
        </footer>
      </div>
      <Analytics />
    </div>
  );
}