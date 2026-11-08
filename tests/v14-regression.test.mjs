import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { richScheduleWeek } from '../src/shared/lib/telegram-rich.mjs';
import { teacherChoiceCallbackData, parseTeacherChoiceData } from '../src/shared/lib/telegram-bot.mjs';
const read = path => readFileSync(new URL(path,import.meta.url),'utf8');

const base={date:'2026-11-09',subject:'Проектирование',time:'10:15 - 11:45',type:'Лабораторная',room:'11-313 УК М9',group:'Дг-304'};

test('marked day headings and per-time rich blocks survive multi-slot schedule',()=>{
 const lessonData=['10:15 - 11:45','12:00 - 13:30','14:15 - 15:45'].map(time=>({...base,time,teacher:'Шмакова Лариса Евгеньевна',subgroup:''}));
 const output=richScheduleWeek(lessonData,base.date,'Дг-304');
 assert.match(output,/<h2><mark>ПОНЕДЕЛЬНИК/);
 assert.equal((output.match(/<blockquote>/g)||[]).length,3);
 for(const time of ['10:15–11:45','12:00–13:30','14:15–15:45']) assert.match(output,new RegExp(time));
 assert.doesNotMatch(output,/номера подгрупп не указаны|Параллельное занятие/);
});

test('two teachers do not become fictional subgroups',()=>{
 const output=richScheduleWeek([
  {...base,teacher:'Шмакова Лариса Евгеньевна',subgroup:''},
  {...base,teacher:'Ченушкина Светлана Владимировна',subgroup:''}
 ],base.date,'Дг-304');
 assert.match(output,/Шмакова Лариса Евгеньевна/);
 assert.match(output,/Ченушкина Светлана Владимировна/);
 assert.doesNotMatch(output,/1 подгруппа|2 подгруппа|не указаны/);
});

test('real subgroup ids remain visible next to the correct teacher',()=>{
 const output=richScheduleWeek([
  {...base,teacher:'Шмакова',subgroup:'1'},
  {...base,teacher:'Ченушкина',subgroup:'2'}
 ],base.date,'Дг-304');
 assert.match(output,/<mark>1 подгруппа<\/mark>/);
 assert.match(output,/<mark>2 подгруппа<\/mark>/);
});

test('teacher choice callback validates IDs and has direct schedule handler',()=>{
 assert.equal(teacherChoiceCallbackData('15770302'),'p|15770302');
 assert.equal(parseTeacherChoiceData('p|15770302'),'15770302');
 for (const invalid of ['p|abc','p|0;DROP','p|','p|123\nmore',`p|${'2'.repeat(100)}`]) assert.equal(parseTeacherChoiceData(invalid),null);
 const webhook=read('../src/app/api/telegram/webhook/route.js');
 assert.match(webhook,/parseTeacherChoiceData\(callback.data\)/);
 assert.match(webhook,/premiumButton\(item.label,'teacher',\{callback_data\}\)/);
});

test('web UI uses category selection and aligns room to trailing edge',()=>{
 const header=read('../src/widgets/app-header/ui/app-header.jsx');
 const search=read('../src/features/catalog-search/ui/catalog-search.jsx');
 const style=read('../src/app/globals.css');
 const lesson=read('../src/entities/lesson/ui/lesson-card.jsx');
 assert.match(header,/selected&&<div className="subject-row"/);
 assert.match(header,/Другая группа/);
 assert.match(search,/search-kind-tabs/);
 assert.match(search,/setActiveKind\(id\)/);
 assert.match(style,/\.week-grid \.lesson-card \.subgroup-meta \.inline-room/);
 assert.match(style,/margin-left:auto;margin-right:0;align-self:flex-end/);
 assert.match(lesson,/className="time-start"/);
 assert.match(lesson,/className="time-end"/);
 assert.doesNotMatch(lesson,/Параллельные занятия · номер подгруппы не указан/);
});
