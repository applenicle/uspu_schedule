import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scheduleKeyboard,parseCallbackData,parseWeekCallback,weekCallbackData} from '../src/shared/lib/telegram-bot.mjs';
import {withVerifiedSubgroup} from '../src/shared/lib/subgroup-resolution.mjs';
import {lessonsToCards} from '../src/entities/lesson/lib/cards.js';
import {richScheduleDay,richScheduleWeek} from '../src/shared/lib/telegram-rich.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const base={date:'2026-11-10',time:'10:15 - 11:45',subject:'Веб-дизайн',type:'Лаб.зан-я',group:'Дг-304',room:'11-313 УК М9'};
const parallel=[{...base,teacher:'Шмакова Лариса Евгеньевна',subgroup:''},{...base,teacher:'Ченушкина Светлана Владимировна',subgroup:''}];

test('week has its own navigation; no repeated Week button',()=>{
 const week=scheduleKeyboard('group','Дг-304','2026-11-10','https://example.org/', '2026-11-10','week');
 const btns=week.inline_keyboard.flat();
 assert.deepEqual(btns.map(b=>b.text),['Пред. неделя','След. неделя','К понедельнику','Другое расписание','Открыть приложение']);
 assert.deepEqual(parseWeekCallback(btns[0].callback_data),{kind:'group',date:'2026-11-02',id:'Дг-304'});
 assert.deepEqual(parseWeekCallback(btns[1].callback_data),{kind:'group',date:'2026-11-16',id:'Дг-304'});
 assert.deepEqual(parseCallbackData(btns[2].callback_data),{kind:'group',date:'2026-11-09',id:'Дг-304'});
 for(const b of btns) if(b.callback_data) assert.ok(Buffer.byteLength(b.callback_data,'utf8')<=64);
 const day=scheduleKeyboard('group','Дг-304','2026-11-10');
 assert.equal(day.inline_keyboard[1][0].text,'Неделя');
});

test('webhook opens new message for week and clears old buttons after switch',()=>{
 const source=read('../src/app/api/telegram/webhook/route.js');
 assert.match(source,/if\(!weekAction&&callback\.message\?\.message_id\) editId=/u);
 assert.match(source,/editMessageReplyMarkup/u);
 assert.match(source,/period==='week'\?'week':'day'/u);
});

test('unverified numbers are never guessed; verified matching assignments add correct IDs',()=>{
 const a=parallel[0];
 assert.equal(withVerifiedSubgroup(a).subgroup,'');
 const approved=[{group:'ДГ304',subject:'Веб-дизайн',teacher:'Шмакова Лариса Евгеньевна',subgroup:'1'},
 {group:'Дг-304',subject:'Веб-дизайн',teacher:'Ченушкина Светлана Владимировна',subgroup:'2'}];
 assert.equal(withVerifiedSubgroup(a,approved).subgroup,'1');
 assert.equal(withVerifiedSubgroup(parallel[1],approved).subgroup,'2');
 assert.equal(withVerifiedSubgroup({...a,subject:'Другой предмет'},approved).subgroup,'');
 assert.equal(withVerifiedSubgroup({...a,subgroup:'2'},approved).subgroup,'2');
 const cards=lessonsToCards(parallel,'2026-11-10');
 assert.equal(cards[0].items.length,2);
 assert.deepEqual(cards[0].items.map(i=>i.subgroup),['','']);
 const html=richScheduleDay(parallel,'2026-11-10');
 assert.match(html,/Шмакова/);
 assert.match(html,/Ченушкина/);
 assert.doesNotMatch(html,/[12] подгруппа/u);
 const known=parallel.map((row,i)=>({...row,subgroup:String(i+1)}));
 assert.match(richScheduleWeek(known,'2026-11-10'),/1 подгруппа/u);
 assert.match(richScheduleWeek(known,'2026-11-10'),/2 подгруппа/u);
});
