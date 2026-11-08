'use client';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { LessonCard } from '@/entities/lesson/ui/lesson-card';
import { lessonsToCards } from '@/entities/lesson/lib/cards';
import { fullDate, dateChip } from '@/shared/lib/date';
import { shiftISO, startOfWeek } from '@/shared/lib/schedule-utils.mjs';

function EmptyDay({onNext}) {
  return <div className="no-classes"><CalendarDays size={28} aria-hidden="true"/><h2>На этот день занятий нет</h2><p>Можно посмотреть другой день или перейти к ближайшим занятиям.</p><button className="secondary-action" onClick={onNext}>Следующий день <ArrowRight size={17}/></button></div>;
}
export function ScheduleView({lessons,selected,mode,onTeacher,onGroup,onRoom,onDay,loading,pending,sourceUpdated}) {
  const cards = lessonsToCards(lessons,selected);
  const weekStart = startOfWeek(selected);
  const week = Array.from({length:7},(_,i)=>shiftISO(weekStart,i));
  return <main id="main-content" className="schedule-view">
    <div className="section-title"><h2>{fullDate(selected)}</h2><span className="count-note">{loading?'Загрузка…':`${cards.length} ${cards.length===1?'пара':cards.length>=2&&cards.length<=4?'пары':'пар'}`}</span></div>
    {pending&&<div className="pending-label" role="status">Загружаем расписание. Оно появится автоматически.</div>}
    <div className="mobile-lessons">{loading?<div className="loading-label" role="status">Получаем занятия…</div>:
      cards.length?cards.map(card=><LessonCard key={card.key} card={card} mode={mode} onTeacher={onTeacher} onGroup={onGroup} onRoom={onRoom}/>):pending?<div className="loading-label" role="status">Ждём обновления расписания. Данные появятся автоматически.</div>:<EmptyDay onNext={()=>onDay(shiftISO(selected,1))}/>}</div>
    <div className="week-grid" aria-label="Недельное расписание">
      {week.map(day=>{
        const ch=dateChip(day);
        return <section className="week-column" key={day}><button onClick={()=>onDay(day)} className={'week-heading '+(day===selected?'selected':'')}>{ch.weekday} {ch.day} {ch.month}</button>
          <div className="week-cards">{lessonsToCards(lessons,day).map(card=><LessonCard key={card.key} card={card} mode={mode} onTeacher={onTeacher} onGroup={onGroup} onRoom={onRoom}/>)}
            {!lessonsToCards(lessons,day).length&&<span className="week-empty">—</span>}</div>
        </section>;
      })}
    </div>
  </main>;
}
