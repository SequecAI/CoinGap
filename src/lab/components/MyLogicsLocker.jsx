import React from 'react';
import { Save, FolderOpen, Trash2, LogIn, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * 내 로직 보관함 카드.
 *
 * - 비로그인: 안내만 표시 (Lab에서 직접 로그인 UI를 띄우지 않고 coingap 메인으로 유도).
 * - 로그인: 저장 버튼 + 보관함 목록 + 슬롯 가득 모달.
 *
 * props:
 *   isLoggedIn, userInfo
 *   logics, limit, loading, error
 *   onSaveCurrent()  - 현재 빌더 상태를 저장
 *   onLoad(logic)    - 로직을 빌더에 로드
 *   onDelete(logicId)
 *   slotFull, onDismissSlotFull, onDeleteAndRetry(logicId) - 슬롯 가득 모달
 */
export default function MyLogicsLocker({
  isLoggedIn,
  userInfo,
  logics = [],
  limit = 3,
  loading = false,
  error = null,
  onSaveCurrent,
  onLoad,
  onDelete,
  slotFull,
  onDismissSlotFull,
  onDeleteAndRetry,
}) {
  if (!isLoggedIn) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-violet-50 text-violet-600 rounded-xl shrink-0">
            <FolderOpen size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-black text-slate-800">내 로직 보관함</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
              로그인하면 내가 만든 로직을 계정에 저장할 수 있어요. <br className="hidden sm:inline" />
              빌더와 백테스트는 로그인 없이도 자유롭게 사용 가능합니다.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold transition-colors"
            >
              <LogIn size={14} />
              coingap 메인에서 로그인
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const count = logics.length;
  const slotFullNow = count >= limit;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 bg-violet-50 text-violet-600 rounded-xl shrink-0">
            <FolderOpen size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-800">내 로직 보관함</h2>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">
              {userInfo?.nickname || '사용자'} · {count} / {limit} 슬롯
            </p>
          </div>
        </div>
        <button
          onClick={onSaveCurrent}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-xs font-bold transition-colors shrink-0"
        >
          <Save size={14} />
          현재 상태 저장
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}

      {loading && logics.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 size={18} className="animate-spin mr-2" />
          <span className="text-xs font-bold">불러오는 중…</span>
        </div>
      ) : logics.length === 0 ? (
        <p className="text-xs text-slate-400 font-medium text-center py-6">
          아직 저장된 로직이 없습니다. 빌더에서 만든 후 "현재 상태 저장"을 눌러보세요.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {logics.map((l) => (
            <LogicCard
              key={l.logicId}
              logic={l}
              onLoad={() => onLoad?.(l)}
              onDelete={() => onDelete?.(l.logicId)}
            />
          ))}
          {/* 빈 슬롯 시각화 */}
          {Array.from({ length: Math.max(0, limit - logics.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-[11px] font-bold text-slate-300"
            >
              빈 슬롯
            </div>
          ))}
        </div>
      )}

      {slotFullNow && !slotFull && (
        <p className="text-[11px] text-amber-600 font-medium leading-relaxed border-t border-slate-100 pt-3">
          ※ 슬롯이 모두 차있습니다. 새 이름으로 저장하려면 기존 로직 중 하나를 먼저 삭제해주세요.
        </p>
      )}

      {slotFull && (
        <SlotFullModal
          slotFull={slotFull}
          onDismiss={onDismissSlotFull}
          onDeleteAndRetry={onDeleteAndRetry}
        />
      )}
    </div>
  );
}

function LogicCard({ logic, onLoad, onDelete }) {
  const symbol = logic.symbol || '—';
  const savedAt = (logic.updatedAt || logic.savedAt || '').slice(0, 10);
  // 저장 시 함께 보관된 백테스트 스냅샷이 있으면 기간·승률·수익률·MDD를 함께 표시.
  const bt = logic.backtest;
  const btDays = logic.days;
  const winRate = bt?.win_rate_pct;
  const ret = bt?.total_return_pct;
  const mdd = bt?.mdd_pct;
  const retPositive = typeof ret === 'number' && ret >= 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-800 truncate">{logic.name || '이름 없음'}</p>
        <p className="text-[11px] text-slate-500 font-medium tabular-nums">
          {symbol} · {savedAt}
        </p>
        {bt && (btDays != null || winRate != null) && (
          <p className="text-[11px] font-bold tabular-nums mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {btDays != null && <span className="text-slate-600">{btDays}일</span>}
            {winRate != null && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-600">승률 {winRate}%</span>
              </>
            )}
            {ret != null && (
              <>
                <span className="text-slate-300">·</span>
                <span className={retPositive ? 'text-emerald-600' : 'text-rose-600'}>
                  {retPositive ? '+' : ''}{ret}%
                </span>
              </>
            )}
            {mdd != null && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-rose-600">MDD {mdd}%</span>
              </>
            )}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onLoad}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white hover:bg-violet-50 border border-slate-200 hover:border-violet-200 text-slate-700 hover:text-violet-700 text-[11px] font-bold transition-colors"
        >
          <FolderOpen size={12} />
          불러오기
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 text-[11px] font-bold transition-colors"
          title="삭제"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function SlotFullModal({ slotFull, onDismiss, onDeleteAndRetry }) {
  const { attemptedName, existing, limit, currentCount } = slotFull;
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onDismiss}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">슬롯이 가득 찼습니다</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {currentCount} / {limit} 사용 중
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 p-1"
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-600 font-medium leading-relaxed">
          새 로직 "<span className="font-black text-slate-800">{attemptedName || '(이름 없음)'}</span>"을
          저장하려면 기존 로직 중 하나를 삭제해야 합니다. 어떤 로직을 지울까요?
        </p>

        <div className="space-y-2">
          {existing.map((l) => (
            <div
              key={l.logicId}
              className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50"
            >
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800 truncate">{l.name || '이름 없음'}</p>
                <p className="text-[10px] text-slate-500 font-medium">{l.symbol || '—'}</p>
              </div>
              <button
                onClick={() => onDeleteAndRetry?.(l.logicId)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors shrink-0"
              >
                <Trash2 size={12} />
                삭제하고 저장
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}
