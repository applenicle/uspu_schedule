'use client';
import { BookOpen, FlaskConical, GraduationCap, MapPin, Users, UserRound, Microscope, ClipboardList } from 'lucide-react';
import { lessonCategory } from '@/shared/lib/schedule-utils.mjs';
import { shortRoom, shortTeacher } from '@/shared/lib/text';

const ICONS = { lecture:BookOpen,practice:Users,lab:FlaskConical,seminar:ClipboardList,exam:GraduationCap,other:Microscope };

function RoomButton({room,onRoom}) {
  return <button className="inline-room" title={room} aria-label={`Открыть расписание аудитории: ${room || 'не указана'}`} onClick={()=>room&&onRoom(room)}><MapPin size={15} aria-hidden="true"/><span>ауд. {shortRoom(room)}</span></button>;
}

export function LessonCard({ card, mode, onTeacher, onGroup, onRoom }) {
  const { main, items, time } = card;
  const type = lessonCategory(main.type);
  const Icon = ICONS[type.key] || ClipboardList;
  const hasSubgroups = items.some(item=>item.subgroup);
  // Do not silently hide other concurrent records when upstream subgroup field is empty.
  const multiple = items.length > 1 || hasSubgroups;
  return <article className={`lesson-card type-${type.key}`} aria-label={`${main.subject}, ${type.label}, ${time[0]} ${time[1]}`}>
    <div className="lesson-time" aria-label={`С ${time[0]} до ${time[1]}`}>
      <span className="time-start">{time[0]}</span><span className="time-end">{time[1]}</span>
    </div>
    <div className="lesson-main">
      <div className="lesson-topline"><span className="type-label"><Icon size={15} aria-hidden="true"/>{type.label}</span></div>
      <div className="lesson-title">{main.subject}</div>
      {multiple ? <div className="subgroups">
        {items.map((entry,i)=><div className="subgroup" key={`${entry.teacher}-${entry.room}-${i}`}>
          {entry.subgroup&&<span className="subgroup-index">{entry.subgroup} подгруппа</span>}
          <div className="subgroup-meta">
            <button title={entry.teacher} className="inline-person" onClick={()=>mode==='teacher'?onGroup(entry.group):onTeacher(entry.teacher)}>
              {mode==='teacher'?<Users size={15} aria-hidden="true"/>:<UserRound size={15} aria-hidden="true"/>}
              <span data-long={String(mode==='teacher'?entry.group:shortTeacher(entry.teacher)).length>25}>{mode==='teacher'?entry.group:shortTeacher(entry.teacher)}</span>
            </button>
            <RoomButton room={entry.room} onRoom={onRoom}/>
          </div>
        </div>)}
      </div> : <div className="lesson-meta">
        <button className="inline-person" title={mode==='teacher'?main.group:main.teacher} onClick={()=>mode==='teacher'?onGroup(main.group):onTeacher(main.teacher)}>
          {mode==='teacher'?<Users size={15} aria-hidden="true"/>:<UserRound size={15} aria-hidden="true"/>}
          <span data-long={String(mode==='teacher'?main.group:shortTeacher(main.teacher)).length>25}>{mode==='teacher'?main.group:shortTeacher(main.teacher)}</span>
        </button>
        <RoomButton room={main.room} onRoom={onRoom}/>
      </div>}
    </div>
    </article>;
}
