import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lessonsToCards} from '../src/entities/lesson/lib/cards.js';
import {richScheduleDay,richScheduleWeek} from '../src/shared/lib/telegram-rich.mjs';

const base={date:'2026-11-10',time:'10:15 - 11:45',subject:'Веб-дизайн',type:'Лаб.зан-я',room:'11-313 УК М9',teacher:'Шмакова Лариса Евгеньевна',subgroup:''};
const second={...base,teacher:'Ченушкина Светлана Владимировна'};
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');

test('parallel lessons keep both teachers without fictional variants or subgroup numbers',()=>{
 const first=lessonsToCards([base,second],base.date)[0].items;
 const reversed=lessonsToCards([second,base],base.date)[0].items;
 assert.deepEqual(first.map(item=>item.teacher),reversed.map(item=>item.teacher));
 assert.deepEqual(first.map(item=>item.displaySubgroup),['','']);
 assert.ok(first.every(item=>item.subgroupVerified===false));
 const day=richScheduleDay([base,second],base.date,'ДГ-304');
 assert.match(day,/Ченушкина/);
 assert.match(day,/Шмакова/);
 assert.doesNotMatch(day,/[12] подгруппа/);
 assert.doesNotMatch(day,/Вариант|условные варианты/);
 assert.doesNotMatch(richScheduleWeek([base,second],base.date,'ДГ-304'),/Вариант|условные варианты/);
});

test('verified numbers override provisional options and retain teacher mapping',()=>{
 const rows=[{...base,subgroup:'2'},{...second,subgroup:'1'}];
 const cards=lessonsToCards(rows,base.date)[0].items;
 assert.deepEqual(cards.map(x=>x.displaySubgroup),['1 подгруппа','2 подгруппа']);
 assert.equal(cards[0].teacher,second.teacher);
 assert.match(richScheduleDay(rows,base.date,'ДГ-304'),/1 подгруппа/);
 assert.doesNotMatch(richScheduleDay(rows,base.date,'ДГ-304'),/условные варианты/);
});

test('desktop day/week mode and adaptive layout are real JSX/CSS controls',()=>{
 const jsx=read('../src/widgets/schedule-view/ui/schedule-view.jsx');
 const css=read('../src/app/globals.css');
 assert.match(jsx,/setDesktopMode\('day'\)/);
 assert.match(jsx,/setDesktopMode\('week'\)/);
 assert.match(jsx,/desktop-mode-\$\{desktopMode\}/);
 assert.match(css,/desktop-mode-day \.mobile-lessons/);
 assert.match(css,/repeat\(auto-fit,minmax\(min\(100%,270px\),1fr\)\)/);
});
