'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { dateChip, dayRange } from '@/shared/lib/date';
import { shiftISO } from '@/shared/lib/schedule-utils.mjs';

const WEEKDAYS=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const dateUTC=iso=>new Date(`${iso}T12:00:00Z`);
function monthLabel(month) {
  const [year,number]=month.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'})
    .format(new Date(Date.UTC(year,number-1,15)));
}
function moveMonth(month,delta) {
  const [year,number]=month.split('-').map(Number);
  const d=new Date(Date.UTC(year,number-1+delta,1));
  return d.toISOString().slice(0,7);
}
function monthCells(month) {
  const [year,number]=month.split('-').map(Number);
  const first=new Date(Date.UTC(year,number-1,1));
  const offset=(first.getUTCDay()+6)%7;
  const count=new Date(Date.UTC(year,number,0)).getUTCDate();
  return Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{
    const day=i-offset+1;
    return day>=1&&day<=count?`${month}-${String(day).padStart(2,'0')}`:null;
  });
}
export function DateStrip({selected,today,onSelect}) {
  const [open,setOpen]=useState(false);
  const [month,setMonth]=useState(selected.slice(0,7));
  const root=useRef(null);
  useEffect(()=>setMonth(selected.slice(0,7)),[selected]);
  useEffect(()=>{
    if(!open)return;
    const onPointer=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    const onKey=e=>{if(e.key==='Escape')setOpen(false);};
    document.addEventListener('pointerdown',onPointer);
    document.addEventListener('keydown',onKey);
    return ()=>{document.removeEventListener('pointerdown',onPointer);document.removeEventListener('keydown',onKey);};
  },[open]);
  const dates=dayRange(shiftISO(selected,-1),5);
  function choose(iso){onSelect(iso);setOpen(false);}
  return <section className="date-nav" aria-label="Выбор дня">
    <button className="date-arrow" type="button" title="Предыдущий день" aria-label="Предыдущий день" onClick={()=>onSelect(shiftISO(selected,-1))}><ChevronLeft size={21}/></button>
    <div className="dates" role="group" aria-label="Даты">
      {dates.map(iso=>{
        const {weekday,day,month}=dateChip(iso);
        return <button type="button" key={iso} className={'date-chip '+(selected===iso?'chosen ':'')+(iso===today?'today':'')} aria-pressed={selected===iso} aria-label={`${weekday}, ${day} ${month}`} onClick={()=>onSelect(iso)}>
          <span className="date-weekday">{weekday}</span><span className="date-number">{day}</span><span className="date-month">{month}</span>
        </button>;
      })}
    </div>
    <button className="date-arrow" type="button" title="Следующий день" aria-label="Следующий день" onClick={()=>onSelect(shiftISO(selected,1))}><ChevronRight size={21}/></button>
    <div className="calendar-control" ref={root}>
      <button type="button" className="calendar-button" aria-label="Открыть календарь" aria-expanded={open} aria-controls="uspu-calendar" onClick={()=>setOpen(s=>!s)}><CalendarDays aria-hidden="true" size={21}/></button>
      {open&&<div className="calendar-popover" id="uspu-calendar" role="group" aria-label="Календарь выбора дня">
        <div className="calendar-heading">
          <button type="button" className="calendar-control-button" aria-label="Предыдущий месяц" onClick={()=>setMonth(x=>moveMonth(x,-1))}><ChevronLeft size={20}/></button>
          <span>{monthLabel(month)}</span>
          <button type="button" className="calendar-control-button" aria-label="Следующий месяц" onClick={()=>setMonth(x=>moveMonth(x,1))}><ChevronRight size={20}/></button>
          <button type="button" className="calendar-control-button" aria-label="Закрыть календарь" onClick={()=>setOpen(false)}><X size={19}/></button>
        </div>
        <div className="calendar-grid" role="group" aria-label={monthLabel(month)}>
          {WEEKDAYS.map(day=><span key={day} className="calendar-weekday">{day}</span>)}
          {monthCells(month).map((iso,i)=>iso?<button type="button" key={iso} className={'calendar-day'+(iso===selected?' selected':'')+(iso===today?' today':'')} aria-label={new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(dateUTC(iso))} aria-pressed={iso===selected} onClick={()=>choose(iso)}>{Number(iso.slice(-2))}</button>:<span key={'empty'+i} aria-hidden="true"/>)}
        </div>
        <button className="calendar-today" type="button" onClick={()=>choose(today)}>Сегодня</button>
      </div>}
    </div>
  </section>;
}
