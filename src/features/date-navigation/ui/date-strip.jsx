'use client';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateChip, dayRange } from '@/shared/lib/date';
import { shiftISO } from '@/shared/lib/schedule-utils.mjs';

export function DateStrip({selected, today, onSelect}) {
  const dates = dayRange(shiftISO(selected,-1),5);
  return <section className="date-nav" aria-label="Выбор дня">
    <button className="date-arrow" type="button" title="Предыдущий день" aria-label="Предыдущий день" onClick={()=>onSelect(shiftISO(selected,-1))}><ChevronLeft size={21}/></button>
    <div className="dates" role="group" aria-label="Даты">
      {dates.map(iso=>{
        const {weekday,day,month}=dateChip(iso);
        return <button type="button" key={iso} className={'date-chip '+(selected===iso?'chosen ':'')+(iso===today?'today':'')} aria-pressed={selected===iso} aria-label={`${weekday}, ${day} ${month}`} onClick={()=>onSelect(iso)}>
          <span className="date-weekday">{weekday}</span>
          <span className="date-number">{day}</span>
          <span className="date-month">{month}</span>
        </button>;
      })}
    </div>
    <button className="date-arrow" type="button" title="Следующий день" aria-label="Следующий день" onClick={()=>onSelect(shiftISO(selected,1))}><ChevronRight size={21}/></button>
    <label className="calendar-button" title="Выбрать дату">
      <CalendarDays aria-hidden="true" size={21}/>
      <input type="date" aria-label="Выбрать дату в календаре" value={selected} onChange={event=>event.target.value&&onSelect(event.target.value)}/>
    </label>
  </section>;
}
