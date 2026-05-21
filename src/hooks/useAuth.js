import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'https://oo78pteio2.execute-api.ap-northeast-2.amazonaws.com';
const STORAGE_KEY = 'coinGap_auth';

export function useAuth() {
  const [userInfo, setUserInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const isLoggedIn = !!userInfo;

  // localStorage 동기화
  useEffect(() => {
    if (userInfo) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [userInfo]);

  // Google 로그인 성공 콜백 (credential JWT 디코드)
  const handleLoginSuccess = useCallback(async (credentialResponse) => {
    try {
      // JWT payload를 유니코드 안전하게 디코딩
      const token = credentialResponse.credential;
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes));

      const baseNickname = payload.name || payload.email.split('@')[0];
      let nickname = baseNickname;
      if (payload.email !== 'adminsequenceai@gmail.com') {
        const uniqueCode = payload.sub.slice(-4);
        nickname = `${baseNickname}#${uniqueCode}`;
      } else {
        nickname = '관리자';
      }

      const info = {
        userId: payload.sub,
        email: payload.email,
        nickname: nickname,
        profileImage: payload.picture || '',
        action: 'login'
      };

      setUserInfo(info);

      // 백엔드에 유저 정보 전송 (비동기, 실패해도 로그인은 유지)
      fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(info),
      })
      .then(res => res.json())
      .then(data => {
        // 백엔드에 저장된 모든 유저 정보(닉네임, 저장된 지표 등)를 로컬 상태에 동기화
        setUserInfo(prev => {
          if (!prev) return null;
          return { ...prev, ...data };
        });
      })
      .catch((err) => console.warn('[useAuth] 유저 동기화 실패:', err));

    } catch (err) {
      console.error('[useAuth] 로그인 처리 실패:', err);
    }
  }, []);

  const logout = useCallback(() => {
    setUserInfo(null);
  }, []);

  const clearNewUserFlag = useCallback(() => {
    setUserInfo(prev => (prev ? { ...prev, isNewUser: false } : null));
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!userInfo) return false;
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'delete', userId: userInfo.userId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUserInfo(null);
      return true;
    } catch (err) {
      console.error('[useAuth] 계정 삭제 실패:', err);
      return false;
    }
  }, [userInfo]);

  const updateNickname = useCallback((newNickname) => {
    if (!userInfo) return;
    let finalNickname = newNickname.trim();
    if (userInfo.email !== 'adminsequenceai@gmail.com') {
      const uniqueCode = userInfo.userId.slice(-4);
      const baseName = finalNickname.split('#')[0];
      finalNickname = `${baseName}#${uniqueCode}`;
    } else {
      finalNickname = '관리자';
    }
    const updated = { ...userInfo, nickname: finalNickname, action: 'update_nickname' };
    setUserInfo(updated);
    fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(updated),
    }).catch(err => console.warn('[useAuth] 닉네임 업데이트 실패:', err));
  }, [userInfo]);

  return { isLoggedIn, userInfo, handleLoginSuccess, logout, updateNickname, deleteAccount, clearNewUserFlag };
}
