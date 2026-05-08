import React, { useState, useEffect, useCallback } from 'react';
import { Newspaper, ChevronDown, ChevronUp, Plus, Send, X, Pencil } from 'lucide-react';

const API_BASE = 'https://oo78pteio2.execute-api.ap-northeast-2.amazonaws.com';
const ADMIN_EMAIL = 'adminsequenceai@gmail.com';

export default function MarketBrief({ appMode, userInfo }) {
  const [isOpen, setIsOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  // 페이지네이션 상태 (이전 시황 목록용)
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 5;

  // 작성/수정 공용 상태
  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null); // 수정 대상 post
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState(null);

  const marketType = appMode === 'stock' ? 'market_stock' : 'market_crypto';
  const isAdmin = userInfo?.email === ADMIN_EMAIL;

  const fetchMarketPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/posts?type=${marketType}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err) {
      console.error('[MarketBrief] fetch 실패:', err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [marketType]);

  useEffect(() => {
    fetchMarketPosts();
    setExpandedPostId(null);
  }, [fetchMarketPosts, currentPage]);

  const openCreateForm = () => {
    setFormMode('create');
    setEditTarget(null);
    setTitle('');
    setContent('');
  };

  const openEditForm = (post) => {
    setFormMode('edit');
    setEditTarget(post);
    setTitle(post.title);
    setContent(post.content);
  };

  const closeForm = () => {
    setFormMode(null);
    setEditTarget(null);
    setTitle('');
    setContent('');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !userInfo) return;
    setIsSubmitting(true);
    try {
      if (formMode === 'edit' && editTarget) {
        // 수정
        const res = await fetch(`${API_BASE}/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'update',
            PK: editTarget.PK,
            SK: editTarget.SK,
            userId: userInfo.userId,
            title: title.trim(),
            content: content.trim(),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        // 새 작성
        const res = await fetch(`${API_BASE}/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'create',
            type: marketType,
            userId: userInfo.userId,
            nickname: userInfo.nickname,
            email: userInfo.email,
            title: title.trim(),
            content: content.trim(),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      closeForm();
      fetchMarketPosts();
    } catch (err) {
      alert((formMode === 'edit' ? '수정' : '작성') + ' 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (post) => {
    if (!confirm('이 시황 분석을 삭제하시겠습니까?')) return;
    try {
      await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'delete', PK: post.PK, SK: post.SK, postId: post.postId }),
      });
      fetchMarketPosts();
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  const latest = posts[0];
  const isStock = appMode === 'stock';

  // 시황 글이 없고, 관리자도 아니면 아예 숨김
  if (!latest && !isAdmin) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {/* 헤더 (접기/펼치기) */}
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
              {latest && (
                <span className={`text-[10px] font-black tabular-nums ${isStock ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {latest.createdAt ? latest.createdAt.split('T')[0] : ''}
                </span>
              )}
            </div>
            <p className="text-sm font-black text-slate-900 truncate">
              {loading ? '불러오는 중...' : latest ? latest.title : '작성된 시황이 없습니다'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-slate-400">
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {/* 펼친 영역 */}
      {isOpen && (
        <div className="border-t border-slate-100 px-4 md:px-5 py-4 md:py-5 space-y-4">
          {/* 최신 시황 글 표시 */}
          {latest ? (
            <div>
              <p className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-line">
                {latest.content}
              </p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-medium text-slate-400 leading-relaxed">
                  ※ 작성 시점의 시장 데이터와 공개 정보를 바탕으로 한 참고용 분석 자료이며, 매매 권유나 투자 자문이 아닙니다.
                </p>
                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <button onClick={() => openEditForm(latest)} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600">수정</button>
                    <button onClick={() => handleDelete(latest)} className="text-[10px] font-bold text-red-400 hover:text-red-600">삭제</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 font-medium text-center py-4">아직 작성된 시황이 없습니다.</p>
          )}

          {/* 과거 시황 목록 (2번째부터) */}
          {posts.length > 1 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px bg-slate-100 flex-1"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">이전 시황 ({posts.length - 1}건)</span>
                <div className="h-px bg-slate-100 flex-1"></div>
              </div>
              <div className="space-y-2">
                {posts.slice(1 + (currentPage - 1) * postsPerPage, 1 + currentPage * postsPerPage).map(p => (
                  <div key={p.postId} className="bg-slate-50/50 rounded-2xl overflow-hidden border border-slate-100 transition-all">
                    <button 
                      onClick={() => setExpandedPostId(expandedPostId === p.postId ? null : p.postId)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-bold text-slate-400 tabular-nums block mb-0.5">{p.createdAt?.split('T')[0]}</span>
                        <h5 className="text-xs font-black text-slate-700 truncate">{p.title}</h5>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {isAdmin && (
                          <div className="flex items-center gap-2 mr-1">
                            <span onClick={(e) => { e.stopPropagation(); openEditForm(p); }} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-600 cursor-pointer">수정</span>
                            <span onClick={(e) => { e.stopPropagation(); handleDelete(p); }} className="text-[9px] font-bold text-red-400 hover:text-red-600 cursor-pointer">삭제</span>
                          </div>
                        )}
                        {expandedPostId === p.postId ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                      </div>
                    </button>
                    {expandedPostId === p.postId && (
                      <div className="px-4 pb-4 border-t border-slate-100/50 pt-3">
                        <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-line">
                          {p.content}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* 페이지네이션 */}
                {posts.length - 1 > postsPerPage && (
                  <div className="flex justify-center items-center gap-4 mt-4 pt-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="text-xs font-bold text-slate-500 disabled:opacity-30 hover:text-slate-700"
                    >
                      ← 이전
                    </button>
                    <span className="text-xs font-bold text-slate-400">
                      {currentPage} / {Math.ceil((posts.length - 1) / postsPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil((posts.length - 1) / postsPerPage), p + 1))}
                      disabled={currentPage === Math.ceil((posts.length - 1) / postsPerPage)}
                      className="text-xs font-bold text-slate-500 disabled:opacity-30 hover:text-slate-700"
                    >
                      다음 →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 관리자: 작성/수정 폼 */}
          {isAdmin && !formMode && (
            <button
              onClick={openCreateForm}
              className={`w-full py-2.5 rounded-xl border-2 border-dashed text-xs font-black transition-colors flex items-center justify-center gap-1.5 ${
                isStock 
                  ? 'border-emerald-200 text-emerald-500 hover:bg-emerald-50' 
                  : 'border-blue-200 text-blue-500 hover:bg-blue-50'
              }`}
            >
              <Plus size={14} /> 새 시황 작성
            </button>
          )}

          {isAdmin && formMode && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5">
                  {formMode === 'edit' ? <><Pencil size={12} /> 시황 수정</> : '시황 작성'}
                </span>
                <button onClick={closeForm} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <input
                type="text"
                placeholder="시황 제목"
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
              <textarea
                placeholder="시황 내용을 작성하세요..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[150px] resize-none leading-relaxed"
                value={content}
                onChange={e => setContent(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !title.trim() || !content.trim()}
                  className={`px-4 py-2 rounded-xl text-xs font-black text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                    isStock ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Send size={12} /> {isSubmitting ? '처리 중...' : formMode === 'edit' ? '수정 완료' : '시황 게시'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
