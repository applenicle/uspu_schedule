'use client';
import { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import { CalendarDays, Search, Bookmark, AlertCircle } from 'lucide-react';
import { AppHeader } from '@/widgets/app-header/ui/app-header';
import { ScheduleView } from '@/widgets/schedule-view/ui/schedule-view';
import { TeacherSheet } from '@/widgets/teacher-sheet/ui/teacher-sheet';
import { CatalogSearch } from '@/features/catalog-search/ui/catalog-search';
import { DateStrip } from '@/features/date-navigation/ui/date-strip';
import { useFavorites } from '@/features/favorites/model/use-favorites';
import { demoCatalog, demoLessons } from '@/shared/lib/demo-data.mjs';
import { nearestTeachingDay } from '@/shared/lib/schedule-utils.mjs';
import { normalizeGroup } from '@/shared/lib/schedule-utils.mjs';
import { todayYekaterinburg } from '@/shared/lib/date';
import { getSchedule, requestSchedule } from '@/entities/schedule/api/schedule-api';
import { queryCatalog } from '@/entities/catalog/api/catalog-api';
import { teacherSurname, uniqueTeacherMatch } from '@/shared/lib/teacher.mjs';
import { useDeviceTheme } from '@/features/theme-switch/model/use-device-theme';

export function SchedulePage() {
  const [demo,setDemo]=useState(false);
  const { theme, preference, selectPreference } = useDeviceTheme();
  const [kind,setKind]=useState('group');
  const [searchKind,setSearchKind]=useState('group');
  const [searchTerm,setSearchTerm]=useState('');
  const [selected,setSelected]=useState(null);
  const [today,setToday]=useState('2026-11-08');
  const [day,setDay]=useState('2026-11-08');
  const [lessons,setLessons]=useState([]);
  const [loading,setLoading]=useState(false);
  const [pending,setPending]=useState(false);
  const [sourceUpdated,setSourceUpdated]=useState('');
  const [error,setError]=useState('');
  const [dialog,setDialog]=useState(null);
  const [teacher,setTeacher]=useState('');
  const {favorites,toggle,isFavorite}=useFavorites();

  useEffect(()=>{
    const url=new URL(location.href);
    const inDemo=url.searchParams.get('demo')==='1';
    setDemo(inDemo);
    const date=todayYekaterinburg();setToday(date);setDay(date);
    if(inDemo) setSelected(demoCatalog.find(x=>x.kind==='group'&&x.id==='ДГ-304'));
    else {
      try {
        const saved=JSON.parse(localStorage.getItem('uspu:selected'));
        if(saved?.id&&saved?.kind){setSelected(saved);setKind(saved.kind);}
      } catch {}
    }
  },[]);

  const load = useCallback(async (signal)=>{
    if(!selected) {setLessons([]);return;}
    setLoading(true);setError('');setPending(false);
    if(demo){
      const items=demoLessons(today, selected.kind, selected.id);
      setLessons(items);
      setDay(prev=>prev===today?nearestTeachingDay(items,today):prev);
      setSourceUpdated('');setLoading(false);
      return;
    }
    try {
      const data=await getSchedule(selected.kind,selected.id,signal);
      if(signal?.aborted)return;
      const list=data.lessons||[];
      setLessons(list);setPending(Boolean(data.pending||data.partial));setSourceUpdated(data.source_updated||'');
      if(data.pending&&selected.kind!=='room') requestSchedule(selected.kind,selected.id).catch(()=>{});
      if(list.length) setDay(prev=>prev===today?nearestTeachingDay(list,today):prev);
    }catch(err){if(!signal?.aborted) {setError(err.message);setLessons([]);}}
    finally{if(!signal?.aborted)setLoading(false);}
  },[selected,demo,today]);
  useEffect(()=>{const controller=new AbortController();load(controller.signal);return()=>controller.abort();},[load]);
  useEffect(()=>{
    if(!selected||demo) return;
    try {localStorage.setItem('uspu:selected',JSON.stringify(selected));}catch{}
  },[selected,demo]);
  function choose(item) {setKind(item.kind);setSearchKind(item.kind);setSelected(item);setDialog(null);setTeacher('');setSearchTerm('');setDay(today);}
  function selectKind(value) {
    setSearchKind(value);setSearchTerm('');setDialog('search');setTeacher('');
  }
  async function resolveAndChoose(nextKind,label){
    setError('');
    const isTeacher=nextKind==='teacher';
    const fallback = isTeacher ? teacherSurname(label) : label;
    try {
      // Teachers in group responses can be abbreviated ("Иванова А. С.").
      // Search by surname, then match initials without guessing ambiguous identities.
      const items=demo?demoCatalog.filter(i=>i.kind===nextKind):await queryCatalog(nextKind,fallback);
      const clean=nextKind==='group'?normalizeGroup(label):label.toLocaleLowerCase('ru').replace(/ё/g,'е');
      const match=isTeacher ? uniqueTeacherMatch(label,items)
        : items.find(item=>nextKind==='group'?normalizeGroup(item.label)===clean:item.label.toLocaleLowerCase('ru').replace(/ё/g,'е')===clean);
      if (match) choose({...match,kind:nextKind});
      else {
        setTeacher('');setSearchKind(nextKind);setSearchTerm(fallback);setDialog('search');
        setError('Выберите нужного преподавателя или расписание из списка.');
      }
    }catch{
      setTeacher('');setSearchKind(nextKind);setSearchTerm(fallback);setDialog('search');
      setError('Справочник временно недоступен');
    }
  }
  const onTeacher = name => {if(name)setTeacher(name);};
  const isMarked=selected&&isFavorite(selected);
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Перейти к расписанию</a>
    <div className="app-container">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={()=>window.dispatchEvent(new Event('uspu:telegram-ready'))}/>
      <AppHeader kind={kind} selected={selected} theme={theme} preference={preference} isFavorite={Boolean(isMarked)} onKind={selectKind}
        onTheme={selectPreference}
        onFavorite={()=>selected&&toggle(selected)} onChangeSelection={()=>{setSearchKind(kind);setSearchTerm('');setDialog('search');}} onSearch={()=>{setSearchKind(kind);setSearchTerm('');setDialog('search');}} onFavorites={()=>{setSearchKind(kind);setDialog('favorites');}}/>
      {demo&&<div className="demo-indicator"><AlertCircle size={15}/> Демонстрационные данные, не реальное расписание</div>}
      {selected ? <>
        <DateStrip selected={day} today={today} onSelect={setDay}/>
        {error&&<div className="error-banner" role="alert">{error}</div>}
        <ScheduleView lessons={lessons} selected={day} mode={kind} onTeacher={onTeacher}
          onGroup={group=>group&&resolveAndChoose('group',group)}
          onRoom={room=>room&&resolveAndChoose('room',room)} onDay={setDay}
          loading={loading} pending={pending} sourceUpdated={sourceUpdated}/>
      </>:<section className="welcome-view">
        <CalendarDays size={38} aria-hidden="true"/>
        <h2>Расписание без лишних действий</h2>
        <p>Найдите свою группу, преподавателя или аудиторию и сохраните их в избранном.</p>
        {error&&<p role="alert" className="error-banner">{error}</p>}
        <button className="primary-action" onClick={()=>{setSearchKind(kind);setDialog('search');}}>Найти расписание <Search size={19}/></button>
      </section>}

    </div>
    {dialog&&<CatalogSearch key={`${searchKind}-${dialog}`} kind={searchKind} demo={demo} initialTab={dialog} initialQuery={searchTerm} favorites={favorites} onClose={()=>setDialog(null)} onSelect={choose}/>} 
    {teacher&&<TeacherSheet teacher={teacher} lessons={lessons} onClose={()=>setTeacher('')} onOpen={()=>resolveAndChoose('teacher',teacher)}/>} 
  </div>;
}
