'use client';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ theme, onToggle }) {
  return <button type="button" className="icon-button" onClick={onToggle}
    aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
    title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
    {theme === 'dark' ? <Sun aria-hidden="true" size={21}/> : <Moon aria-hidden="true" size={21}/>} 
  </button>;
}
