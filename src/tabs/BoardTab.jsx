import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { cryptoMarketPosts, stockMarketPosts } from '../data/marketPosts';

export default function BoardTab({ appMode }) {
  const [expandedId, setExpandedId] = useState(null);

  const posts = appMode === 'stock' ? stockMarketPosts : cryptoMarketPosts;
  const sectionLabel = appMode === 'stock' ? '국내 주식 시황' : '디지털 자산 시황';

  // 최신순 정렬 (date 내림차순). 원 배열은 mutate하지 않음.
  const sorted = [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <BookOpen size={18} className={appMode === 'stock' ? 'text-emerald-600' : 'text-blue-600'} />
          시황 분석 게시판
        </h3>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
          {sectionLabel}
        </span>
      </div>

      <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
        ※ 본 게시판의 내용은 작성 시점의 시장 데이터와 공개 정보를 바탕으로 한 <strong className="text-slate-600">참고용 분석 자료</strong>이며, 매매 권유나 투자 자문이 아닙니다. 모든 투자 판단의 책임은 본인에게 있습니다.
      </p>

      {sorted.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center">
          <p className="text-sm font-bold text-slate-400">아직 작성된 글이 없습니다.</p>
          <p className="text-[11px] font-medium text-slate-400 mt-1">새 글이 올라오면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((post) => {
            const isExpanded = expandedId === post.id;
            const accentBorder = appMode === 'stock' ? 'border-emerald-400' : 'border-blue-400';
            const accentBg = appMode === 'stock' ? 'bg-emerald-50/40' : 'bg-blue-50/40';
            const hoverBorder = appMode === 'stock' ? 'hover:border-emerald-300' : 'hover:border-blue-300';
            const dateBadge = appMode === 'stock'
              ? 'text-emerald-600 bg-emerald-50'
              : 'text-blue-600 bg-blue-50';
            const moreHint = appMode === 'stock' ? 'text-emerald-500' : 'text-blue-500';

            return (
              <article
                key={post.id}
                onClick={() => setExpandedId(isExpanded ? null : post.id)}
                className={`cursor-pointer p-4 md:p-5 border-2 rounded-2xl transition-all
                  ${isExpanded
                    ? `${accentBorder} ${accentBg} shadow-md`
                    : `border-slate-100 bg-white ${hoverBorder}`}`}
              >
                <div className="flex items-center justify-between mb-2 gap-3">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full tabular-nums shrink-0 ${dateBadge}`}>
                    {post.date}
                  </span>
                  {isExpanded
                    ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
                    : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                </div>

                <h4 className="text-base md:text-lg font-black text-slate-900 mb-2 leading-tight">
                  {post.title}
                </h4>

                <p
                  className={`text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-line
                    ${isExpanded ? '' : 'line-clamp-2'}`}
                >
                  {post.content}
                </p>

                {!isExpanded && (
                  <p className={`text-[10px] font-bold mt-2 ${moreHint}`}>전체 보기 →</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
