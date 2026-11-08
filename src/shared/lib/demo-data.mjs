// Explicitly fictional data, used only for ?demo=1 visual previews.
import { shiftISO } from './schedule-utils.mjs';
export const demoCatalog = [
  { kind: 'group', id: 'ДГ-304', label: 'ДГ-304' },
  { kind: 'group', id: 'ДГ-303', label: 'ДГ-303' },
  { kind: 'group', id: 'ПИ-301', label: 'ПИ-301' },
  { kind: 'group', id: 'ДВЦБ-214С', label: 'ДВЦБ-214С' },
  { kind: 'teacher', id: 'T1', label: 'Смирнова Елена Викторовна' },
  { kind: 'teacher', id: 'T2', label: 'Иванова Анна Сергеевна' },
  { kind: 'teacher', id: 'T3', label: 'Кузнецов Михаил Николаевич' },
  { kind: 'teacher', id: 'T4', label: 'Павлова Наталья Викторовна' },
  { kind: 'room', id: 'ГУК: Кабинет 301', label: 'ГУК: Кабинет 301' },
  { kind: 'room', id: 'ГУК: Кабинет 303', label: 'ГУК: Кабинет 303' },
  { kind: 'room', id: 'ГУК: Кабинет 214', label: 'ГУК: Кабинет 214' },
  { kind: 'room', id: 'ГУК: Кабинет 105', label: 'ГУК: Кабинет 105' },
];
export function demoLessons(today, kind = 'group', id = 'ДГ-304') {
  const next = shiftISO(today, 1);
  const later = shiftISO(today, 2);
  const fri = shiftISO(today, 4);
  const rows = [
    { date: next, time:'08:30 - 10:00', subject:'Педагогика', type:'Лекции', room:'ГУК: Кабинет 214', teacher:'Иванова Анна Сергеевна', group:'ДГ-304', subgroup:'' },
    { date: next, time:'10:15 - 11:45', subject:'Иностранный язык', type:'Практ.зан-я', room:'ГУК: Кабинет 301', teacher:'Смирнова Елена Викторовна', group:'ДГ-304', subgroup:'1' },
    { date: next, time:'10:15 - 11:45', subject:'Иностранный язык', type:'Практ.зан-я', room:'ГУК: Кабинет 303', teacher:'Смирнова Елена Викторовна', group:'ДГ-304', subgroup:'2' },
    { date: next, time:'12:30 - 14:00', subject:'Психология образования', type:'Лекции', room:'ГУК: Кабинет 105', teacher:'Кузнецов Михаил Николаевич', group:'ДГ-304', subgroup:'' },
    { date: next, time:'14:15 - 16:15', subject:'Методика обучения математике', type:'Экзамен', room:'ГУК: Кабинет 402', teacher:'Павлова Наталья Викторовна', group:'ДГ-304', subgroup:'' },
    { date: later, time:'09:00 - 10:30', subject:'Иностранный язык', type:'Практ.зан-я', room:'ГУК: Кабинет 301', teacher:'Смирнова Елена Викторовна', group:'ДГ-304', subgroup:'1' },
    { date: later, time:'11:00 - 12:30', subject:'Информационные технологии', type:'Лабораторная', room:'ГУК: Кабинет 303', teacher:'Кузнецов Михаил Николаевич', group:'ДГ-304', subgroup:'' },
    { date: fri, time:'13:00 - 14:30', subject:'Педагогика', type:'Семинар', room:'ГУК: Кабинет 214', teacher:'Иванова Анна Сергеевна', group:'ДГ-304', subgroup:'' },
    { date: next, time:'13:00 - 14:30', subject:'Иностранный язык', type:'Практ.зан-я', room:'ГУК: Кабинет 307', teacher:'Смирнова Елена Викторовна', group:'ДГ-302', subgroup:'' },
    { date: later, time:'16:00 - 17:30', subject:'Методика преподавания', type:'Лекции', room:'ГУК: Кабинет 201', teacher:'Смирнова Елена Викторовна', group:'ДГ-401', subgroup:'' },
  ];
  if (kind === 'teacher') {
    const teacher = demoCatalog.find(x => x.kind === 'teacher' && x.id === id)?.label;
    return rows.filter(x => x.teacher === teacher);
  }
  if (kind === 'room') return rows.filter(x => x.room === id);
  return rows.filter(x => x.group === id);
}
