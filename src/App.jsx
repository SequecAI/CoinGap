import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Info,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  RefreshCcw,
  Search,
  X,
  User,
  LogOut,
  Edit2,
  Check
} from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { Analytics } from '@vercel/analytics/react';
import { useUpbitData } from './hooks/useUpbitData';
import { useStockData, DEFAULT_STOCKS } from './hooks/useStockData';
import { useAuth } from './hooks/useAuth';
import DashboardTab from './tabs/DashboardTab';
import AnalysisTab from './tabs/AnalysisTab';
import CustomViewTab from './tabs/CustomViewTab';
import StockAnalysisTab from './tabs/StockAnalysisTab';
import StockCustomViewTab from './tabs/StockCustomViewTab';
import IndicatorStudioTab from './tabs/IndicatorStudioTab';
import StockEditorTab from './tabs/StockEditorTab';
import CommunityTab from './tabs/CommunityTab';
import MarketBrief from './components/MarketBrief';

function NicknameEditor({ userInfo, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const baseName = userInfo.nickname.split('#')[0];
  const tag = userInfo.nickname.includes('#') ? '#' + userInfo.nickname.split('#')[1] : '';
  const [tempName, setTempName] = useState(baseName);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    } else {
      setTempName(userInfo.nickname.split('#')[0]);
    }
  }, [isEditing, userInfo.nickname]);

  const handleSave = () => {
    if (tempName.trim() && tempName.trim() !== baseName) {
      onSave(tempName.trim());
    } else {
      setTempName(baseName);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1">
        <input 
          ref={inputRef}
          type="text" 
          className="bg-transparent text-xs font-black text-slate-700 outline-none w-20"
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          onBlur={handleSave}
        />
        {tag && <span className="text-[10px] font-bold text-slate-400 -ml-1">{tag}</span>}
        <button onMouseDown={(e) => { e.preventDefault(); handleSave(); }} className="text-emerald-500 hover:text-emerald-600 ml-1">
          <Check size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group cursor-pointer" onClick={() => setIsEditing(true)}>
      <div className="flex items-baseline hidden sm:flex">
        <span className="text-xs font-black text-slate-600 group-hover:text-indigo-600 transition-colors">
          {baseName}
        </span>
        {tag && <span className="text-[10px] font-bold text-slate-400 ml-0.5">{tag}</span>}
      </div>
      <Edit2 size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
    </div>
  );
}

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
    lastUpdated,
    orderbook,
    searchCoin,
    searchResults: coinSearchResults,
    clearSearch: clearCoinSearch
  } = useUpbitData();

  const stockData = useStockData();
  const { isLoggedIn, userInfo, handleLoginSuccess, logout, updateNickname } = useAuth();
  
  const isInAppBrowser = /kakaotalk|instagram|fban|fbav|line|naver|daum/i.test(navigator.userAgent);

  const [dropThreshold, setDropThreshold] = useState(2.0);
  const [zScoreThreshold, setZScoreThreshold] = useState(3.0);
  const [showInfo, setShowInfo] = useState(true);
  // Router hooks
  const location = useLocation();
  const navigate = useNavigate();

  // URL Path에 따른 appMode 및 activeTab 결정
  const pathParts = location.pathname.split('/').filter(Boolean);
  const appMode = pathParts[0] === 'stock' ? 'stock' : 
                  pathParts[0] === 'community' ? 'community' : 'crypto';
  
  // URL에 탭이 명시되어 있으면 그것을 쓰고, 없으면 로컬스토리지나 기본값 사용
  const storedTab = localStorage.getItem('coinGap_activeTab');
  const fallbackTab = appMode === 'community' ? 'indicator' :
                      (appMode === 'stock' && storedTab === 'dashboard') ? 'analysis' : 
                      (storedTab || 'dashboard');
  const activeTab = pathParts[1] || fallbackTab;
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [coinSearchQuery, setCoinSearchQuery] = useState('');
  const [showCoinSearch, setShowCoinSearch] = useState(false);
  const searchRef = useRef(null);
  const coinSearchRef = useRef(null);

  // 검색 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
        stockData.clearSearch();
      }
      if (coinSearchRef.current && !coinSearchRef.current.contains(e.target)) {
        setShowCoinSearch(false);
        clearCoinSearch();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 로컬스토리지 저장
  useEffect(() => {
    localStorage.setItem('coinGap_activeTab', activeTab);
  }, [activeTab]);

  // 기본 경로 리다이렉트
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === `/${appMode}`) {
      // 탭 이름이 없는 기본 루트나 기본 모드 접속 시 현재 탭을 포함한 주소로 변경
      navigate(`/${appMode}/${activeTab}`, { replace: true });
    } else if (location.pathname === '/community/free') {
      // 구 주소 호환성 유지
      navigate('/community/board', { replace: true });
    }
  }, [location.pathname, appMode, activeTab, navigate]);

  // 모드 전환 시 URL 라우팅
  const handleModeSwitch = (mode) => {
    let nextTab = activeTab;
    if (mode === 'stock' && nextTab === 'dashboard') {
      nextTab = 'analysis';
    }
    if (nextTab === 'board') {
      nextTab = 'analysis';
    }
    navigate(`/${mode}${mode === 'community' ? '' : '/' + nextTab}`);
  };

  const handleTabSwitch = (tab) => {
    navigate(`/${appMode}/${tab}`);
  };

  const isLoading = appMode === 'community' ? false : (appMode === 'crypto' ? loading : stockData.loading);
  if (isLoading) return (
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

  const currentMarket = markets.find(m => m.market === selectedAlt);
  const altName = currentMarket ? currentMarket.korean_name : selectedAlt;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pt-6 pb-20 px-4 text-left">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 상단 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-4 text-left font-sans">
            <div className={`p-3 ${appMode === 'community' ? 'bg-indigo-600' : appMode === 'crypto' ? 'bg-blue-600' : 'bg-emerald-600'} text-white rounded-2xl shadow-lg ${appMode === 'community' ? 'shadow-indigo-100' : appMode === 'crypto' ? 'shadow-blue-100' : 'shadow-emerald-100'}`}>
              <Activity size={28} />
            </div>
            <div className="text-left font-sans">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none font-sans">
                {appMode === 'community' ? '커뮤니티' : appMode === 'crypto' ? '코인 갭 모니터' : '국내주식 모니터'}
              </h1>
              {appMode !== 'community' && (
              <div className="flex items-center gap-2 text-slate-400 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-[10px] font-bold uppercase tracking-wider">
                  {(appMode === 'crypto' ? lastUpdated : stockData.lastUpdated).toLocaleTimeString()} 업데이트
                </p>
              </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 font-sans text-left items-stretch sm:items-end w-full sm:w-auto">
            {appMode === 'community' ? (
              <>{/* community 모드에서는 검색 UI 없음 */}</>
            ) : appMode === 'crypto' ? (
              <>
                {activeTab !== 'studio' && (
                  <>
                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-[10px] font-black text-blue-500 px-1 uppercase tracking-tighter">DROP ALERT</label>
                      <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all tabular-nums text-left" value={dropThreshold} onChange={(e) => setDropThreshold(Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-[10px] font-black text-orange-400 px-1 uppercase tracking-tighter">Z-Score Alert</label>
                      <input type="number" step="0.1" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-24 font-bold outline-none focus:ring-2 focus:ring-orange-500 transition-all tabular-nums text-left" value={zScoreThreshold} onChange={(e) => setZScoreThreshold(Number(e.target.value))} />
                    </div>
                  </>
                )}
                <div className="relative" ref={coinSearchRef}>
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] font-black text-blue-500 px-1 uppercase tracking-tighter">Compare: {altName}</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="코인명 또는 코드" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 pr-8 w-full sm:w-52 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-left font-sans text-sm"
                        value={coinSearchQuery}
                        onChange={(e) => { setCoinSearchQuery(e.target.value); searchCoin(e.target.value); setShowCoinSearch(true); }}
                        onFocus={() => setShowCoinSearch(true)} />
                      {coinSearchQuery && (
                        <button onClick={() => { setCoinSearchQuery(''); clearCoinSearch(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* 검색 결과 드롭다운 */}
                  {showCoinSearch && coinSearchResults.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
                      {coinSearchResults.map((m) => (
                        <button key={m.market} className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between border-b border-slate-50 last:border-0"
                          onClick={() => {
                            setSelectedAlt(m.market);
                            setCoinSearchQuery('');
                            setShowCoinSearch(false);
                            clearCoinSearch();
                          }}>
                          <div>
                            <p className="font-bold text-sm text-slate-900">{m.korean_name}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{m.market.replace('KRW-', '')}</p>
                          </div>
                          <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{m.english_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="relative" ref={searchRef}>
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] font-black text-emerald-500 px-1 uppercase tracking-tighter">종목 검색</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="종목명 또는 코드" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 pr-8 w-full sm:w-52 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-left font-sans text-sm"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); stockData.searchStock(e.target.value); setShowSearch(true); }}
                      onFocus={() => setShowSearch(true)} />
                    {searchQuery && (
                      <button onClick={() => { setSearchQuery(''); stockData.clearSearch(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {/* 검색 결과 드롭다운 */}
                {showSearch && stockData.searchResults.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    {stockData.searchResults.map((item) => (
                      <button key={item.code} className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between border-b border-slate-50 last:border-0"
                        onClick={() => {
                          stockData.setSelectedStock({ code: item.code, name: item.name, market: item.typeCode });
                          setSearchQuery('');
                          setShowSearch(false);
                          stockData.clearSearch();
                        }}>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{item.code}</p>
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">{item.typeName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 하단 로그인 & 토글 */}
            <div className="flex flex-col items-center sm:items-end justify-center sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0">
              {/* 로그인 버튼 */}
              <div className="flex justify-center sm:justify-end w-full sm:w-auto shrink-0 min-w-[200px]">
                {isLoggedIn ? (
                  <div className="flex items-center gap-2">
                    {userInfo.profileImage ? (
                      <img src={userInfo.profileImage} alt="" className="w-8 h-8 rounded-full border-2 border-slate-200" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center"><User size={16} className="text-indigo-500" /></div>
                    )}
                    <NicknameEditor userInfo={userInfo} onSave={updateNickname} />
                    <button onClick={logout} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-all" title="로그아웃">
                      <LogOut size={16} />
                    </button>
                  </div>
                ) : isInAppBrowser ? (
                  <div className="w-full flex justify-center sm:justify-end">
                    <button onClick={() => {
                        alert('카카오톡/SNS 내장 브라우저에서는 구글 보안 정책상 로그인이 차단됩니다.\n\n우측 하단 메뉴(⋮)에서 [다른 브라우저로 열기]를 선택하여 사파리나 크롬으로 접속해주세요!');
                        if (/android/i.test(navigator.userAgent)) {
                          window.location.href = `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;package=com.android.chrome;end;`;
                        }
                      }} 
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black border border-slate-200 transition-colors flex items-center gap-1.5">
                      <span className="text-[14px]">⚠️</span> 인앱 브라우저 제한 (클릭)
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex justify-center sm:justify-end">
                    <GoogleLogin
                      onSuccess={handleLoginSuccess}
                      onError={() => console.warn('Google 로그인 실패')}
                      size="medium"
                      shape="pill"
                      text="signin"
                      theme="outline"
                    />
                  </div>
                )}
              </div>

              {/* 모드 토글 (우측 고정) */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button onClick={() => handleModeSwitch('stock')}
                  className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${appMode === 'stock' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  🇰🇷 주식
                </button>
                <button onClick={() => handleModeSwitch('crypto')}
                  className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${appMode === 'crypto' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  ₿ 코인
                </button>
                <button onClick={() => handleModeSwitch('community')}
                  className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${appMode === 'community' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  📋 커뮤니티
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 시황 브리프 (collapsible, 헤더 직후 고정 위치) — community 모드에서는 숨김 */}
        {appMode !== 'community' && <MarketBrief appMode={appMode} userInfo={userInfo} />}

        {/* 탭 내비게이션 — community 모드에서는 숨김 */}
        {appMode !== 'community' && (
        <div className="flex gap-2 bg-slate-200/50 p-1.5 rounded-2xl">
          {appMode === 'crypto' && (
            <button onClick={() => handleTabSwitch('dashboard')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
              Divergence
            </button>
          )}
          <button onClick={() => handleTabSwitch('analysis')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
            Statistics
          </button>
          <button onClick={() => handleTabSwitch('custom')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
            Custom View
          </button>
          <button onClick={() => handleTabSwitch('studio')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'studio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
            Editor
          </button>
        </div>
        )}

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
        
        {activeTab === 'analysis' && appMode === 'crypto' && (
          <AnalysisTab
            candles5m={candles5m}
            dayCandles={dayCandles}
            btcRate={btcRate}
            altRate={altRate}
            altName={altName}
            alt={alt}
            altVol={altVol}
            momentum5m={momentum5m}
          />
        )}

        {activeTab === 'analysis' && appMode === 'stock' && (
          <StockAnalysisTab
            dayCandles={stockData.dayCandles}
            momentum={stockData.momentum}
            stockName={stockData.selectedStock.name}
            currentPrice={stockData.currentPrice}
            changeRate={stockData.changeRate}
            changeDirection={stockData.changeDirection}
            marketCap={stockData.marketCap}
            volume={stockData.volume}
            per={stockData.per} pbr={stockData.pbr} eps={stockData.eps} bps={stockData.bps}
            dividendYield={stockData.dividendYield}
            foreignRate={stockData.foreignRate}
            high52w={stockData.high52w} low52w={stockData.low52w}
            dealTrends={stockData.dealTrends}
            minuteCandles={stockData.minuteCandles}
            kospiPrice={stockData.kospiPrice} kospiChange={stockData.kospiChange} kospiDirection={stockData.kospiDirection}
            kosdaqPrice={stockData.kosdaqPrice} kosdaqChange={stockData.kosdaqChange} kosdaqDirection={stockData.kosdaqDirection}
          />
        )}

        {activeTab === 'custom' && appMode === 'crypto' && (
          <CustomViewTab
            candles5m={candles5m}
            dayCandles={dayCandles}
            altName={altName}
            alt={alt}
            altVol={altVol}
            momentum5m={momentum5m}
            zScoreValue={zScoreValue}
          />
        )}

        {activeTab === 'studio' && appMode === 'crypto' && (
          <IndicatorStudioTab
            tickers={tickers}
            markets={markets}
            selectedAlt={selectedAlt}
            altName={altName}
            btcRate={btcRate}
            altRate={altRate}
            momentum5m={momentum5m}
            volRatio={volRatio}
            zScoreValue={zScoreValue}
            candles5m={candles5m}
            dayCandles={dayCandles}
            orderbook={orderbook}
          />
        )}

        {activeTab === 'studio' && appMode === 'stock' && (
          <StockEditorTab stockData={stockData} />
        )}

        {/* 커뮤니티 모드 */}
        {appMode === 'community' && (
          <CommunityTab isLoggedIn={isLoggedIn} userInfo={userInfo} subTab={activeTab} onSubTabChange={handleTabSwitch} />
        )}


        {activeTab === 'custom' && appMode === 'stock' && (
          <StockCustomViewTab
            dayCandles={stockData.dayCandles}
            minuteCandles={stockData.minuteCandles}
            momentum={stockData.momentum}
            stockName={stockData.selectedStock.name}
            currentPrice={stockData.currentPrice}
            changeRate={stockData.changeRate}
            changeDirection={stockData.changeDirection}
            marketCap={stockData.marketCap}
            per={stockData.per} pbr={stockData.pbr} eps={stockData.eps} bps={stockData.bps}
            dividendYield={stockData.dividendYield}
            foreignRate={stockData.foreignRate}
            high52w={stockData.high52w} low52w={stockData.low52w}
            dealTrends={stockData.dealTrends}
            kospiPrice={stockData.kospiPrice} kospiChange={stockData.kospiChange} kospiDirection={stockData.kospiDirection}
            kosdaqPrice={stockData.kosdaqPrice} kosdaqChange={stockData.kosdaqChange} kosdaqDirection={stockData.kosdaqDirection}
          />
        )}

        {/* 알림 메시지 - 코인 모드에서만 표시 */}
        {appMode === 'crypto' && appMode !== 'community' && (currentDropMagnitude >= dropThreshold || currentZScoreMagnitude >= zScoreThreshold) && (
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

        {/* 정보성 섹션 — board/community에선 숨김 */}
        {activeTab !== 'board' && appMode !== 'community' && (
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
                      Drop Alert(단기 모멘텀)와 Z-Score Alert(통계적 왜곡)가 <strong className="text-red-600 font-bold">동시에</strong> 작동한다면, 이는 시장의 탄력이 한계치에 도달했다는 강력한 증거입니다. 이 경우 해당 지점이 단기 <strong className="text-red-600 font-bold underline decoration-red-200 underline-offset-4">고점</strong> 또는 <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2 font-sans">저점</strong>의 신호일 확률이 매우 높으므로 <strong>평균 회귀(Mean Reversion)</strong> 관점을 고려해볼 수 있습니다.
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
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">RSI, 볼린저 밴드 등 4가지 지표를 하나의 점수로 압축하여 직관적인 판단 기준을 제공합니다.</p>
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
                      볼린저 밴드 하단을 이탈(%B &lt; 0)하면서 RSI가 30 이하의 <strong className="text-blue-600 font-bold underline decoration-blue-200 underline-offset-2">과매도</strong> 영역일 때는 반등 가능성을 체크하기 좋습니다.
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
                      0부터 100까지의 수치로 나타나는 종합 시그널 점수는 <strong className="text-emerald-600 font-bold">높을수록 저평가 신호(반등 가능성)</strong>를, <strong className="text-red-600 font-bold">낮을수록 고평가 신호(과열/하락 가능성)</strong>를 의미합니다. 다중 지표의 교집합이 발생할 때 점수가 극단으로 치우치며, 이는 통계적으로 의미 있는 관찰 시점을 시사합니다.
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

          {showInfo && activeTab === 'custom' && (
            <div className="p-8 space-y-8 border-t border-slate-100 text-left font-sans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center font-black">1</div>
                  <h4 className="font-bold">내 마음대로 설정</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">필요 없는 지표는 끄고, 원하는 지표만 켜서 나만의 대시보드를 구성합니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center font-black">2</div>
                  <h4 className="font-bold">커스텀 시그널 점수</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">활성화된 지표들만을 1:1 비율로 평균내어 현재 내 전략에 맞는 시그널 점수를 산출합니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center font-black">3</div>
                  <h4 className="font-bold">설정 유지</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">로컬 스토리지를 이용해 한 번 설정한 지표 구성은 앱을 껐다 켜도 그대로 유지됩니다.</p>
                </div>
              </div>
            </div>
          )}

          {showInfo && activeTab === 'studio' && (
            <div className="p-8 space-y-8 border-t border-slate-100 text-left font-sans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black">1</div>
                  <h4 className="font-bold">변수 선택</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">시세·모멘텀·RSI·볼린저·호가 잔량·직전 5분봉 OHLCV 등 실시간 변수를 자유롭게 골라 조합합니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black">2</div>
                  <h4 className="font-bold">수식 작성</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">JavaScript 표현식과 Math 함수로 변수들을 결합해 나만의 점수 공식을 만듭니다. 결과는 실시간 프리뷰로 즉시 확인됩니다.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black">3</div>
                  <h4 className="font-bold">시그널 매핑 &amp; 저장</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">점수 범위에 맞춰 저평가·고평가 임계값을 직접 정의하고 보관함에 저장하면, 다음 접속 시에도 그대로 추적됩니다.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 space-y-4 font-sans text-left">
                <div className="flex items-center gap-2 text-slate-800 font-bold mb-2">
                  <BookOpen size={18} className="text-indigo-500" />
                  <span>지표 빌더 활용 가이드 (Tip)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Variable Combination</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      여러 변수를 함께 곱하거나 나누면 단일 지표가 잡지 못하는 <strong className="text-indigo-600 font-bold">상호작용 신호</strong>를 만들 수 있습니다. 예: <code className="font-mono bg-white px-1 rounded">Z_SCORE * VOL_RATIO</code>는 거래대금이 동반된 갭 왜곡만 부각시킵니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Threshold Calibration</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      점수는 <strong className="text-amber-600 font-bold">자율 스케일링</strong>이라 0~100에 묶이지 않습니다. 며칠 동안 프리뷰 값의 분포를 관찰한 뒤, 실제로 강한 신호가 나타나는 <strong>꼬리 부분</strong>에 임계값을 두는 것이 효과적입니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Reuse Existing Logic</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Statistics 탭에서 의미 있게 본 지표(RSI 과매수/과매도, 볼린저 %B, 갭 Z-Score 등)를 변수로 재구성해보세요. 익숙한 신호의 <strong className="text-emerald-600 font-bold">조합·가중치 변형</strong>이 빠른 시작점이 됩니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-tighter">Persistent Library</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      저장된 지표는 로컬에 영구 보관됩니다. 카드를 클릭하면 <strong className="text-indigo-600 font-bold">하단 실시간 패널</strong>이 펼쳐져 현재 시장 상태에서의 점수와 시그널을 한눈에 확인할 수 있습니다.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-violet-100 text-left md:col-span-2">
                    <p className="text-xs font-black text-violet-400 mb-1 uppercase tracking-tighter">LLM Assist (수식이 막막하다면)</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      JavaScript 수식 작성이 어렵다면 <strong className="text-violet-600 font-bold">ChatGPT·Claude 같은 LLM</strong>의 도움을 받는 것도 좋은 방법입니다. 위에 나열된 변수 이름들(<code className="font-mono bg-white px-1 rounded text-[10px]">BTC_RATE</code>, <code className="font-mono bg-white px-1 rounded text-[10px]">RSI_14</code>, <code className="font-mono bg-white px-1 rounded text-[10px]">BID_ASK_RATIO</code> 등)과 본인이 검증하고 싶은 분석 아이디어(예: <em>"거래대금이 동반된 갭 왜곡일수록 강하게 점수화"</em>)를 함께 전달하면, 의도에 맞는 한 줄 수식을 받아볼 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 p-4 rounded-2xl flex gap-3 items-start border border-indigo-100 text-left">
                <ShieldCheck className="text-indigo-600 shrink-0" size={20} />
                <p className="text-[11px] text-indigo-800 font-medium leading-tight">사용자 정의 수식은 본인의 가설을 검증하는 도구입니다. 백테스트를 거치지 않은 직관 기반 공식은 실거래 적용 전에 충분한 관찰 기간을 가지세요.</p>
              </div>
            </div>
          )}
        </div>
        )}

        <footer className="mt-12 pt-10 border-t border-slate-200 text-center space-y-6 px-4 font-sans">
          <div className="flex justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
            <button onClick={() => window.open('https://www.google.com/policies/technologies/ads', '_blank')} className="hover:text-blue-600 transition-colors font-sans">Cookies</button>
            <button onClick={() => window.open('https://policies.google.com/privacy', '_blank')} className="hover:text-blue-600 transition-colors font-sans">Privacy Policy</button>
            <span>Contact: adminsequenceai@gmail.com</span>
          </div>
          <div className="text-[10px] text-slate-300 leading-relaxed max-w-lg mx-auto tabular-nums text-center italic font-medium font-sans">
            <p>본 서비스는 정보 제공을 위한 모니터링 도구입니다. 모든 투자 책임은 본인에게 있습니다.</p>
            <p className="mt-2 font-black text-slate-400 tracking-tighter not-italic uppercase tracking-widest text-center">© 2026 Asset Indicator Monitor. BY SequenceAI.</p>
          </div>
        </footer>
      </div>
      <Analytics />
    </div>
  );
}