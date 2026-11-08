'use client';
import { BookOpen, Bookmark, Search, Star, ChevronDown } from 'lucide-react';
import { ThemeToggle } from '@/features/theme-switch/ui/theme-toggle';

const VIEWS = [ ['group','Группа'], ['teacher','Преподаватель'], ['room','Аудитория'] ];

export function AppHeader({ kind, selected, theme, preference, isFavorite, onKind, onSearch, onTheme, onFavorite, onFavorites, onChangeSelection }) {
  return <header className="app-header">
    <div className="brand-row">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><BookOpen size={22} strokeWidth={2.3}/></span>
        <span className="brand-name">Расписание УрГПУ</span>
      </div>
      <div className="header-actions">
        <button className="icon-button" title="Поиск" aria-label="Открыть поиск" onClick={onSearch}><Search size={21}/></button>
        <button className="icon-button" title="Избранное" aria-label="Открыть избранное" onClick={onFavorites}><Bookmark size={21}/></button>
        <ThemeToggle theme={theme} preference={preference} onSelect={onTheme}/>
      </div>
    </div>
    <div className="subject-row">
      <div className="subject-details">
        <span className="eyebrow">{kind==='group'?'РАСПИСАНИЕ ГРУППЫ':kind==='teacher'?'РАСПИСАНИЕ ПРЕПОДАВАТЕЛЯ':'ЗАНЯТОСТЬ АУДИТОРИИ'}</span>
        <div className="entity-selection">
          <h1>{selected?.label || 'Выберите расписание'}</h1>
          <button type="button" className="change-entity" onClick={onChangeSelection} aria-label="Сменить расписание">
            Сменить <ChevronDown size={17} aria-hidden="true"/>
          </button>
        </div>
      </div>
      <button className={'icon-button favorite-button '+(isFavorite?'is-favorite':'')} onClick={onFavorite} aria-label={isFavorite?'Убрать из избранного':'Добавить в избранное'} aria-pressed={isFavorite} disabled={!selected}>
        <Star size={22} fill={isFavorite?'currentColor':'none'}/>
      </button>
    </div>
    <nav className="entity-tabs" aria-label="Тип расписания">
      {VIEWS.map(([value,label])=><button key={value} type="button" className={kind===value?'active':''} aria-current={kind===value?'page':undefined} onClick={()=>onKind(value)}>{label}</button>)}
    </nav>
  </header>;
}
