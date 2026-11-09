import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replyKeyboard,replyShortcut} from '../src/shared/lib/telegram-bot.mjs';
import {lessonsToCards} from '../src/entities/lesson/lib/cards.js';
import {richScheduleDay,richScheduleWeek} from '../src/shared/lib/telegram-rich.mjs';

const code=()=>readFileSync(new URL('../src/app/api/telegram/webhook/route.js',import.meta.url),'utf8');
const lesson=(teacher,subgroup='')=>({date:'2026-11-10',time:'10:15 - 11:45',subject:'Веб-дизайн',type:'Лаб.зан-я',room:'11-313 УК М9',teacher,subgroup,group:'Дг-304'});

test('reply keyboard stays under input with two clear action rows and app button',()=>{
  const board=replyKeyboard('https://uspu-schedule.vercel.app/');
  assert.equal(board.is_persistent,true);
  assert.equal(board.resize_keyboard,true);
  assert.deepEqual(board.keyboard.map(r=>r.map(b=>b.text)),[
    ['Выбрать расписание'],['Открыть приложение']
  ]);
  assert.equal(board.keyboard[1][0].web_app.url,'https://uspu-schedule.vercel.app/');
  assert.equal(board.keyboard[1][0].style,'success');
});

test('reply buttons resolve to actual search prompts, not mistaken teacher names',()=>{
  assert.equal(replyShortcut('Расписание группы'),'group');
  assert.equal(replyShortcut('ПРЕПОДАВАТЕЛЬ'),'teacher');
  assert.equal(replyShortcut('Сменить расписание'),'auto');
  assert.equal(replyShortcut('Выбрать расписание'),'auto');
  assert.equal(replyShortcut('Дг-304'),null);
  const webhook=code();
  assert.match(webhook,/const shortcut=replyShortcut\(message\.text\)/);
  assert.match(webhook,/await prompt\(chat\.id,shortcut\)/);
});

test('one /start reply installs keyboard, rich schedule does not generate extra bot messages',()=>{
 const webhook=code();
 assert.match(webhook,/async function welcome\(chatId\)/);
 assert.match(webhook,/reply_markup:replyKeyboard\(origin\(\)\)/);
 assert.match(webhook,/await sendRich\(chat\.id,content,editId\)/);
 assert.doesNotMatch(webhook,/showBottomKeyboard|installReplyKeyboard|Быстрый доступ к расписанию/);
 assert.match(webhook,/for\(const row of \[\.\.\.\(body\.reply_markup\?\.inline_keyboard/);
});

test('unknown subgroup numbers are not invented from group names, but each teacher remains visible',()=>{
  const source=[lesson('Шмакова Лариса Евгеньевна'),lesson('Ченушкина Светлана Владимировна')];
  const rows=lessonsToCards(source,'2026-11-10')[0].items;
  assert.equal(rows.length,2);
  assert.ok(rows.every(i=>i.displaySubgroup===''&&i.subgroupVerified===false));
  for(const text of [richScheduleDay(source,'2026-11-10','Дг-304'),richScheduleWeek(source,'2026-11-10','Дг-304')]){
    assert.match(text,/Шмакова/);
    assert.match(text,/Ченушкина/);
    assert.doesNotMatch(text,/Вариант А|Вариант Б|условные варианты|1 подгруппа|2 подгруппа/);
  }
});

test('official subgroup numbers remain bound to the correct teachers',()=>{
  const source=[lesson('Шмакова Лариса Евгеньевна','2'),lesson('Ченушкина Светлана Владимировна','1')];
  const rows=lessonsToCards(source,'2026-11-10')[0].items;
  assert.deepEqual(rows.map(i=>[i.displaySubgroup,i.teacher]),[
    ['1 подгруппа','Ченушкина Светлана Владимировна'],
    ['2 подгруппа','Шмакова Лариса Евгеньевна']
  ]);
});
