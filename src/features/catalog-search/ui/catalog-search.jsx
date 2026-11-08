'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, X, ArrowRight, Bookmark } from 'lucide-react';
import { queryCatalog } from '@/entities/catalog/api/catalog-api';
import { normalizeGroup } from '@/shared/lib/schedule-utils.mjs';
import { normalizeTeacherName } from '@/shared/lib/schedule-utils.mjs';
import { demoCatalog } from '@/shared/lib/demo-data.mjs';

const NAMES={group:'группу',teacher:'преподавателя',room:'аудиторию'};
export function CatalogSearch({kind, demo, favorites, onSelect, onClose, initialTab='search'}) {
  const [tab,setTab] = useState(initialTab);
  const [query,setQuery] = useState('');
  const [items,setItems] = useState([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const inputRef = useRef(null);
  useEffect(()=>{ if(tab==='search') inputRef.current?.focus(); },[tab]);
  useEffect(()=>{
    if(tab!=='search') return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setLoading(true);setError('');
      try {
        if (demo) {
          const matches=demoCatalog.filter(x=>x.kind===kind).filter(item=>kind==='group'
            ? normalizeGroup(item.label).includes(normalizeGroup(query))
            : normalizeTeacherName(item.label).includes(normalizeTeacherName(query)));
          setItems(matches);
        } else {
          setItems((await queryCatalog(kind,query,controller.signal)).map(item=>({...item,kind})));
        }
      } catch (err) {if(!controller.signal.aborted) {setItems([]);setError(err.message);} }
      finally {if(!controller.signal.aborted)setLoading(false);}
    },230);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[kind,query,tab,demo]);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <section className="search-modal" role="dialog" aria-modal="true" aria-label="Поиск расписания">
      <div className="modal-head">
        <h2>{tab==='favorites'?'Избранное':`Выберите ${NAMES[kind]}`}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Закрыть"><X size={22}/></button>
      </div>
      <div className="search-mode"><button className={tab==='search'?'active':''} onClick={()=>setTab('search')}><Search size={17}/>Поиск</button><button className={tab==='favorites'?'active':''} onClick={()=>setTab('favorites')}><Bookmark size={17}/>Избранное</button></div>
      {tab==='search'?<>
        <label className="search-field"><Search size={21} aria-hidden="true"/><input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} aria-label={`Найти ${NAMES[kind]}`} placeholder={kind==='group'?'Например, ДГ-304':kind==='teacher'?'Фамилия преподавателя':'Номер или корпус'}/>{query&&<button onClick={()=>setQuery('')} aria-label="Очистить поиск"><X size={18}/></button>}</label>
        <p className="search-hint" role="status">{loading?'Идёт поиск…':error || `${items.length} ${items.length===1?'результат':'результатов'}`}</p>
        <div className="results-list">{items.map(item=><button className="result" key={`${item.kind}:${item.id}`} onClick={()=>onSelect(item)}><span>{item.label}</span><ArrowRight size={18}/></button>)}
        {!items.length&&!loading&&!error&&<div className="empty-small">Ничего не найдено</div>}</div>
      </>:<div className="results-list">{favorites.length?favorites.map(item=><button className="result" key={`${item.kind}:${item.id}`} onClick={()=>onSelect(item)}><span>{item.label}<small>{item.kind==='group'?'Группа':item.kind==='teacher'?'Преподаватель':'Аудитория'}</small></span><ArrowRight size={18}/></button>):<div className="empty-small">Здесь появятся сохранённые группы и преподаватели</div>}</div>}
    </section>
  </div>;
}
