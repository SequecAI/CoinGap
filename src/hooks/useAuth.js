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
        // 백엔드에 커스텀 닉네임이 저장되어 있다면 로컬 상태를 덮어씀
        if (data.nickname && data.nickname !== info.nickname) {
          setUserInfo(prev => prev ? { ...prev, nickname: data.nickname } : prev);
        }
      })
      .catch((err) => console.warn('[useAuth] 유저 동기화 실패:', err));

    } catch (err) {
      console.error('[useAuth] 로그인 처리 실패:', err);
    }
  }, []);

  const logout = useCallback(() => {
    setUserInfo(null);
  }, []);

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

  return { isLoggedIn, userInfo, handleLoginSuccess, logout, updateNickname };
}
