import React, { useState } from 'react';
import { Smartphone, X, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Capacitor } from '@capacitor/core';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.coingap.app';

// ── 디바이스 감지 ──
function isAndroidWeb() {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return false; // 이미 앱 안에서 동작 중
  return /android/i.test(navigator.userAgent || '');
}

function isIOS() {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+는 데스크톱 UA를 흉내내지만 touch 가능
  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * 헤더에 표시되는 작은 안드로이드 앱 다운로드 버튼.
 *
 * 노출 조건:
 *   · Capacitor 네이티브 (= 이미 안드로이드 앱 안에서 실행 중) → 숨김
 *   · iOS 브라우저 → 숨김 (iOS 앱 없음)
 *   · 안드로이드 브라우저 → 표시. 클릭 시 Play Store로 즉시 이동
 *   · PC 브라우저 → 표시. 클릭 시 QR 모달 (폰으로 스캔해서 설치 유도)
 */
export default function AppDownloadBadge() {
  const [qrOpen, setQrOpen] = useState(false);

  // 숨김 분기 — 가장 먼저
  if (Capacitor.isNativePlatform()) return null;
  if (isIOS()) return null;

  const isAndroid = isAndroidWeb();

  if (isAndroid) {
    // 안드로이드 브라우저: Play Store 직접 링크
    return (
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noreferrer noopener"
        title="Android 앱 받기"
        className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-all"
        aria-label="Android 앱 받기"
      >
        <Smartphone size={18} />
      </a>
    );
  }

  // PC: 클릭 시 QR 모달
  return (
    <>
      <button
        onClick={() => setQrOpen(true)}
        title="안드로이드 앱 받기 (QR 코드)"
        className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-all"
        aria-label="안드로이드 앱 받기"
      >
        <Smartphone size={18} />
      </button>
      {qrOpen && <QrModal onClose={() => setQrOpen(false)} />}
    </>
  );
}

function QrModal({ onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PLAY_STORE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 권한 거부 등 — 무시
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 text-center"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Smartphone size={18} />
            </div>
            <h3 className="text-sm font-black text-slate-800">안드로이드 앱 다운로드</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
            title="닫기"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          폰의 카메라로 아래 QR 코드를 스캔하면<br />
          Google Play 스토어가 자동으로 열립니다.
        </p>

        <div className="flex justify-center">
          <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl">
            <QRCodeSVG
              value={PLAY_STORE_URL}
              size={192}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">또는 링크 직접 열기</p>
          <div className="flex items-center gap-1.5">
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="flex-1 text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 truncate hover:bg-slate-100 transition-colors"
              title="새 탭에서 열기"
            >
              {PLAY_STORE_URL}
            </a>
            <button
              onClick={handleCopy}
              title={copied ? '복사됨' : 'URL 복사'}
              className={`shrink-0 p-2 rounded-lg border transition-colors ${
                copied
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
              aria-label={copied ? '복사 완료' : 'URL 복사'}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 font-medium pt-2 border-t border-slate-100">
          ※ iOS 앱은 아직 지원되지 않습니다.
        </p>
      </div>
    </div>
  );
}
