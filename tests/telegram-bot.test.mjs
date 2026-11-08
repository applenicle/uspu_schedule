import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBotCommand, periodDate, nextTeachingDate, renderTelegramWeek, callbackData, parseCallbackData, scheduleKeyboard, greeting } from '../src/shared/lib/telegram-bot.mjs';
import { shortRoom } from '../src/shared/lib/text.js';

const sample=[
 {date:'2026-11-09',time:'10:15 - 11:45',subject:'Графический дизайн',type:'Лабораторная',teacher:'Шмакова Людмила Евгеньевна',room:'ауд. Учебная аудитория М1-313 УК М9',group:'ДГ-304',subgroup:'1'},
 {date:'2026-11-09',time:'10:15 - 11:45',subject:'Графический дизайн',type:'Лабораторная',teacher:'Станиславская-Владимирова Анна Константиновна',room:'11-314 УК М9',group:'ДГ-304',subgroup:'2'},
];

test('bot reads Russian group in any spelling and slash commands',()=>{
 assert.deepEqual(parseBotCommand('дг304'),{type:'schedule',kind:'group',period:'next',query:'дг304'});
 assert.deepEqual(parseBotCommand('/group ДГ-304'),{type:'schedule',kind:'group',period:'next',query:'ДГ-304'});
 assert.deepEqual(parseBotCommand('/tomorrow@uspu_app ДГ304'),{type:'schedule',kind:'group',period:'tomorrow',query:'ДГ304'});
 assert.deepEqual(parseBotCommand('/teacher Иванова Анна Сергеевна'),{type:'schedule',kind:'teacher',period:'today',query:'Иванова Анна Сергеевна'});
 assert.equal(parseBotCommand('/start').type,'help');
 assert.equal(parseBotCommand('/today').type,'missing');
});
test('next day is picked after an empty Sunday',()=>{
 assert.equal(nextTeachingDate(sample,'2026-11-08'),'2026-11-09');
 assert.equal(periodDate('tomorrow','2026-11-08',sample),'2026-11-09');
});
test('callback date navigation is constrained and round-trips identifiers',()=>{
 const data=callbackData('group','Дг-304','2026-11-09');
 assert.deepEqual(parseCallbackData(data),{kind:'group',id:'Дг-304',date:'2026-11-09'});
 assert.equal(callbackData('group','А'.repeat(80),'2026-11-09'),null);
 assert.equal(parseCallbackData('invalid'),null);
 const keyboard=scheduleKeyboard('group','Дг-304','2026-11-09');
 assert.equal(keyboard.inline_keyboard[0].length,2);
});
test('telegram week encodes lesson types and subgroups safely',()=>{
 const html=renderTelegramWeek(sample,'2026-11-09','ДГ-304 & <>');
 assert.match(html,/ДГ-304 &amp; &lt;&gt;/);
 assert.match(html,/1 подгруппа/);
 assert.match(html,/2 подгруппа/);
 assert.match(html,/11-314/);
 assert.doesNotMatch(html,/& <>/);
 assert.match(greeting().text,/группы или фамилию преподавателя/);
});
test('room formatter removes decorative building descriptions',()=>{
 assert.equal(shortRoom('Учебная аудитория М1-313 УК М9'),'М1-313 · УК М9');
 assert.equal(shortRoom('ауд. Учебная аудитория 11-309 УК М9'),'11-309 · УК М9');
 assert.equal(shortRoom('дистант: Виртуальная аудитория'),'дистант: Виртуальная аудитория');
});
