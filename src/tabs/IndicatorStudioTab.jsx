import React, { useState, useMemo, useRef } from 'react';
import {
  Activity, Info, BookOpen, Code, Plus, Save, Play,
  AlertCircle, CheckCircle2, Unlock, Pencil, X,
  ChevronDown, ChevronUp, BarChart3, RefreshCcw
} from 'lucide-react';
import { useStudioIndicators } from '../hooks/useStudioIndicators';
import { runBacktest, usesOrderbookVars } from '../utils/backtest';

// ── 일봉 RSI(14) ──
function calcRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  const prices = candles.map(c => c.trade_price);
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ── 일봉 볼린저(20, 2σ) ──
function calcBollinger(candles, period = 20, multiplier = 2) {
  if (!candles || candles.length < period) return null;
  const slice = candles.slice(-period);
  const sum = slice.reduce((a, b) => a + b.trade_price, 0);
  const ma = sum / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b.trade_price - ma, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upper = ma + std * multiplier;
  const lower = ma - std * multiplier;
  return { upper, lower, ma };
}

export default function IndicatorStudioTab({
  tickers, markets, selectedAlt, altName,
  btcRate, altRate, momentum5m, volRatio, zScoreValue,
  candles5m, dayCandles, orderbook
}) {
  const { indicators, addIndicator, updateIndicator, removeIndicator } = useStudioIndicators();

  // ── 에디터 내부 state ──
  const [formula, setFormula] = useState("Z_SCORE - (RSI_14 - 50) * 0.1");
  const [indicatorName, setIndicatorName] = useState("RSI 보정 갭 신호");
  const [thresholds, setThresholds] = useState({
    strongBuy: 3, buy: 1, neutral: -1, sell: -3
  });
  const [selectedSavedIndicatorId, setSelectedSavedIndicatorId] = useState(null);
  const [isVarOpen, setIsVarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    btc: false, alt: false, prev: false, tech: false, orderbook: false, math: false
  });
  const [modalState, setModalState] = useState({ isOpen: false, type: '', message: '', onConfirm: null });
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState(0);
  const [backtestResult, setBacktestResult] = useState(null);
  const formulaInputRef = useRef(null);
  const editorRef = useRef(null);

  const loadIndicatorIntoEditor = (ind) => {
    setIndicatorName(ind.name);
    setFormula(ind.formula);
    setThresholds({ ...ind.thresholds });
    setBacktestResult(ind.backtest || null);
    setSelectedSavedIndicatorId(ind.id);
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 수식·임계값 편집 시 기존 백테스트 결과는 무효화
  const handleFormulaChange = (val) => {
    setFormula(val);
    setBacktestResult(null);
  };
  const handleThresholdChange = (key, val) => {
    setThresholds({ ...thresholds, [key]: val });
    setBacktestResult(null);
  };

  const showAlert = (message) => {
    setModalState({ isOpen: true, type: 'alert', message, onConfirm: null });
  };
  const showConfirm = (message, onConfirm) => {
    setModalState({ isOpen: true, type: 'confirm', message, onConfirm });
  };

  // ── 변수 데이터 도출 ──
  const btcPrice = tickers['KRW-BTC']?.trade_price || 0;
  const altPrice = tickers[selectedAlt]?.trade_price || 0;
  const safeMomentum = isNaN(momentum5m) ? 0 : momentum5m;
  const zScore = parseFloat(zScoreValue) || 0;
  const prevCandle = (candles5m && candles5m.length >= 2)
    ? candles5m[candles5m.length - 2]
    : {};

  const rsi14 = useMemo(() => {
    const v = calcRSI(dayCandles, 14);
    return v === null ? 50 : v;
  }, [dayCandles]);

  const bbData = useMemo(() => {
    const r = calcBollinger(dayCandles, 20, 2);
    if (!r) return { upper: 0, lower: 0, pb: 0 };
    const range = r.upper - r.lower;
    const pb = range > 0 ? ((altPrice - r.lower) / range) * 100 : 0;
    return { upper: r.upper, lower: r.lower, pb: isNaN(pb) ? 0 : pb };
  }, [dayCandles, altPrice]);

  // ── 변수 그룹 정의 ──
  const variableGroups = [
    {
      id: 'btc',
      title: 'Bitcoin',
      colorClass: 'bg-orange-50 border-orange-200 hover:border-orange-400 text-orange-600',
      items: [
        { label: 'BTC 현재가', value: 'BTC_PRICE', data: btcPrice },
        { label: 'BTC 변동률', value: 'BTC_RATE', data: btcRate },
      ]
    },
    {
      id: 'alt',
      title: `Altcoin (${altName})`,
      colorClass: 'bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-600',
      items: [
        { label: 'ALT 현재가', value: 'ALT_PRICE', data: altPrice },
        { label: 'ALT 변동률', value: 'ALT_RATE', data: altRate },
        { label: '5분 모멘텀', value: 'ALT_MOMENTUM', data: safeMomentum },
        { label: '거래대금 비율', value: 'VOL_RATIO', data: volRatio },
        { label: '갭 Z-Score', value: 'Z_SCORE', data: zScore },
      ]
    },
    {
      id: 'prev',
      title: 'ALT 직전 분봉 (5분)',
      colorClass: 'bg-purple-50 border-purple-200 hover:border-purple-400 text-purple-600',
      items: [
        { label: '전봉 시가(O)', value: 'PREV_O', data: prevCandle.opening_price || 0 },
        { label: '전봉 고가(H)', value: 'PREV_H', data: prevCandle.high_price || 0 },
        { label: '전봉 저가(L)', value: 'PREV_L', data: prevCandle.low_price || 0 },
        { label: '전봉 종가(C)', value: 'PREV_C', data: prevCandle.trade_price || 0 },
        { label: '전봉 거래량(V)', value: 'PREV_V', data: prevCandle.candle_acc_trade_volume || 0 },
      ]
    },
    {
      id: 'tech',
      title: '고급 지표 (Technical)',
      colorClass: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-600',
      items: [
        { label: 'RSI (14일)', value: 'RSI_14', data: rsi14 },
        { label: '볼린저 상단', value: 'BB_UPPER', data: bbData.upper },
        { label: '볼린저 하단', value: 'BB_LOWER', data: bbData.lower },
        { label: '볼린저 %B', value: 'BB_PB', data: bbData.pb },
      ]
    },
    {
      id: 'orderbook',
      title: '시장 압력 (Orderbook)',
      colorClass: 'bg-rose-50 border-rose-200 hover:border-rose-400 text-rose-600',
      warning: '※ 호가 변수는 과거 데이터가 제공되지 않아, 사용 시 백테스트가 비활성화됩니다.',
      items: [
        { label: '매수 총잔량', value: 'TOTAL_BID', data: orderbook.totalBid },
        { label: '매도 총잔량', value: 'TOTAL_ASK', data: orderbook.totalAsk },
        { label: '매수/매도 비율', value: 'BID_ASK_RATIO', data: orderbook.ratio },
      ]
    },
    {
      id: 'math',
      title: '수학 함수 (Math)',
      colorClass: 'bg-slate-100 border-slate-300 hover:border-slate-500 text-slate-700',
      isFunction: true,
      items: [
        { label: '절대값', value: 'Math.abs(' },
        { label: '로그', value: 'Math.log(' },
        { label: '루트', value: 'Math.sqrt(' },
        { label: '최대값', value: 'Math.max(' },
        { label: '최소값', value: 'Math.min(' },
      ]
    }
  ];

  const allVariables = variableGroups.filter(g => !g.isFunction).flatMap(g => g.items);

  // ── 수식 평가 ──
  // 반환: { value, error } — error는 null | 'syntax' | 'invalid'
  const evaluateFormula = (formStr) => {
    try {
      if (!formStr) return { value: 0, error: null };
      let evalFormula = formStr;
      allVariables.forEach(v => {
        const safeData = (v.data === undefined || isNaN(v.data)) ? 0 : v.data;
        evalFormula = evalFormula.split(v.value).join(safeData);
      });
      const runner = new Function('return ' + evalFormula);
      const result = runner();
      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        return { value: null, error: 'invalid' };
      }
      return { value: parseFloat(result.toFixed(2)), error: null };
    } catch (e) {
      return { value: null, error: 'syntax' };
    }
  };

  const currentResult = useMemo(
    () => evaluateFormula(formula),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formula, btcPrice, btcRate, altPrice, altRate, safeMomentum, volRatio, zScore, prevCandle, rsi14, bbData, orderbook]
  );

  const getSignal = (score, thres, errorType) => {
    if (errorType === 'syntax') return { text: '수식 오류', color: 'text-slate-400', bg: 'bg-slate-100', icon: '❓' };
    if (errorType === 'invalid') return { text: 'NaN/Inf', color: 'text-amber-500', bg: 'bg-amber-50', icon: '⚠️' };
    if (score === null) return { text: '수식 오류', color: 'text-slate-400', bg: 'bg-slate-100', icon: '❓' };
    if (score >= thres.strongBuy) return { text: '강력 매수', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: '🟢' };
    if (score >= thres.buy) return { text: '매수', color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: '🟢' };
    if (score >= thres.neutral) return { text: '중립', color: 'text-slate-400', bg: 'bg-slate-400/10', icon: '⚪' };
    if (score >= thres.sell) return { text: '매도', color: 'text-red-400', bg: 'bg-red-400/10', icon: '🔴' };
    return { text: '강력 매도', color: 'text-red-500', bg: 'bg-red-500/10', icon: '🔴' };
  };

  const currentSignal = getSignal(currentResult.value, thresholds, currentResult.error);

  const addVariable = (val, isFunction) => {
    setFormula(prev => prev + (isFunction ? val : ` ${val} `));
    setBacktestResult(null);
    if (formulaInputRef.current) formulaInputRef.current.focus();
  };

  const handleRunBacktest = async () => {
    if (usesOrderbookVars(formula)) return;
    setBacktestRunning(true);
    setBacktestProgress(0);
    setBacktestResult(null);
    try {
      const result = await runBacktest({
        altMarket: selectedAlt,
        formula,
        thresholds,
        onProgress: (pct) => setBacktestProgress(pct),
      });
      setBacktestResult({ ...result, altName });
    } catch (e) {
      showAlert(`백테스트 실패: ${e.message || e}`);
    } finally {
      setBacktestRunning(false);
    }
  };

  const handleSaveIndicator = () => {
    if (!indicatorName.trim()) {
      showAlert('지표 이름을 입력해주세요.');
      return;
    }
    const MAX_INDICATORS = 3;
    const existing = indicators.find(ind => ind.name === indicatorName.trim());
    if (existing) {
      showConfirm(`'${indicatorName}' 지표가 이미 존재합니다.\n기존 수식을 덮어쓰시겠습니까?`, () => {
        updateIndicator(existing.id, {
          formula: formula,
          thresholds: { ...thresholds },
          backtest: backtestResult,
        });
        setSelectedSavedIndicatorId(existing.id);
      });
      return;
    }
    if (indicators.length >= MAX_INDICATORS) {
      showAlert(`지표 보관함은 최대 ${MAX_INDICATORS}개까지만 저장 가능합니다.\n먼저 보관함에서 불필요한 지표를 삭제해 주세요.`);
      return;
    }
    const newIndicator = {
      id: Date.now(),
      name: indicatorName.trim(),
      formula: formula,
      thresholds: { ...thresholds },
      backtest: backtestResult,
    };
    addIndicator(newIndicator);
    setSelectedSavedIndicatorId(newIndicator.id);
  };

  const lookupCoinName = (marketCode) => {
    const m = markets?.find(mk => mk.market === marketCode);
    return m?.korean_name || marketCode.replace('KRW-', '');
  };

  const formatBacktestPeriod = (bt) => {
    const toShort = (iso) => iso.split('T')[0].slice(2).replace(/-/g, '.');
    const coinName = bt.altName || lookupCoinName(bt.altMarket);
    return `${coinName} 백테스트 ${bt.days}일(${toShort(bt.periodStart)}~${toShort(bt.periodEnd)})`;
  };

  const formatBacktestRates = (bt) => {
    const fmt = (data) => {
      if (data.total === 0) return '–';
      const win = (data.wins / data.total * 100).toFixed(1);
      const big = (data.bigWins / data.total * 100).toFixed(1);
      return `${win}%(대승 ${big}%)`;
    };
    return `매수 승 ${fmt(bt.buy)} · 매도 승 ${fmt(bt.sell)}`;
  };

  const handleDeleteClick = (e, ind) => {
    e.stopPropagation();
    showConfirm(`'${ind.name}' 지표를 정말 삭제하시겠습니까?`, () => {
      removeIndicator(ind.id);
      if (selectedSavedIndicatorId === ind.id) {
        setSelectedSavedIndicatorId(null);
      }
    });
  };

  return (
    <div className="space-y-6">

      {/* ── 최상단: 내 지표 실시간 대시보드 ── */}
      {indicators.length > 0 && (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Activity size={18} className="text-blue-600" />
              내 지표 실시간 ({indicators.length})
            </h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">클릭하여 편집</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {indicators.map(ind => {
              const result = evaluateFormula(ind.formula);
              const signal = getSignal(result.value, ind.thresholds, result.error);
              const isSelected = ind.id === selectedSavedIndicatorId;
              return (
                <div
                  key={ind.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSavedIndicatorId(null);
                    } else {
                      loadIndicatorIntoEditor(ind);
                    }
                  }}
                  className={`bg-slate-900 text-white p-5 rounded-[2rem] shadow-xl border-2 cursor-pointer transition-all relative overflow-hidden ${isSelected ? 'border-blue-400 shadow-blue-900/30' : 'border-slate-800 hover:border-blue-500/40'}`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-[60px]"></div>
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Activity size={14} className="text-blue-400 shrink-0" />
                        <h3 className="text-slate-200 font-black text-sm truncate">{ind.name}</h3>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-[10px] font-black ${signal.bg} ${signal.color} border border-current/20 flex items-center gap-1 shrink-0`}>
                        <span>{signal.icon}</span>
                        <span>{signal.text}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{ind.formula}</p>
                    {ind.backtest && ind.backtest.altMarket === selectedAlt ? (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-rose-300 tabular-nums truncate">
                          {formatBacktestPeriod(ind.backtest)}
                        </p>
                        <p className="text-[10px] font-bold text-rose-300 tabular-nums truncate">
                          {formatBacktestRates(ind.backtest)}
                        </p>
                      </div>
                    ) : ind.backtest ? (
                      <p className="text-[10px] font-bold text-slate-500 truncate">
                        {altName} 백테스트 결과 없음
                      </p>
                    ) : null}
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-black tracking-tighter tabular-nums ${signal.color}`}>
                        {result.error === 'invalid' ? 'NaN' : result.error === 'syntax' ? 'Err' : result.value}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Unlock size={10} /> Real-time
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 중간: 지표 보관함 (관리/삭제) ── */}
      {indicators.length > 0 && (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <BookOpen size={18} className="text-blue-600" />
              지표 보관함
            </h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">클릭하여 편집 / X 로 삭제</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {indicators.map(ind => (
              <div
                key={ind.id}
                onClick={() => {
                  if (ind.id === selectedSavedIndicatorId) {
                    setSelectedSavedIndicatorId(null);
                  } else {
                    loadIndicatorIntoEditor(ind);
                  }
                }}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center group
                  ${ind.id === selectedSavedIndicatorId ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-100 bg-white hover:border-blue-300'}`}
              >
                <div className="truncate pr-4">
                  <p className="text-xs font-black text-slate-800 truncate">{ind.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate mt-1">{ind.formula}</p>
                  {ind.backtest && ind.backtest.altMarket === selectedAlt ? (
                    <div className="space-y-0.5 mt-0.5">
                      <p className="text-[10px] font-bold text-rose-500 tabular-nums truncate">
                        {formatBacktestPeriod(ind.backtest)}
                      </p>
                      <p className="text-[10px] font-bold text-rose-500 tabular-nums truncate">
                        {formatBacktestRates(ind.backtest)}
                      </p>
                    </div>
                  ) : ind.backtest ? (
                    <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                      {altName} 백테스트 결과 없음
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ind.id === selectedSavedIndicatorId && (
                    <CheckCircle2 size={18} className="text-blue-500" />
                  )}
                  <button
                    onClick={(e) => handleDeleteClick(e, ind)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 하단: 에디터 ── */}
      <div ref={editorRef} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">

        {/* 지표 이름 */}
        <div className="border-b border-slate-100 pb-6">
          <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 ml-1">
            <Code size={14} /> Indicator Name <Pencil size={12} className="text-blue-300 ml-1" />
          </label>
          <input
            className="w-full text-2xl md:text-3xl font-black text-slate-900 outline-none placeholder-slate-300 bg-transparent transition-all focus:text-blue-600 px-1"
            value={indicatorName}
            onChange={(e) => setIndicatorName(e.target.value)}
            placeholder="새로운 지표 이름을 입력하세요"
          />
        </div>

        {/* 변수 팔레트 */}
        <div className="space-y-4">
          <div
            className="flex items-center justify-between cursor-pointer py-2 ml-2 hover:opacity-70 transition-opacity"
            onClick={() => setIsVarOpen(!isVarOpen)}
          >
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-blue-600" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Variables &amp; Functions</h3>
            </div>
            {isVarOpen ? <ChevronUp size={18} className="text-slate-400 mr-2" /> : <ChevronDown size={18} className="text-slate-400 mr-2" />}
          </div>

          {isVarOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {variableGroups.map(group => (
                <div key={group.id} className="bg-slate-50 p-4 rounded-3xl border border-slate-100 transition-all">
                  <div
                    className="flex items-center justify-between cursor-pointer group/toggle mb-2"
                    onClick={() => setOpenGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                  >
                    <p className="text-[10px] font-black text-slate-400 uppercase ml-1 group-hover/toggle:text-blue-500 transition-colors">
                      {group.title}
                    </p>
                    {openGroups[group.id]
                      ? <ChevronUp size={16} className="text-slate-400 group-hover/toggle:text-blue-500 transition-colors" />
                      : <ChevronDown size={16} className="text-slate-400 group-hover/toggle:text-blue-500 transition-colors" />}
                  </div>

                  {openGroups[group.id] && (
                    <>
                      {group.warning && (
                        <p className="text-[10px] font-bold text-rose-400 leading-tight mb-2 pl-1">{group.warning}</p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {group.items.map(item => (
                          <button
                            key={item.value}
                            onClick={() => addVariable(item.value, group.isFunction)}
                            className={`flex flex-col items-start px-3 py-2 border rounded-xl transition-all active:scale-95 ${group.colorClass}`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-tighter opacity-80">{item.label}</span>
                            <span className="text-xs font-bold font-mono">{item.value}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 수식 에디터 */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Formula Builder</label>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-md flex items-center gap-1 border border-amber-200/50">
                <Unlock size={12} /> 점수 제한 없음 (자율 스케일링)
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-4 md:left-6 md:top-6 text-slate-400 font-mono font-bold select-none text-sm md:text-base">score = </div>
              <textarea
                ref={formulaInputRef}
                className="w-full h-32 md:h-40 bg-slate-900 text-emerald-400 font-mono text-base p-4 pl-20 md:p-6 md:pl-28 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/20 transition-all resize-none leading-relaxed"
                value={formula}
                onChange={(e) => handleFormulaChange(e.target.value)}
                spellCheck="false"
              />
              {currentResult.error && (
                <div className={`absolute bottom-4 right-4 md:right-6 flex items-center gap-1.5 font-black text-[10px] animate-pulse bg-slate-900/80 px-2 py-1 rounded ${currentResult.error === 'invalid' ? 'text-amber-400' : 'text-red-400'}`}>
                  <AlertCircle size={14} />
                  <span>{currentResult.error === 'invalid' ? 'NaN / INF ERROR' : 'SYNTAX ERROR'}</span>
                </div>
              )}
            </div>
          </div>

          {/* 임계값 — 시각적 구간 바 + 경계값 인풋 */}
          <div className="space-y-3 pt-4">
            <div className="ml-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Signal Conditions</label>
              <p className="text-[10px] font-bold text-slate-500 mt-1">※ 점수 결과값의 범위에 맞춰 아래 경계값을 자유롭게 설정하세요. 왼쪽=매도, 오른쪽=매수.</p>
            </div>

            <div className="flex items-stretch gap-1 md:gap-1.5">
              <div className="flex-1 min-w-0 bg-red-500/10 border border-red-500/30 rounded-l-xl py-3 px-1 md:px-2 flex items-center justify-center text-center">
                <p className="text-[9px] md:text-[10px] font-black text-red-500 leading-tight">🔴<span className="hidden sm:inline"> 강력 매도</span></p>
              </div>

              <input
                type="number" step="0.1"
                className="w-12 md:w-16 shrink-0 bg-white border border-slate-300 rounded-lg px-1 py-1 text-center font-black text-xs tabular-nums text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                value={thresholds.sell}
                onChange={(e) => handleThresholdChange('sell', Number(e.target.value))}
              />

              <div className="flex-1 min-w-0 bg-red-400/10 border border-red-400/30 py-3 px-1 md:px-2 flex items-center justify-center text-center">
                <p className="text-[9px] md:text-[10px] font-black text-red-400 leading-tight">🔴<span className="hidden sm:inline"> 매도</span></p>
              </div>

              <input
                type="number" step="0.1"
                className="w-12 md:w-16 shrink-0 bg-white border border-slate-300 rounded-lg px-1 py-1 text-center font-black text-xs tabular-nums text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                value={thresholds.neutral}
                onChange={(e) => handleThresholdChange('neutral', Number(e.target.value))}
              />

              <div className="flex-1 min-w-0 bg-slate-400/10 border border-slate-400/30 py-3 px-1 md:px-2 flex items-center justify-center text-center">
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 leading-tight">⚪<span className="hidden sm:inline"> 중립</span></p>
              </div>

              <input
                type="number" step="0.1"
                className="w-12 md:w-16 shrink-0 bg-white border border-slate-300 rounded-lg px-1 py-1 text-center font-black text-xs tabular-nums text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                value={thresholds.buy}
                onChange={(e) => handleThresholdChange('buy', Number(e.target.value))}
              />

              <div className="flex-1 min-w-0 bg-emerald-400/10 border border-emerald-400/30 py-3 px-1 md:px-2 flex items-center justify-center text-center">
                <p className="text-[9px] md:text-[10px] font-black text-emerald-400 leading-tight">🟢<span className="hidden sm:inline"> 매수</span></p>
              </div>

              <input
                type="number" step="0.1"
                className="w-12 md:w-16 shrink-0 bg-white border border-slate-300 rounded-lg px-1 py-1 text-center font-black text-xs tabular-nums text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                value={thresholds.strongBuy}
                onChange={(e) => handleThresholdChange('strongBuy', Number(e.target.value))}
              />

              <div className="flex-1 min-w-0 bg-emerald-500/10 border border-emerald-500/30 rounded-r-xl py-3 px-1 md:px-2 flex items-center justify-center text-center">
                <p className="text-[9px] md:text-[10px] font-black text-emerald-500 leading-tight">🟢<span className="hidden sm:inline"> 강력 매수</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* 프리뷰 + 저장 */}
        <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-slate-100">
          <div className={`flex-1 p-6 md:p-8 rounded-[2.5rem] border-2 transition-all relative overflow-hidden ${currentResult.error ? 'bg-slate-50 border-dashed border-slate-300' : 'bg-white border-blue-100 shadow-xl shadow-blue-50'}`}>
            {!currentResult.error ? (
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100"><Play size={18} /></div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Live Preview</span>
                </div>
                <div>
                  <h4 className="text-slate-400 font-bold text-xs uppercase tracking-widest truncate pr-4">{indicatorName || '이름 없는 지표'}</h4>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className={`text-5xl md:text-6xl font-black tracking-tighter tabular-nums ${currentSignal.color}`}>{currentResult.value}</p>
                  </div>
                </div>
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black ${currentSignal.bg} ${currentSignal.color} border border-current/10`}>
                  <span>{currentSignal.icon}</span>
                  <span>{currentSignal.text}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-slate-300 gap-3">
                <Code size={40} className="opacity-20" />
                <p className="text-[10px] md:text-xs font-black uppercase text-center px-4">
                  {currentResult.error === 'invalid'
                    ? '결과가 NaN 또는 무한대입니다'
                    : 'Waiting for valid input...'}
                </p>
              </div>
            )}
          </div>

          <div className="md:w-48 flex flex-col gap-2">
            <button
              onClick={handleSaveIndicator}
              className="h-full min-h-[120px] bg-blue-600 hover:bg-blue-700 text-white rounded-[2.5rem] font-black text-sm shadow-xl shadow-blue-200 transition-all flex flex-col items-center justify-center gap-3 p-6 active:scale-95"
            >
              <Save size={24} />
              <span>지표 보관함에 저장</span>
              <span className="text-[10px] opacity-60 font-bold tracking-tighter">{indicators.length} / 3 SAVED</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 백테스트 패널 ── */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600" />
            백테스트
            <span className="text-[10px] font-bold text-slate-400 ml-1">5분봉 · 최근 30일 · {altName}</span>
          </h3>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            승: ±0.5% / 대승: ±1.5% (3봉 내)
          </span>
        </div>

        <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
          ※ 백테스트 결과는 과거 데이터에 기반한 <strong className="text-rose-500 font-bold">참고용 지표</strong>입니다. <strong className="text-rose-500 font-bold">미래 수익을 보장하지 않으며</strong>, 시장 환경·유동성·체결 미끄럼 등은 반영되지 않습니다. 단일 결과만으로 매매 결정을 내리지 마세요.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">승패 판정 기준</p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            과거 5분봉을 순회하며 점수가 임계값을 만족할 때마다 신호로 카운트합니다. <strong className="text-emerald-600 font-bold">매수 신호</strong>(score ≥ Buy)는 이후 3봉(15분) 이내 봉의 <strong>고가</strong>가 신호가 대비 <strong className="text-emerald-600 font-bold">+0.5% 이상</strong>이면 <strong>승</strong>, <strong className="text-emerald-600 font-bold">+1.5% 이상</strong>이면 <strong>대승</strong>. <strong className="text-red-500 font-bold">매도 신호</strong>(score ≤ Sell)는 이후 3봉의 <strong>저가</strong>가 -0.5%/-1.5% 도달 여부를 같은 룰로 측정합니다. 대승은 승에 포함됩니다.
          </p>
        </div>

        {usesOrderbookVars(formula) ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-rose-600 leading-relaxed">
              호가 변수(<code className="font-mono">TOTAL_BID</code>, <code className="font-mono">TOTAL_ASK</code>, <code className="font-mono">BID_ASK_RATIO</code>)가 포함된 수식은 과거 데이터가 없어 백테스트가 비활성화됩니다. 호가 변수를 제거하면 사용 가능합니다.
            </p>
          </div>
        ) : backtestRunning ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-600">
              <span className="flex items-center gap-2">
                <RefreshCcw size={14} className="animate-spin text-blue-500" />
                과거 5분봉 데이터를 받아오는 중...
              </span>
              <span className="tabular-nums">{Math.round(backtestProgress * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${backtestProgress * 100}%` }}></div>
            </div>
          </div>
        ) : backtestResult && backtestResult.altMarket === selectedAlt ? (
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-slate-500 tabular-nums">
              {formatBacktestPeriod(backtestResult)}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: '🟢 매수 신호', data: backtestResult.buy, cardCls: 'bg-emerald-50/60 border-emerald-200', titleCls: 'text-emerald-600', emphCls: 'text-emerald-700' },
                { label: '🔴 매도 신호', data: backtestResult.sell, cardCls: 'bg-red-50/60 border-red-200', titleCls: 'text-red-600', emphCls: 'text-red-700' },
              ].map(({ label, data, cardCls, titleCls, emphCls }) => {
                const winRate = data.total > 0 ? (data.wins / data.total) * 100 : 0;
                const bigWinRate = data.total > 0 ? (data.bigWins / data.total) * 100 : 0;
                return (
                  <div key={label} className={`rounded-2xl p-4 border ${cardCls}`}>
                    <p className={`text-[10px] font-black uppercase tracking-tighter mb-1 ${titleCls}`}>{label}</p>
                    {data.total === 0 ? (
                      <p className="text-xs font-bold text-slate-400 mt-2">신호 없음</p>
                    ) : (
                      <>
                        <p className="text-3xl font-black tabular-nums text-slate-800">{winRate.toFixed(1)}%</p>
                        <p className="text-[10px] font-bold text-slate-500 tabular-nums">승률 ({data.wins} / {data.total})</p>
                        <p className={`text-xs font-black tabular-nums mt-1 ${emphCls}`}>
                          대승률 {bigWinRate.toFixed(1)}% ({data.bigWins})
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={handleRunBacktest} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2">
              <RefreshCcw size={12} /> 다시 실행
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {backtestResult && backtestResult.altMarket !== selectedAlt && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                <p className="text-xs font-bold text-slate-600">
                  현재 종목(<strong className="text-blue-600">{altName}</strong>)에 대한 백테스트 결과가 없습니다.
                </p>
              </div>
            )}
            <button
              onClick={handleRunBacktest}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Play size={18} />
              백테스트 실행 ({altName} 5분봉 30일, 약 20초)
            </button>
          </div>
        )}
      </div>

      {/* 커스텀 모달 */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${modalState.type === 'alert' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                {modalState.type === 'alert' ? <AlertCircle size={24} /> : <Info size={24} />}
              </div>
              <h3 className="text-lg font-black text-slate-800">
                {modalState.type === 'alert' ? '알림' : '확인 필요'}
              </h3>
            </div>
            <p className="text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">
              {modalState.message}
            </p>
            <div className="flex gap-3 pt-2">
              {modalState.type === 'confirm' && (
                <button
                  onClick={() => setModalState({ isOpen: false, type: '', message: '', onConfirm: null })}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-colors"
                >
                  취소
                </button>
              )}
              <button
                onClick={() => {
                  if (modalState.onConfirm) modalState.onConfirm();
                  setModalState({ isOpen: false, type: '', message: '', onConfirm: null });
                }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
