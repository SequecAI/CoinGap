import { useState, useCallback } from 'react';

const API_BASE = 'https://oo78pteio2.execute-api.ap-northeast-2.amazonaws.com';

export function useCommunity() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPosts = useCallback(async (type = 'indicator') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/posts?type=${type}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err) {
      console.error('[useCommunity] fetchPosts 실패:', err);
      setError(err.message);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPost = useCallback(async (postData) => {
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'create', ...postData }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[useCommunity] createPost 실패:', err);
      throw err;
    }
  }, []);

  const updatePost = useCallback(async (postData) => {
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'update', ...postData }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[useCommunity] updatePost 실패:', err);
      throw err;
    }
  }, []);

  const deletePost = useCallback(async (pk, sk, postId) => {
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'delete', PK: pk, SK: sk, postId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[useCommunity] deletePost 실패:', err);
      throw err;
    }
  }, []);

  const fetchComments = useCallback(async (postId) => {
    try {
      const res = await fetch(`${API_BASE}/posts?type=comments&postId=${postId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.comments || [];
    } catch (err) {
      console.error('[useCommunity] fetchComments 실패:', err);
      return [];
    }
  }, []);

  const createComment = useCallback(async (commentData) => {
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'create_comment', ...commentData }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[useCommunity] createComment 실패:', err);
      throw err;
    }
  }, []);

  const updateComment = useCallback(async (pk, sk, content) => {
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'update_comment', PK: pk, SK: sk, content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[useCommunity] updateComment 실패:', err);
      throw err;
    }
  }, []);

  const deleteComment = useCallback(async (pk, sk) => {
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'delete_comment', PK: pk, SK: sk }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[useCommunity] deleteComment 실패:', err);
      throw err;
    }
  }, []);

  const incrementViews = useCallback(async (pk, sk) => {
    try {
      fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'increment_views', PK: pk, SK: sk }),
      }).catch(err => console.error('[useCommunity] incrementViews background error:', err));
    } catch (err) {
      // ignore
    }
  }, []);

  return {
    posts, isLoading, error,
    fetchPosts, createPost, updatePost, deletePost, incrementViews,
    fetchComments, createComment, updateComment, deleteComment
  };
}
