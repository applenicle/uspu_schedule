import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGroup, lessonCategory, splitTimes, nearestTeachingDay, startOfWeek } from '../src/shared/lib/schedule-utils.mjs';
import { lessonsToCards } from '../src/entities/lesson/lib/cards.js';
import { demoLessons } from '../src/shared/lib/demo-data.mjs';
import { todayYekaterinburg, dateChip } from '../src/shared/lib/date.js';
import { shortTeacher, shortRoom } from '../src/shared/lib/text.js';

test('group search is case/hyphen/space insensitive', () => {
  for (const value of ['дг304','ДГ-304','Дг 304','дг-304','ДГ_304']) assert.equal(normalizeGroup(value),'ДГ304');
});
test('lesson types classify consistently', () => {
  assert.equal(lessonCategory('Лекции').key,'lecture');
  assert.equal(lessonCategory('Практ.зан-я').key,'practice');
  assert.equal(lessonCategory('Лабораторная').key,'lab');
  assert.equal(lessonCategory('Лаб.зан-я').key,'lab');
  assert.equal(lessonCategory('Экзамен').key,'exam');
});
test('date chips contain month and no ambiguous bare numbers', () => {
  assert.deepEqual(dateChip('2026-11-09'),{weekday:'Пн',day:9,month:'ноя'});
  assert.equal(todayYekaterinburg(new Date('2026-11-08T21:00:00Z')),'2026-11-09');
  assert.equal(startOfWeek('2026-11-08'),'2026-11-02');
});
test('two subgroups share one subject/time card',()=>{
  const list=demoLessons('2026-11-08');
  const cards=lessonsToCards(list,'2026-11-09');
  assert.equal(cards.length,4);
  const pair=cards.find(x=>x.items.length===2);
  assert.ok(pair);
  assert.deepEqual(pair.items.map(x=>x.subgroup),['1','2']);
});
test('different subjects at the same time never merge',()=>{
  const list=[{date:'2026-11-09',time:'12:00 - 13:30',subject:'A',type:'Лекции'},
    {date:'2026-11-09',time:'12:00 - 13:30',subject:'Б',type:'Лекции'}];
  assert.equal(lessonsToCards(list,'2026-11-09').length,2);
});
test('teacher name and rooms preserve meaningful strings',()=>{
  assert.equal(shortTeacher('Александрова-Кузнецова Екатерина Константиновна'),'Александрова-Кузнецова Е. К.');
  assert.equal(shortRoom('ГУК: Кабинет 214'),'214');
  assert.deepEqual(splitTimes('12:00 - 13:30'),['12:00','13:30']);
});
test('first day on Sunday selects upcoming classes',()=>{
  assert.equal(nearestTeachingDay(demoLessons('2026-11-08'),'2026-11-08'),'2026-11-09');
});

test('long source room names are shortened without losing the room code',()=>{
  assert.equal(shortRoom('11-309, Учебная аудитория декоративно-прикладного искусства'),'11-309');
  assert.equal(shortRoom('ГУК: Кабинет 214, учебная аудитория'),'214');
  assert.equal(shortRoom('дистант: Виртуальная аудитория'),'дистант: Виртуальная аудитория');
});
test('parallel records without subgroup metadata are not discarded',()=>{
  const rows=[
    {date:'2026-11-09',time:'10:15 - 11:45',subject:'Проект',type:'Практ.зан-я',teacher:'А',room:'301',subgroup:''},
    {date:'2026-11-09',time:'10:15 - 11:45',subject:'Проект',type:'Практ.зан-я',teacher:'Б',room:'302',subgroup:''}
  ];
  const cards=lessonsToCards(rows,'2026-11-09');
  assert.equal(cards.length,1);
  assert.equal(cards[0].items.length,2);
});
