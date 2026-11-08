'use client';
import { useEffect, useState } from 'react';
import { resolveTheme, sanitizeThemePreference, THEME_KEY } from '@/shared/lib/theme.mjs';

export function useDeviceTheme() {
  const [preference, setPreference] = useState('auto');
  const [deviceTheme, setDeviceTheme] = useState('light');

  useEffect(() => {
    try { setPreference(sanitizeThemePreference(localStorage.getItem(THEME_KEY))); } catch {}
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    let telegram = null;
    const update = () => {
      const tg = window.Telegram?.WebApp;
      telegram = tg || telegram;
      const inTelegram=Boolean(tg?.initData || /tgWebAppVersion/i.test(window.location.hash+window.location.search));
      const fromTelegram = inTelegram ? tg?.colorScheme : null;
      setDeviceTheme(fromTelegram === 'dark' || fromTelegram === 'light'
        ? fromTelegram : (media?.matches ? 'dark' : 'light'));
    };
    const handleTelegramLoad = () => {
      const tg = window.Telegram?.WebApp;
      if (tg && tg !== telegram) {
        telegram?.offEvent?.('themeChanged', update);
        telegram = tg;
        telegram.onEvent?.('themeChanged', update);
      }
      update();
    };
    media?.addEventListener?.('change', update);
    window.addEventListener('uspu:telegram-ready', handleTelegramLoad);
    handleTelegramLoad();
    return () => {
      media?.removeEventListener?.('change', update);
      window.removeEventListener('uspu:telegram-ready', handleTelegramLoad);
      telegram?.offEvent?.('themeChanged', update);
    };
  }, []);

  const theme = resolveTheme(preference, deviceTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const selectPreference = value => {
    const next = sanitizeThemePreference(value);
    setPreference(next);
    try {localStorage.setItem(THEME_KEY, next);} catch {}
  };

  return { theme, preference, selectPreference };
}
