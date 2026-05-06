import React, { useState } from 'react';
import { Newspaper, ChevronDown, ChevronUp } from 'lucide-react';
import { cryptoMarketPosts, stockMarketPosts } from '../data/marketPosts';

// 헤더 아래 고정 위치 collapsible 시황 요약.
// 현재는 appMode 기준 정적 더미 1개를 노출.
// 향후 종목별 AI 요약으로 확장 시: 추가 prop(예: assetCode)을 받아
// 그 종목에 해당하는 요약을 fetch/표시하면 컴포넌트 외부 변경 최소.
export default function MarketBrief({ appMode }) {
  const [isOpen, setIsOpen] = useState(false);

  const posts = appMode === 'stock' ? stockMarketPosts : cryptoMarketPosts;
  const sorted = [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = sorted[0];

  if (!latest) return null;

  const isStock = appMode === 'stock';

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 md:p-5 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-xl shrink-0 ${isStock ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
            <Newspaper size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">오늘의 시황</span>
              <span className={`text-[10px] font-black tabular-nums ${isStock ? 'text-emerald-600' : 'text-blue-600'}`}>
                {latest.date}
              </span>
            </div>
            <p className="text-sm font-black text-slate-900 truncate">
              {latest.title}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-slate-400">
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 px-4 md:px-5 py-4 md:py-5 space-y-3">
          <p className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-line">
            {latest.content}
          </p>
          <p className="text-[10px] font-medium text-slate-400 leading-relaxed pt-2 border-t border-slate-50">
            ※ 작성 시점의 시장 데이터와 공개 정보를 바탕으로 한 참고용 분석 자료이며, 매매 권유나 투자 자문이 아닙니다.
          </p>
        </div>
      )}
    </div>
  );
}
