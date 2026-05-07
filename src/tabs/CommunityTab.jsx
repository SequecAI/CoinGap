import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare, Trophy, PenLine, Send, RefreshCcw, LogIn, User, Eye,
  ThumbsUp, ChevronDown, ChevronUp, AlertCircle, BarChart3, ShieldCheck, Search
} from 'lucide-react';
import { useCommunity } from '../hooks/useCommunity';

const CRYPTO_STORAGE_KEY = 'coinGap_studioIndicators';
const STOCK_STORAGE_KEY = 'coinGap_stockStudioIndicators';

// ── 닉네임 렌더링 헬퍼 ──
function renderNickname(nickname) {
  if (!nickname) return '익명';
  const match = nickname.match(/(.+)#(\d{4})$/);
  if (match) {
    return (
      <span className="flex items-baseline">
        {match[1]}<span className="text-[10px] font-bold text-slate-400 ml-0.5 opacity-80">#{match[2]}</span>
      </span>
    );
  }
  return (
    <span className="text-indigo-600 flex items-center gap-1 font-black">
      {nickname} <ShieldCheck size={12} className="text-indigo-500" />
    </span>
  );
}

function readLocalIndicators(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).indicators || [] : [];
  } catch { return []; }
}

// ── 승률 계산 헬퍼 ──
function calcAvgWinRate(backtest) {
  if (!backtest) return null;
  const buckets = [backtest.buy, backtest.sell].filter(b => b && b.total > 0);
  if (buckets.length === 0) return null;
  const sum = buckets.reduce((a, b) => a + (b.wins / b.total) * 100, 0);
  return sum / buckets.length;
}

// ── 지표 점수 계산 헬퍼 ──
function calcIndicatorScore(backtest) {
  if (!backtest) return null;
  const buckets = [backtest.buy, backtest.sell].filter(b => b && b.total > 0);
  if (buckets.length === 0) return null;
  let score = 0;
  buckets.forEach(b => {
    const winRate = (b.wins / b.total) * 100;
    score += (winRate - 50) * b.wins;
  });
  return Math.round(score);
}

function formatCompactPeriod(bt, mode) {
  if (!bt) return '';
  const toShort = (iso) => iso ? iso.split('T')[0].slice(5, 10).replace(/-/g, '.') : '';
  const name = bt.stockName || bt.altName || (bt.altMarket ? bt.altMarket.replace('KRW-', '') : '');
  const typeStr = mode === 'stock' ? '주식' : '코인';
  return `[${typeStr}] ${name} (${toShort(bt.periodStart)}~${toShort(bt.periodEnd)})`;
}

// ── 시간 포맷 ──
function timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(isoStr).toLocaleDateString('ko-KR');
}

// ── 로그인 유도 ──
function LoginPrompt() {
  return (
    <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-3xl p-8 text-center space-y-4">
      <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
        <LogIn size={28} className="text-indigo-500" />
      </div>
      <p className="text-base font-black text-slate-700">구글 로그인이 필요합니다</p>
      <p className="text-sm text-slate-500 font-medium">
        글 작성 및 지표 공유를 위해 상단의 <strong className="text-indigo-600">Google 로그인</strong> 버튼을 눌러주세요.
      </p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-10 text-center">
      <p className="text-sm font-bold text-slate-400">{text}</p>
    </div>
  );
}

