import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { richScheduleDay, richScheduleWeek } from '../src/shared/lib/telegram-rich.mjs';
import { scheduleDisplayName, needsTeacherNameLookup } from '../src/shared/lib/telegram-bot.mjs';
import { normalizeGroup } from '../src/shared/lib/schedule-utils.mjs';

const lessons=[{
  date:'2026-11-10',time:'16:00 - 17:30',subject:'Графический дизайн',
  type:'Лаб.зан-я',group:'ЗДг-207',teacher:'Шмакова Лариса Евгеньевна',
  room:'11-313 УК М9',subgroup:''
}];

test('rich day and week render subject separately and italic lesson type',()=>{
  for(const markup of [
    richScheduleDay(lessons,'2026-11-10','Шмакова Лариса Евгеньевна','teacher'),
    richScheduleWeek(lessons,'2026-11-10','Шмакова Лариса Евгеньевна','teacher'),
  ]) {
    assert.match(markup,/<p><b>Графический дизайн<\/b><\/p><p><i>Лабораторная<\/i><\/p>/u);
    assert.match(markup,/ЗДг-207/u);
    assert.doesNotMatch(markup,/15770302/u);
  }
});

test('numeric teacher key is resolved to real name without altering group codes',()=>{
  assert.equal(needsTeacherNameLookup('teacher','15770302','15770302'),true);
  assert.equal(scheduleDisplayName('teacher','15770302','15770302','Шмакова Лариса Евгеньевна'),'Шмакова Лариса Евгеньевна');
  assert.equal(scheduleDisplayName('teacher','15770302','15770302'),'Преподаватель');
  assert.equal(scheduleDisplayName('group','ЗДг-207','ЗДг-207'),'ЗДг-207');
  assert.equal(normalizeGroup('ЗДг-207'),'ЗДГ207');
  assert.notEqual(normalizeGroup('ЗДг-207'),normalizeGroup('3Дг-207'));
});

test('webhook and preview API resolve the name from catalog for callbacks',()=>{
  const webhook=readFileSync(new URL('../src/app/api/telegram/webhook/route.js',import.meta.url),'utf8');
  const preview=readFileSync(new URL('../src/app/api/telegram/message/route.js',import.meta.url),'utf8');
  for(const text of [webhook,preview]) {
    assert.match(text,/SELECT label FROM catalog WHERE kind='teacher' AND id=\$\{id\} LIMIT 1/u);
    assert.match(text,/scheduleDisplayName\(/u);
  }
});
