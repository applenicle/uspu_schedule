'use client';
import { useEffect, useState } from 'react';

const KEY = 'uspu:favorites:v1';
export function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  useEffect(() => {
    try { setFavorites(JSON.parse(localStorage.getItem(KEY)) || []); } catch { setFavorites([]); }
  }, []);
  function toggle(item) {
    setFavorites(prev => {
      const exists = prev.some(x=>x.id===item.id&&x.kind===item.kind);
      const next = exists ? prev.filter(x=>x.id!==item.id||x.kind!==item.kind) : [...prev,item];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  const isFavorite = item => favorites.some(x=>x.kind===item?.kind && x.id===item?.id);
  return { favorites, toggle, isFavorite };
}
