'use client';
import { UsersRound, UserRound, DoorOpen } from 'lucide-react';

const SECTIONS = [
  { kind: 'group', label: 'Группы', Icon: UsersRound },
  { kind: 'teacher', label: 'Преподаватели', Icon: UserRound },
  { kind: 'room', label: 'Аудитории', Icon: DoorOpen },
];

/** A single, persistent mobile navigation surface. Each action opens the appropriate picker. */
export function MobileEntityNav({ kind, onSelectKind }) {
  return <nav className="mobile-entity-nav" aria-label="Выбрать тип расписания">
    {SECTIONS.map(({kind: target, label, Icon}) => <button
      type="button" key={target} className={`mobile-entity-nav__item${kind===target?' is-active':''}`}
      aria-label={`Выбрать: ${label}`} aria-current={kind===target?'page':undefined}
      onClick={()=>onSelectKind(target)}>
      <Icon size={21} aria-hidden="true" strokeWidth={1.85}/><span>{label}</span>
    </button>)}
  </nav>;
}
