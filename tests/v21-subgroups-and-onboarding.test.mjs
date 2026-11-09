import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lessonsToCards } from '../src/entities/lesson/lib/cards.js';
import { richGreeting, richScheduleDay, richScheduleWeek } from '../src/shared/lib/telegram-rich.mjs';

const base={date:'2026-11-10',time:'10:15 - 11:45',group:'Дг-304',
  subject:'Веб-дизайн',type:'Лаб.зан-я',room:'11-313 УК М9'};
const one={...base,teacher:'Ченушкина Светлана Владимировна',subgroup:'0'};
const two={...base,teacher:'Шмакова Лариса Евгеньевна',subgroup:''};

test('two unnumbered teachers get stable display 1/2 in a group schedule',()=>{
  for(const records of [[one,two],[two,one]]) {
    const card=lessonsToCards(records,base.date,{group:base.group})[0];
    assert.deepEqual(card.items.map(x=>x.displaySubgroup),['1 подгруппа','2 подгруппа']);
    assert.deepEqual(card.items.map(x=>x.teacher),[
      'Ченушкина Светлана Владимировна','Шмакова Лариса Евгеньевна']);
    assert.ok(card.items.every(x=>x.subgroupInferred&&!x.subgroupVerified));
  }
});

test('0 alone is an ordinary class and receives no subgroup',()=>{
  const single=lessonsToCards([one],base.date,{group:base.group})[0];
  assert.equal(single.items[0].displaySubgroup,'');
});

test('source 2 takes precedence, unknown parallel gets the remaining 1',()=>{
  const known={...two,subgroup:'2'};
  const result=lessonsToCards([known,one],base.date,{group:base.group})[0].items;
  assert.deepEqual(result.map(x=>[x.displaySubgroup,x.teacher]),[
    ['1 подгруппа',one.teacher],['2 подгруппа',two.teacher]]);
  assert.equal(result[1].subgroupVerified,true);
});

test('teacher timetable does not turn distinct groups into student subgroups',()=>{
  const extra={...two,group:'Дг-206'};
  const result=lessonsToCards([one,extra],base.date)[0].items;
  assert.ok(result.every(x=>x.displaySubgroup===''));
});

test('Telegram day and week show same 1/2 labels and separate lesson type',()=>{
  for(const markup of [richScheduleDay([one,two],base.date,base.group),richScheduleWeek([one,two],base.date,base.group)]) {
    assert.match(markup,/1 подгруппа/);
    assert.match(markup,/2 подгруппа/);
    assert.match(markup,/<p>Лабораторная<\/p>/);
    assert.doesNotMatch(markup,/Вариант А|Вариант Б/);
  }
});

test('start is one rich greeting with onboarding, no fixed group or teacher names',()=>{
  const markup=richGreeting();
  assert.match(markup,/Как пользоваться/);
  assert.match(markup,/группы или ФИО преподавателя/);
  assert.doesNotMatch(markup,/дг304|Шмакова/i);
  const webhook=readFileSync(new URL('../src/app/api/telegram/webhook/route.js',import.meta.url),'utf8');
  assert.match(webhook,/rich_message:\{html:richGreeting\(\)\}/);
  assert.doesNotMatch(webhook,/Напиши группу \(ДГ-304\)/);
});
