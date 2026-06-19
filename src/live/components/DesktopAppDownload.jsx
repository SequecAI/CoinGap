import React, { useState } from 'react';
import { Download, MonitorSmartphone, ShieldAlert, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

// GitHub Releases에 업로드된 인스톨러의 직접 다운로드 URL.
// release를 새로 만들 때마다 여기 버전·URL을 갱신.
const DOWNLOAD_VERSION = '1.0.0';
const DOWNLOAD_URL = 'https://github.com/Certy-team/CoinGap/releases/download/desktop-v1.0.0/CoinGap.Desktop-Setup-1.0.0.exe';
const FILE_SIZE_MB = 84;

/**
 * /live 페이지 상단에 노출되는 PC 앱 다운로드 카드.
 * Windows 전용, 코드 서명 안 됨 — SmartScreen 우회 안내 포함.
 */
export default function DesktopAppDownload() {
  const [openHelp, setOpenHelp] = useState(false);

  return (
    <section className="bg-gradient-to-br from-violet-50 to-white border border-violet-100 rounded-2xl shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-violet-600 text-white rounded-xl shrink-0">
          <MonitorSmartphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-slate-800">CoinGap Desktop · PC 앱</h2>
          <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
            여기서 실시간 운영 상태를 보려면 PC 앱이 같은 Google 계정으로 켜져 있어야 합니다.
            <br />아직 설치 안 했다면 아래에서 다운로드하세요.
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors"
            >
              <Download size={13} />
              Windows 인스톨러 v{DOWNLOAD_VERSION} ({FILE_SIZE_MB}MB)
            </a>
            <button
              onClick={() => setOpenHelp((v) => !v)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors"
            >
              <ShieldAlert size={13} />
              SmartScreen 경고 우회
              {openHelp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {openHelp && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800">
              <p className="text-[11px] font-bold leading-relaxed">
                코드 서명을 아직 안 한 상태라 처음 실행 시 "Windows의 PC 보호" 경고가 뜹니다.
              </p>
              <ol className="mt-2 text-[11px] font-medium leading-relaxed space-y-1 list-decimal list-inside">
                <li>다운받은 .exe 더블클릭 → 파란 경고 창</li>
                <li>"<strong>추가 정보</strong>" 클릭 → "<strong>실행</strong>" 버튼 클릭</li>
                <li>설치 마법사가 뜨면 그대로 진행 → 바탕화면·시작 메뉴에 바로가기 생김</li>
              </ol>
              <p className="mt-2 text-[10px] text-amber-700 font-medium">
                ※ 이 인스톨러는 Sequence AI에서 빌드한 것으로, 백신 오탐은 정상입니다. 공식 배포처 외에서 받은 파일은 절대 실행하지 마세요.
              </p>
            </div>
          )}

          <p className="mt-3 text-[10px] text-slate-400 font-medium">
            macOS·Linux 빌드는 추후 지원 예정
            <a
              href="https://github.com/Certy-team/CoinGap/releases"
              target="_blank"
              rel="noreferrer noopener"
              className="ml-2 text-violet-600 hover:underline inline-flex items-center gap-0.5"
            >
              과거 버전 보기 <ExternalLink size={9} />
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