// ── 댓글 섹션 ──
function CommentSection({ postId, userInfo, fetchComments, createComment, updateComment, deleteComment }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  const loadComments = React.useCallback(async () => {
    setLoading(true);
    const data = await fetchComments(postId);
    setComments(data);
    setLoading(false);
  }, [postId, fetchComments]);

  React.useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleCreate = async () => {
    if (!newComment.trim() || !userInfo) return;
    try {
      await createComment({
        postId,
        userId: userInfo.userId,
        nickname: userInfo.nickname,
        profileImage: userInfo.profileImage,
        content: newComment.trim()
      });
      setNewComment('');
      loadComments();
    } catch(err) { alert('댓글 작성 실패: ' + err.message); }
  };

  const handleUpdate = async (comment) => {
    if (!editContent.trim()) return;
    try {
      await updateComment(comment.PK, comment.SK, editContent.trim());
      setEditingId(null);
      loadComments();
    } catch(err) { alert('댓글 수정 실패: ' + err.message); }
  };

  const handleDelete = async (comment) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      await deleteComment(comment.PK, comment.SK);
      loadComments();
    } catch(err) { alert('댓글 삭제 실패: ' + err.message); }
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-200/60">
      <h5 className="text-xs font-black text-slate-700 mb-3">댓글 {comments.length}개</h5>
      
      {/* 댓글 목록 */}
      <div className="space-y-3 mb-4">
        {loading ? <p className="text-xs text-slate-400">불러오는 중...</p> : comments.map(c => {
          const isAuthor = userInfo?.userId === c.userId;
          const isEditing = editingId === c.commentId;
          
          return (
            <div key={c.commentId} className="flex gap-2.5">

              <div className="flex-1 min-w-0 bg-white/50 rounded-xl p-2.5 border border-slate-100">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-[11px] font-black text-slate-700 truncate">{renderNickname(c.nickname)}</div>
                  <span className="text-[9px] font-bold text-slate-400 tabular-nums shrink-0">{timeAgo(c.createdAt)}</span>
                </div>
                {isEditing ? (
                  <div className="mt-2">
                    <textarea className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-400 min-h-[60px] resize-none" value={editContent} onChange={e=>setEditContent(e.target.value)} />
                    <div className="flex justify-end gap-1 mt-1">
                      <button onClick={()=>setEditingId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-[10px] font-bold">취소</button>
                      <button onClick={()=>handleUpdate(c)} className="px-2 py-1 bg-indigo-500 text-white rounded text-[10px] font-bold">저장</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-600 font-medium whitespace-pre-line leading-relaxed">{c.content}</p>
                    {isAuthor && (
                      <div className="flex justify-end gap-2 mt-1">
                        <button onClick={()=>{setEditingId(c.commentId); setEditContent(c.content);}} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600">수정</button>
                        <button onClick={()=>handleDelete(c)} className="text-[10px] font-bold text-slate-400 hover:text-red-500">삭제</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 댓글 작성 폼 */}
      {userInfo ? (
        <div className="flex gap-2">

          <div className="flex-1 flex gap-2">
            <input 
              type="text" 
              placeholder="댓글을 남겨보세요..." 
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
              value={newComment}
              onChange={e=>setNewComment(e.target.value)}
              onKeyDown={e=>e.key==='Enter' && handleCreate()}
            />
            <button onClick={handleCreate} disabled={!newComment.trim()} className="w-8 h-8 shrink-0 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white rounded-xl flex items-center justify-center transition-colors">
              <Send size={14} className="ml-[-1px]" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-slate-400">댓글을 작성하려면 로그인이 필요합니다.</p>
        </div>
      )}
    </div>
  );
}

// ── 자유게시판 카드 ──
function FreePostCard({ post, userInfo, onUpdate, onDelete, commentActions, onIncrementViews }) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [localViews, setLocalViews] = useState(post.views || 0);
  const [hasViewed, setHasViewed] = useState(false);

  const isAuthor = userInfo?.userId === post.userId;

  const handleExpand = () => {
    if (!expanded && !hasViewed) {
      setLocalViews(v => v + 1);
      setHasViewed(true);
      if (onIncrementViews) onIncrementViews(post.PK, post.SK);
    }
    setExpanded(!expanded);
  };

  const handleUpdate = async () => {
    if (!editTitle.trim()) return;
    try {
      await onUpdate({ ...post, title: editTitle.trim(), content: editContent.trim() });
      setIsEditing(false);
    } catch(err) { alert('수정 실패: ' + err.message); }
  };

  const handleDelete = async () => {
    if (window.confirm('게시글을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 댓글도 함께 삭제됩니다.')) {
      try {
        await onDelete(post);
      } catch(err) { alert('삭제 실패: ' + err.message); }
    }
  };

  if (isEditing) {
    return (
      <article className="p-5 border-2 border-indigo-400 bg-indigo-50/30 rounded-2xl shadow-md">
        <input 
          className="w-full mb-3 p-3 rounded-xl border border-indigo-200 outline-none focus:border-indigo-500 font-black text-sm" 
          value={editTitle} 
          onChange={e=>setEditTitle(e.target.value)} 
          placeholder="제목을 입력하세요"
        />
        <textarea 
          className="w-full mb-3 p-3 rounded-xl border border-indigo-200 outline-none focus:border-indigo-500 text-sm font-medium resize-none min-h-[120px]" 
          value={editContent} 
          onChange={e=>setEditContent(e.target.value)} 
          placeholder="내용을 입력하세요"
        />
        <div className="flex justify-end gap-2">
          <button onClick={()=>setIsEditing(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black transition-colors">취소</button>
          <button onClick={handleUpdate} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black transition-colors">저장</button>
        </div>
      </article>
    );
  }

  return (
    <article className={`p-5 border-2 rounded-2xl transition-all ${expanded ? 'border-indigo-400 bg-indigo-50/30 shadow-md' : 'border-slate-100 bg-white hover:border-indigo-300'}`}>
      <div onClick={handleExpand} className="cursor-pointer">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="text-xs font-black text-slate-600 truncate">{renderNickname(post.nickname)}</div>
            <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">{timeAgo(post.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
              <Eye size={12} /> <span className="tabular-nums">{localViews}</span>
            </div>
            {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </div>
        </div>
        <h4 className="text-base font-black text-slate-900 mb-2 leading-tight">{post.title}</h4>
        <p className={`text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-line ${expanded ? '' : 'line-clamp-2'}`}>{post.content}</p>
        {!expanded && <p className="text-[10px] font-bold text-indigo-500 mt-2 flex items-center gap-1"><MessageSquare size={12}/> 펼쳐서 댓글 보기 →</p>}
      </div>

      {expanded && (
        <>
          {isAuthor && (
             <div className="flex justify-end gap-3 mt-4">
               <button onClick={()=>setIsEditing(true)} className="text-xs font-bold text-slate-400 hover:text-indigo-600">글 수정</button>
               <button onClick={handleDelete} className="text-xs font-bold text-slate-400 hover:text-red-500">글 삭제</button>
             </div>
          )}
          <CommentSection postId={post.postId} userInfo={userInfo} {...commentActions} />
        </>
      )}
    </article>
  );
}

// ── 백테스트 결과 미니 뱃지 ──
function BacktestBadge({ backtest }) {
  if (!backtest) return <span className="text-[10px] font-bold text-slate-400">백테스트 없음</span>;
  const avg = calcAvgWinRate(backtest);
  const score = calcIndicatorScore(backtest);
  if (avg === null) return <span className="text-[10px] font-bold text-slate-400">신호 없음</span>;
  const color = avg >= 60 ? 'text-emerald-600 bg-emerald-50' : avg >= 40 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${color}`}>
        <BarChart3 size={10} />평균 {avg.toFixed(1)}%
      </span>
      <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 text-indigo-600 bg-indigo-50 border border-indigo-100">
        <Trophy size={10} />지표점수 {score.toLocaleString()}점
      </span>
    </div>
  );
}

// ── 지표 랭킹 카드 ──
function IndicatorRankCard({ post, rank, isLoggedIn }) {
  const [expanded, setExpanded] = useState(false);
  const avg = calcAvgWinRate(post.backtest);
  const medalColors = ['bg-amber-400 text-white', 'bg-slate-400 text-white', 'bg-amber-700 text-white'];
  const medalBg = rank <= 3 ? medalColors[rank - 1] : 'bg-slate-200 text-slate-600';
  const modeLabel = post.indicatorMode === 'stock' ? '🇰🇷 주식' : '₿ 코인';
  const score = calcIndicatorScore(post.backtest);

  if (!expanded) {
    return (
      <div onClick={() => setExpanded(true)} className="cursor-pointer flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-amber-300 hover:bg-amber-50/50 transition-all shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${medalBg}`}>{rank}</div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{modeLabel}</span>
          <div className="text-xs font-black text-slate-500 truncate shrink-0 max-w-[100px]">{renderNickname(post.nickname)}</div>
          <h4 className="text-sm font-black text-slate-800 truncate">{post.title}</h4>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 pl-2">
          {avg !== null && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${avg >= 60 ? 'text-emerald-600 bg-emerald-50' : avg >= 40 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'}`}>{avg.toFixed(1)}%</span>}
          <span className="text-sm font-black text-indigo-600 tabular-nums">{score ? score.toLocaleString() : 0}점</span>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>
    );
  }

  const handleCopyIndicator = (e) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      alert('로그인이 필요한 기능입니다.\n상단의 Google 로그인 버튼을 눌러주세요.');
      return;
    }
    const storageKey = post.indicatorMode === 'stock' ? STOCK_STORAGE_KEY : CRYPTO_STORAGE_KEY;
    const saved = readLocalIndicators(storageKey);
    if (saved.length >= 5) {
      alert(`보관함이 가득 찼습니다. (최대 5개)\nEditor 탭에서 기존 지표를 삭제해주세요.`);
      return;
    }
    const newName = post.title + " (복사됨)";
    if (saved.some(ind => ind.name === newName)) {
      alert(`이미 '${newName}' 이름의 지표가 보관함에 있습니다.\n이름이 중복되어 복사할 수 없습니다.`);
      return;
    }

    const newIndicator = {
      id: Date.now().toString(),
      name: newName,
      formula: post.formula,
      thresholds: post.thresholds,
      backtest: post.backtest,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(storageKey, JSON.stringify({ indicators: [...saved, newIndicator] }));
    alert('보관함에 지표가 복사되었습니다! Editor 탭에서 확인하세요.');
  };

  return (
    <article onClick={() => setExpanded(false)}
      className="cursor-pointer p-5 border-2 border-amber-400 bg-amber-50/30 rounded-2xl shadow-md transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${medalBg}`}>{rank}</div>
          <div className="text-xs font-black text-slate-600 truncate">{renderNickname(post.nickname)}</div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 ml-auto sm:ml-0">{modeLabel}</span>
        </div>
        <div className="flex flex-col sm:items-end gap-1.5 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
          {post.backtest && (
            <span className="text-[9px] font-bold text-slate-400 leading-none">
              {formatCompactPeriod(post.backtest, post.indicatorMode)}
            </span>
          )}
          <div className="flex items-center gap-2">
            <BacktestBadge backtest={post.backtest} />
            <ChevronUp size={14} className="text-slate-400" />
          </div>
        </div>
      </div>
      <h4 className="text-base font-black text-slate-900 mb-1 leading-tight">{post.title}</h4>
      {avg !== null && (
        <div className="flex items-end gap-3 mb-2 flex-wrap">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-black tabular-nums ${avg >= 60 ? 'text-emerald-600' : avg >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{avg.toFixed(1)}%</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">avg win rate</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black tabular-nums text-indigo-600">{score ? score.toLocaleString() : 0}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">score</span>
          </div>
        </div>
      )}
      {post.formula && (
        <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-xl mb-2 overflow-x-auto">
          <span className="text-slate-500">score = </span>{post.formula}
        </div>
      )}
      {post.backtest && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          {[
            { label: '🟢 저평가', data: post.backtest.buy, cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { label: '🔴 고평가', data: post.backtest.sell, cls: 'bg-red-50 border-red-200 text-red-700' },
            { label: '🟢 극단 저평가', data: post.backtest.strongBuy, cls: 'bg-emerald-100 border-emerald-300 text-emerald-800' },
            { label: '🔴 극단 고평가', data: post.backtest.strongSell, cls: 'bg-red-100 border-red-300 text-red-800' },
          ].filter(x => x.data && x.data.total > 0).map(({ label, data, cls }) => (
            <div key={label} className={`rounded-xl p-3 border ${cls}`}>
              <p className="text-[10px] font-black uppercase tracking-tighter mb-1">{label}</p>
              <p className="text-lg font-black tabular-nums">
                {(data.wins / data.total * 100).toFixed(1)}% <span className="text-[10px] font-bold opacity-70 ml-1">({data.wins}/{data.total})</span>
              </p>
            </div>
          ))}
        </div>
      )}
      {post.content && (
        <div className="mt-3 bg-white p-4 rounded-xl border border-amber-100">
          <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line">{post.content}</p>
        </div>
      )}
      <div className="mt-4 flex justify-between items-center">
        <button onClick={handleCopyIndicator} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black shadow-sm transition-colors flex items-center gap-1.5">
          지표 복사하기
        </button>
        <span className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">닫기</span>
      </div>
    </article>
  );
}

// ── 지표 공유 폼 (에디터 연동) ──
function IndicatorShareForm({ userInfo, onSubmit }) {
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState(null); // 'crypto' | 'stock'
  const [selectedId, setSelectedId] = useState(null);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const indicators = useMemo(() => {
    if (!mode) return [];
    return readLocalIndicators(mode === 'crypto' ? CRYPTO_STORAGE_KEY : STOCK_STORAGE_KEY);
  }, [mode]);

  const selected = indicators.find(i => i.id === selectedId);

  const handleSubmit = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        type: 'indicator',
        userId: userInfo.userId,
        nickname: userInfo.nickname,
        profileImage: userInfo.profileImage,
        title: selected.name,
        content: content.trim(),
        formula: selected.formula,
        thresholds: selected.thresholds,
        backtest: selected.backtest || null,
        indicatorMode: mode,
      });
      setShowForm(false);
      setMode(null);
      setSelectedId(null);
      setContent('');
    } catch (err) {
      alert('공유 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)}
        className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2 active:scale-95">
        <Trophy size={18} />내 지표 공유하기
      </button>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-slate-700">지표 공유하기</span>
        <button onClick={() => { setShowForm(false); setMode(null); setSelectedId(null); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">취소</button>
      </div>

      {/* Step 1: 코인/주식 선택 */}
      <div className="flex gap-2">
        <button onClick={() => { setMode('crypto'); setSelectedId(null); }}
          className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${mode === 'crypto' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-400'}`}>
          ₿ 코인 에디터
        </button>
        <button onClick={() => { setMode('stock'); setSelectedId(null); }}
          className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${mode === 'stock' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-emerald-400'}`}>
          🇰🇷 주식 에디터
        </button>
      </div>

      {/* Step 2: 저장된 지표 선택 */}
      {mode && (
        indicators.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center">
            <p className="text-sm font-bold text-slate-400">{mode === 'crypto' ? '코인' : '주식'} Editor에 저장된 지표가 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">먼저 Editor 탭에서 지표를 만들고 저장해 주세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">저장된 지표 선택</p>
            {indicators.map(ind => {
              const isSelected = ind.id === selectedId;
              const avg = calcAvgWinRate(ind.backtest);
              return (
                <button key={ind.id} onClick={() => setSelectedId(ind.id)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${isSelected ? 'border-amber-400 bg-amber-50 shadow-md' : 'border-slate-100 bg-white hover:border-amber-300'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{ind.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{ind.formula}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {ind.backtest && (
                        <span className="text-[9px] font-bold text-slate-400 leading-none">
                          {formatCompactPeriod(ind.backtest, mode)}
                        </span>
                      )}
                      <BacktestBadge backtest={ind.backtest} />
                    </div>
                  </div>
                  {isSelected && avg !== null && ind.backtest && (
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: '저평가', data: ind.backtest.buy },
                          { label: '고평가', data: ind.backtest.sell },
                        ].filter(x => x.data && x.data.total > 0).map(({ label, data }) => (
                          <div key={label} className="bg-white rounded-lg p-2 border border-slate-200 text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase">{label}</p>
                            <p className="text-base font-black tabular-nums text-slate-800">
                              {(data.wins / data.total * 100).toFixed(1)}% <span className="text-[9px] font-bold text-slate-400 ml-1">({data.wins}/{data.total})</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}

      {/* Step 3: 설명 + 공유 */}
      {selected && (
        <>
          <textarea placeholder="지표 설명, 사용법, 추천 이유 등을 작성하세요..."
            className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none h-24"
            value={content} onChange={(e) => setContent(e.target.value)} />
          <button onClick={handleSubmit} disabled={isSubmitting}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-xl font-black text-sm shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2 active:scale-95">
            {isSubmitting ? <RefreshCcw size={16} className="animate-spin" /> : <Send size={16} />}
            {isSubmitting ? '공유 중...' : '지표 공유하기'}
          </button>
        </>
      )}
    </div>
  );
}

// ── 자유게시판 글 작성 ──
function FreeWriteForm({ userInfo, onSubmit }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ type: 'board', userId: userInfo.userId, nickname: userInfo.nickname, profileImage: userInfo.profileImage, title: title.trim(), content: content.trim() });
      setTitle(''); setContent(''); setShowForm(false);
    } catch (err) { alert('작성 실패: ' + err.message); }
    finally { setIsSubmitting(false); }
  };

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95">
        <PenLine size={18} />새 글 작성하기
      </button>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {userInfo.profileImage
            ? <img src={userInfo.profileImage} alt="" className="w-6 h-6 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
            : <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center"><User size={12} className="text-white" /></div>}
          <span className="text-xs font-black text-slate-600">{userInfo.nickname}</span>
        </div>
        <button onClick={() => setShowForm(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">취소</button>
      </div>
      <input type="text" placeholder="제목을 입력하세요"
        className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea placeholder="내용을 입력하세요..."
        className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none h-28"
        value={content} onChange={(e) => setContent(e.target.value)} />
      <button onClick={handleSubmit} disabled={isSubmitting || !title.trim()}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-black text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95">
        {isSubmitting ? <RefreshCcw size={16} className="animate-spin" /> : <Send size={16} />}
        {isSubmitting ? '작성 중...' : '게시하기'}
      </button>
    </div>
  );
}


// ══════════════════════════════════════════════
// ── 메인 CommunityTab ──
// ══════════════════════════════════════════════
export default function CommunityTab({ isLoggedIn, userInfo, subTab, onSubTabChange }) {
  const { 
    posts, isLoading, error, 
    fetchPosts, createPost, updatePost, deletePost, incrementViews,
    fetchComments, createComment, updateComment, deleteComment
  } = useCommunity();

  useEffect(() => { fetchPosts(subTab); }, [subTab, fetchPosts]);

  const handleCreatePost = async (postData) => {
    await createPost(postData);
    await fetchPosts(subTab);
  };

  const handleUpdatePost = async (postData) => {
    await updatePost(postData);
    await fetchPosts(subTab);
  };

  const handleDeletePost = async (post) => {
    await deletePost(post.PK, post.SK, post.postId);
    await fetchPosts(subTab);
  };

  const commentActions = { fetchComments, createComment, updateComment, deleteComment };

  // 지표 랭킹: 백테스트 지표 점수 기준 정렬, TOP 5
  const rankedPosts = useMemo(() => {
    if (subTab !== 'indicator') return posts;
    return [...posts]
      .map(p => ({ ...p, _score: calcIndicatorScore(p.backtest) }))
      .sort((a, b) => (b._score ?? -1) - (a._score ?? -1))
      .slice(0, 5);
  }, [posts, subTab]);

  // 자유게시판: 검색 및 페이지네이션
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const POSTS_PER_PAGE = 5;

  const filteredPosts = useMemo(() => {
    if (subTab !== 'board') return [];
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(p => p.title.toLowerCase().includes(q));
  }, [posts, subTab, searchQuery]);

  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredPosts.slice(start, start + POSTS_PER_PAGE);
  }, [filteredPosts, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, subTab]);

  return (
    <div className="space-y-5">
      {/* 서브 탭 */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
        <button onClick={() => onSubTabChange('indicator')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${subTab === 'indicator' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
          <Trophy size={16} />지표 랭킹
        </button>
        <button onClick={() => onSubTabChange('board')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${subTab === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
          <MessageSquare size={16} />자유게시판
        </button>
      </div>

      {/* 헤더 및 TOP 5 랭킹 패널 */}
      {subTab === 'board' ? (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare size={20} className="text-indigo-500" />
            <h3 className="text-lg font-black text-slate-900">자유게시판</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            코인·주식 시장에 대한 자유로운 의견을 나눠보세요. 투자 조언이 아닌 참고용 정보입니다.
          </p>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-[2.5rem] border border-amber-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy size={20} className="text-amber-500" />
              <h3 className="text-lg font-black text-amber-900">지표 랭킹 TOP 5</h3>
            </div>
            <button onClick={() => fetchPosts('indicator')} className="text-[10px] font-bold text-amber-600 hover:text-amber-800 transition-colors flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-full">
              <RefreshCcw size={10} />새로고침
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {isLoading && posts.length === 0 ? (
              <div className="py-4 text-center text-xs font-bold text-slate-400">불러오는 중...</div>
            ) : rankedPosts.length > 0 ? (
              rankedPosts.map((p, i) => <IndicatorRankCard key={p.postId} post={p} rank={i + 1} isLoggedIn={isLoggedIn} />)
            ) : (
              <div className="py-4 text-center text-xs font-bold text-slate-400">랭킹 데이터가 없습니다.</div>
            )}
          </div>
        </div>
      )}

      {/* 작성 영역 (자유게시판) */}
      {subTab === 'board' && (
        isLoggedIn ? <FreeWriteForm userInfo={userInfo} onSubmit={handleCreatePost} /> : <LoginPrompt />
      )}

      {/* 글 목록 (자유게시판) */}
      {subTab === 'board' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Latest Posts
            </span>
            <button onClick={() => { fetchPosts('board'); setSearchQuery(''); setCurrentPage(1); }}
              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors flex items-center gap-1">
              <RefreshCcw size={10} />새로고침
            </button>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="제목으로 글 검색..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm font-medium outline-none focus:border-indigo-400 transition-all"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCcw className="animate-spin text-indigo-500" size={24} />
              <span className="ml-2 text-sm font-bold text-slate-400">불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-red-600">데이터 로딩 실패</p>
                <p className="text-xs font-medium text-red-500 mt-1">{error}</p>
              </div>
            </div>
          ) : filteredPosts.length === 0 ? (
            <EmptyState text={searchQuery ? "검색 결과가 없습니다." : "아직 작성된 글이 없습니다."} />
          ) : (
            <>
              <div className="space-y-3">
                {paginatedPosts.map(p => (
                  <FreePostCard 
                    key={p.postId} 
                    post={p} 
                    userInfo={userInfo}
                    onUpdate={handleUpdatePost}
                    onDelete={handleDeletePost}
                    onIncrementViews={incrementViews}
                    commentActions={commentActions}
                  />
                ))}
              </div>
              
              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-1.5 pt-4">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                  >
                    이전
                  </button>
                  
                  {/* 페이지 번호 목록 */}
                  <div className="flex items-center gap-1 mx-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-black transition-all flex items-center justify-center ${currentPage === pageNum ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 작성 영역 (지표 공유) - 맨 아래에 배치 */}
      {subTab === 'indicator' && (
        <div className="mt-8 space-y-3">
          <div className="flex items-center px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Share Your Indicator
            </span>
          </div>
          {isLoggedIn ? <IndicatorShareForm userInfo={userInfo} onSubmit={handleCreatePost} /> : <LoginPrompt />}
        </div>
      )}
    </div>
  );
}
