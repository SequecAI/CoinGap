import React, { useState, useEffect, useRef } from 'react';
import {
  X, Bot, Zap, AlertTriangle, ChevronRight, ChevronLeft,
  ShieldCheck, ShieldAlert, KeyRound,
} from 'lucide-react';

// 실거래 약관은 의도적으로 매번 띄운다 — 사용자가 매 실행 직전에 책임을 환기하게 함.
// localStorage 저장 안 함.
const SAFETY_KEY = 'coingap_desktop_safety_limits';
const DEFAULT_LIMITS = {
  max_exposure_krw: 100_000,
  daily_loss_limit_krw: 50_000,
  min_order_krw: 5_000,   // 업비트 최소 주문 금액 (고정, 표시용)
};

/**
 * 로직 실행 시작 전 모달.
 *
 * 흐름:
 *   step='mode'  → 모의투자 선택: 즉시 onConfirm({mode:'paper'})
 *                  실거래 선택: 약관 미동의면 disclaimer, 동의되어 있으면 safety
 *   step='disclaimer' → 동의: localStorage 저장 + safety로 이동
 *   step='safety' → 시작: onConfirm({mode:'live', limits})
 *
 * 실거래 모드 진입 가드:
 *   · API 키가 저장되어 있어야 함 (없으면 안내만)
 *   · 약관 동의 1회 (이후엔 기억)
 *   · 안전장치(최대 노출액, 일일 손실 한도) 사용자 입력
 */
