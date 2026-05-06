import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { stockMarketPosts } from '../data/marketPosts';

// 주식 모드 전용 시황 게시판.
// stockMarketPosts에 일일 글이 누적되어 카드 리스트로 표시.
// 향후 서버 DB로 이전 시 동일 스키마 fetch 결과로 교체.
export default function StockBoardTab() {
  const [expandedId, setExpandedId] = useState(null);

  const sorted = [...stockMarketPosts].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <BookOpen size={18} className="text-emerald-600" />
          시황 분석 게시판
        </h3>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
          국내 주식 시황
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
            return (
              <article
                key={post.id}
                onClick={() => setExpandedId(isExpanded ? null : post.id)}
                className={`cursor-pointer p-4 md:p-5 border-2 rounded-2xl transition-all
                  ${isExpanded
                    ? 'border-emerald-400 bg-emerald-50/40 shadow-md'
                    : 'border-slate-100 bg-white hover:border-emerald-300'}`}
              >
                <div className="flex items-center justify-between mb-2 gap-3">
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full tabular-nums shrink-0">
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
                  <p className="text-[10px] font-bold text-emerald-500 mt-2">전체 보기 →</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
