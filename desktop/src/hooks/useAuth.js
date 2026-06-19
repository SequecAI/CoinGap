import { useCallback, useEffect, useState } from 'react';

/**
 * PC 앱 전용 useAuth.
 * - 세션은 메인 프로세스의 userData/auth.json에 저장. (prod file:// 환경에서도 영구 유지)
 * - 마운트 시 IPC로 한 번 load → state 채움. 그 사이 isReady=false라 로그인 화면 깜빡임 방지.
 * - 로그인 결과/로그아웃은 즉시 메인에 save/clear.
 *
 * 다음 단계 메모:
 *   · C7에서 백엔드 호출 시 idToken을 Authorization 헤더로 전달, Lambda가 검증.
 *   · 만료(1시간) 후엔 refreshToken으로 갱신 (별도 IPC 채널 추가 예정).
 */
export function useAuth() {
  const [state, setState] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 마운트 시 한 번 디스크에서 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.coingap?.auth?.load) {
        if (!cancelled) setIsReady(true);
        return;
      }
      try {
        const data = await window.coingap.auth.load();
        if (!cancelled) setState(data || null);
      } catch (e) {
        console.warn('[useAuth] load failed:', e?.message);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async () => {
    if (!window.coingap?.auth?.start) {
      setError('Electron 환경이 아닙니다.');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await window.coingap.auth.start();
      setState(result);
      try { await window.coingap.auth.save(result); } catch {}
      return result;
    } catch (e) {
      setError(e?.message || String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setState(null);
    setError(null);
    try { await window.coingap.auth.clear(); } catch {}
  }, []);

  return {
    isReady,                       // false면 아직 disk에서 로드 중
    isLoggedIn: !!state?.userInfo,
    userInfo: state?.userInfo || null,
    idToken: state?.idToken || null,
    loading,
    error,
    login,
    logout,
  };
}
