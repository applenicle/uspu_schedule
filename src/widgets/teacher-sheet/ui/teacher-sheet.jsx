'use client';
import { UserRound, X, CalendarDays, MapPin, ArrowUpRight, Users } from 'lucide-react';
import { shortRoom } from '@/shared/lib/text';
import { fullDate } from '@/shared/lib/date';
import { splitTimes } from '@/shared/lib/schedule-utils.mjs';

export function TeacherSheet({ teacher, lessons, onClose, onOpen }) {
  if (!teacher) return null;
  const rows=(lessons||[]).filter(item=>item.teacher===teacher).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)).slice(0,5);
  return <div className="modal-backdrop sheet-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <section className="teacher-sheet" role="dialog" aria-modal="true" aria-label={`Преподаватель ${teacher}`}>
      <div className="sheet-handle" aria-hidden="true"/>
      <button className="sheet-close icon-button" onClick={onClose} aria-label="Закрыть"><X size={22}/></button>
      <div className="teacher-profile">
        <span className="teacher-avatar" aria-hidden="true"><UserRound size={29}/></span>
        <div><span className="eyebrow">ПРЕПОДАВАТЕЛЬ</span><h2>{teacher}</h2></div>
      </div>
      <h3>Занятия и аудитории</h3>
      {rows.length? <div className="teacher-lesson-list">{rows.map((row,i)=>{
        const time=splitTimes(row.time);
        return <div className="teacher-lesson" key={`${row.date}${row.time}${i}`}>
          <span className="teacher-lesson-date"><CalendarDays size={18}/>{fullDate(row.date)} · {time[0]}</span>
          <span className="teacher-lesson-subject">{row.subject}</span>
          <div className="teacher-lesson-bottom"><span><Users size={16}/>{row.group||'Группа не указана'}</span><span title={row.room} aria-label={`Аудитория: ${row.room||'не указана'}`}><MapPin size={16}/>ауд. {shortRoom(row.room)}</span></div>
        </div>;
      })}</div>:<p className="teacher-empty">Для этого преподавателя пока нет загруженных занятий. Откройте полное расписание.</p>}
      <button className="primary-action" onClick={onOpen}>Открыть полное расписание <ArrowUpRight size={19}/></button>
    </section>
  </div>;
}