export default function RunModal({ open, logic, apiKeySaved, onClose, onConfirm }) {
  const [step, setStep] = useState('mode');
  const [limits, setLimits] = useState(() => readSavedLimits());

  // 열릴 때마다 초기 step으로
  useEffect(() => {
    if (open) setStep('mode');
  }, [open, logic?.logicId]);

  if (!open || !logic) return null;

  const goLive = () => {
    if (!apiKeySaved) return; // 안내만, 진행 차단
    // 약관은 매번 다시 보여준다 (이전 동의를 기억하지 않음)
    setStep('disclaimer');
  };

  const agreeDisclaimer = () => {
    setStep('safety');
  };

  const startLive = () => {
    localStorage.setItem(SAFETY_KEY, JSON.stringify(limits));
    onConfirm({ mode: 'live', limits });
  };

  const startPaper = () => onConfirm({ mode: 'paper', limits: null });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Bot size={18} className="text-violet-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-800 truncate">{logic.name || '이름 없음'}</h3>
              <p className="text-[10px] text-slate-400 font-medium tabular-nums">{logic.symbol}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1" title="닫기">
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          {step === 'mode' && (
            <ModeStep
              apiKeySaved={apiKeySaved}
              onPaper={startPaper}
              onLive={goLive}
            />
          )}
          {step === 'disclaimer' && (
            <DisclaimerStep
              onBack={() => setStep('mode')}
              onAgree={agreeDisclaimer}
            />
          )}
          {step === 'safety' && (
            <SafetyStep
              limits={limits}
              setLimits={setLimits}
              onBack={() => setStep('mode')}
              onStart={startLive}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ModeStep({ apiKeySaved, onPaper, onLive }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 font-medium">실행 모드를 선택해주세요.</p>

      <button
        onClick={onPaper}
        className="w-full text-left p-4 rounded-2xl border-2 border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-600 text-white shrink-0">
            <Bot size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900">모의투자</p>
            <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-relaxed">
              시드머니 1,000,000원으로 가상 거래. 실제 돈은 움직이지 않습니다.
            </p>
          </div>
          <ChevronRight size={16} className="text-violet-400 shrink-0" />
        </div>
      </button>

      <button
        onClick={onLive}
        disabled={!apiKeySaved}
        className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${
          apiKeySaved
            ? 'border-rose-200 bg-rose-50 hover:border-rose-400 hover:bg-rose-100'
            : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${apiKeySaved ? 'bg-rose-600 text-white' : 'bg-slate-300 text-white'}`}>
            <Zap size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900">실거래</p>
            <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-relaxed">
              {apiKeySaved
                ? '내 업비트 계정에서 실제 주문이 들어갑니다. 진짜 돈이 움직입니다.'
                : 'API 키를 먼저 저장해야 실거래를 사용할 수 있습니다.'}
            </p>
          </div>
          {apiKeySaved && <ChevronRight size={16} className="text-rose-400 shrink-0" />}
        </div>
      </button>

      {!apiKeySaved && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800">
          <KeyRound size={14} className="mt-0.5 shrink-0" />
          <p className="text-[11px] font-medium leading-relaxed">
            아래 "업비트 API 키" 카드에서 키를 먼저 저장해주세요.
          </p>
        </div>
      )}
    </div>
  );
}

function DisclaimerStep({ onBack, onAgree }) {
  const [agreed, setAgreed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef(null);

  const onScroll = (e) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setScrolled(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-rose-700">
        <ShieldAlert size={16} />
        <h4 className="text-sm font-black">실거래 시작 전 안내</h4>
      </div>

      <div
        ref={ref}
        onScroll={onScroll}
        className="max-h-64 overflow-y-auto p-4 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-medium leading-relaxed space-y-3"
      >
        <p>
          <strong className="text-slate-900">1. 모든 거래는 본인 책임입니다.</strong><br />
          CoinGap Desktop은 사용자가 만든 로직을 자동으로 실행하는 도구일 뿐, 투자 자문이나
          수익 보장 서비스가 아닙니다. 발생하는 모든 손익은 전적으로 사용자에게 귀속됩니다.
        </p>
        <p>
          <strong className="text-slate-900">2. 기술적 한계.</strong><br />
          네트워크 지연, 거래소 점검, API 오류, 슬리피지, 분봉 미체결 갭, 컴퓨터 종료 등으로
          기대한 시점·가격에 주문이 들어가지 않을 수 있고, 일부 주문은 누락·중복될 수 있습니다.
          백테스트 결과가 미래 수익을 보장하지 않습니다.
        </p>
        <p>
          <strong className="text-slate-900">3. API 키 권한.</strong><br />
          업비트 Open API 키 발급 시 <strong>자산조회·주문</strong> 권한만 체크하시고,
          <strong className="text-rose-700"> 출금 권한은 절대 켜지 마세요.</strong>
          IP 허용 목록을 사용하실 것을 강력히 권장합니다.
        </p>
        <p>
          <strong className="text-slate-900">4. 안전장치.</strong><br />
          최대 1회 매수 금액과 일일 손실 한도는 사용자가 설정합니다. 이 한도를 넘는 거래는
          자동으로 차단되지만, 한도 자체가 무리하면 큰 손실이 날 수 있습니다.
        </p>
        <p>
          <strong className="text-slate-900">5. 컴퓨터 작동 필요.</strong><br />
          이 앱이 켜져 있고 인터넷이 연결되어 있어야 자동매매가 동작합니다. 절전·종료·네트워크
          단절 시 거래는 즉시 멈춥니다.
        </p>
        <p className="text-slate-500 pt-2 border-t border-slate-200">
          위 내용을 모두 이해하셨다면 아래 체크박스에 동의 후 다음으로 진행하세요.
        </p>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={!scrolled}
          className="mt-0.5 w-4 h-4 accent-violet-600 disabled:opacity-40"
        />
        <span className="text-xs text-slate-700 font-bold leading-relaxed">
          위 안내를 모두 확인했고, 모든 거래 결과가 본인 책임임을 이해합니다.
          {!scrolled && (
            <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
              ※ 끝까지 스크롤하면 동의할 수 있습니다.
            </span>
          )}
        </span>
      </label>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
        >
          <ChevronLeft size={14} />
          뒤로
        </button>
        <button
          onClick={onAgree}
          disabled={!agreed}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-colors"
        >
          동의하고 다음
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function SafetyStep({ limits, setLimits, onBack, onStart }) {
  const setN = (key) => (e) => {
    const v = Number(e.target.value.replace(/[^\d]/g, '')) || 0;
    setLimits((prev) => ({ ...prev, [key]: v }));
  };

  const allocPct = 25; // TODO: 로직에서 가져오기 — 일단 default 표시용
  const valid = limits.max_exposure_krw >= limits.min_order_krw && limits.daily_loss_limit_krw > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-rose-700">
        <ShieldCheck size={16} />
        <h4 className="text-sm font-black">안전장치 설정</h4>
      </div>

      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
        실거래에서 한 번에 매수할 수 있는 최대 금액과, 하루 손실을 차단할 한도입니다.
        이 값을 넘으면 봇이 자동으로 신규 진입을 멈춥니다.
      </p>

      <NumberInput
        label="1회 최대 매수 금액"
        value={limits.max_exposure_krw}
        onChange={setN('max_exposure_krw')}
        suffix="원"
        hint="진입 신호가 와도 이 금액보다 큰 매수는 차단됩니다."
      />

      <NumberInput
        label="일일 손실 한도"
        value={limits.daily_loss_limit_krw}
        onChange={setN('daily_loss_limit_krw')}
        suffix="원"
        hint="KST 자정 기준 누적 손실이 이 금액을 넘으면 신규 진입이 멈춥니다. (보유 중 포지션은 청산 신호 따름)"
      />

      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">업비트 최소 주문</p>
          <p className="text-xs font-bold text-slate-700 mt-0.5">변경 불가 (고정)</p>
        </div>
        <p className="text-sm font-black text-slate-800 tabular-nums">
          {limits.min_order_krw.toLocaleString('ko-KR')}원
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <p className="text-[11px] font-medium leading-relaxed">
          이 화면에서 "시작"을 누르는 순간부터 실거래 모드로 진입합니다.
          한 번에 한 로직만 실행 가능합니다.
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
        >
          <ChevronLeft size={14} />
          뒤로
        </button>
        <button
          onClick={onStart}
          disabled={!valid}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-colors"
        >
          <Zap size={14} />
          실거래 시작
        </button>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix, hint }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={Number(value).toLocaleString('ko-KR')}
          onChange={onChange}
          className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-12 py-2.5 text-sm font-mono tabular-nums outline-none focus:border-violet-400 transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
          {suffix}
        </span>
      </div>
      {hint && <p className="mt-1 text-[10px] text-slate-400 font-medium leading-relaxed">{hint}</p>}
    </div>
  );
}

function readSavedLimits() {
  try {
    const saved = localStorage.getItem(SAFETY_KEY);
    if (!saved) return DEFAULT_LIMITS;
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_LIMITS, ...parsed };
  } catch {
    return DEFAULT_LIMITS;
  }
}
