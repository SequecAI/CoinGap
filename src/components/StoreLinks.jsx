import React from 'react';
import { Smartphone, MonitorSmartphone, ExternalLink } from 'lucide-react';

// Play Store (com.coingap.app) + PC 인스톨러 GitHub Releases.
// 한 곳에서만 URL을 관리하도록 상수로 빼둠 — 다음 버전 낼 때 여기만 갱신.
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.coingap.app';
const DESKTOP_URL =
  'https://github.com/Certy-team/CoinGap/releases/download/desktop-v1.0.0/CoinGap.Desktop-Setup-1.0.0.exe';

/**
 * 페이지 footer에 두는 작은 다운로드 링크 한 줄.
 * 디자인: 회색 톤 + ExternalLink 아이콘, 본문과 구분되도록 작은 글씨.
 */
export default function StoreLinks() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400">
      <a
        href={ANDROID_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
      >
        <Smartphone size={11} />
        Android 앱
        <ExternalLink size={9} />
      </a>
      <span className="text-slate-300">·</span>
      <a
        href={DESKTOP_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center gap-1 hover:text-violet-600 transition-colors"
      >
        <MonitorSmartphone size={11} />
        Windows PC 앱
        <ExternalLink size={9} />
      </a>
    </div>
  );
}
