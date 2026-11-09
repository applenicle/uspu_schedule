import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBotCommand,parseMenuCallback,menuKeyboard,scheduleKeyboard,isTeacherQuery,weekCallbackData,parseWeekCallback} from '../src/shared/lib/telegram-bot.mjs';
import {richGreeting,richScheduleWeek} from '../src/shared/lib/telegram-rich.mjs';
const read = p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('one unified Telegram search accepts group or teacher without a separate menu',()=>{
 assert.equal(parseMenuCallback('m|find'),'find');
 assert.equal(menuKeyboard().inline_keyboard.flat().filter(b=>b.callback_data).length,1);
 assert.equal(parseBotCommand('дг304').kind,'group');
 assert.equal(parseBotCommand('Иванова').kind,'teacher');
 assert.equal(parseBotCommand('Иванова Анна Сергеевна').kind,'teacher');
 assert.equal(parseBotCommand('преподаватель Шмакова').kind,'teacher');
 assert.equal(parseBotCommand('/group ДГ304').kind,'group');
 assert.equal(isTeacherQuery('ПИ-301'),false);
 assert.match(richGreeting(),/группу или фамилию/);
});
test('webhook uses a unified force-reply prompt; older callbacks remain accepted',()=>{
 const webhook=read('../src/app/api/telegram/webhook/route.js');
 assert.match(webhook,/Поиск расписания/);
 assert.match(webhook,/menu==='find'/);
 assert.match(webhook,/sendRichMessage/);
 assert.match(webhook,/repliedTo.startsWith\('Поиск расписания'\)/);
 assert.equal(parseMenuCallback('m|teacher'),'teacher');
 assert.equal(scheduleKeyboard('group','Дг-304','2026-11-09').inline_keyboard.length,3);
});
test('web cards show only real subgroup numbers, without a misleading fallback caption',()=>{
 const jsx=read('../src/entities/lesson/ui/lesson-card.jsx');
 const css=read('../src/app/globals.css');
 assert.doesNotMatch(jsx,/Параллельные занятия · номер подгруппы не указан/);
 assert.match(jsx,/entry.subgroup&&/);
 assert.match(css,/--lab-bg: #dceeea/);
 assert.match(css,/--lab-bg: #28434b/);
 assert.match(css,/week-heading strong/);
 assert.match(read('../src/widgets/app-header/ui/app-header.jsx'),/selected&&/);
 assert.doesNotMatch(read('../src/fsd/pages/schedule/ui/schedule-page.jsx'),/className="bottom-nav"/);
});
test('rich week keeps uppercase day headers and no invented subgroup numbers',()=>{
 const data=[{date:'2026-11-09',time:'10:15 - 11:45',subject:'Дизайн',type:'Лабораторная',room:'301',teacher:'А',subgroup:''},
 {date:'2026-11-09',time:'10:15 - 11:45',subject:'Дизайн',type:'Лабораторная',room:'302',teacher:'Б',subgroup:''}];
 const output=richScheduleWeek(data,'2026-11-09','ДГ-304');
 assert.match(output,/<h2>ПОНЕДЕЛЬНИК/);
 assert.doesNotMatch(output,/номера подгрупп не указаны/);
 assert.doesNotMatch(output,/1 подгруппа/);
});

test('weekly message keeps identical subjects at separate times for easy subgroup tracking',()=>{
 const data=['10:15 - 11:45','12:00 - 13:30','14:15 - 15:45'].map(time=>({date:'2026-11-09',time,subject:'Графический дизайн',type:'Лабораторная',room:'11-313 УК М9',teacher:'Шмакова Лариса Евгеньевна',subgroup:''}));
 const output=richScheduleWeek(data,'2026-11-09','ДГ-304');
 assert.equal((output.match(/<blockquote>/g)||[]).length,3);
 for(const time of ['10:15–11:45','12:00–13:30','14:15–15:45']) assert.match(output,new RegExp(`<h3>${time}</h3>`));
 assert.doesNotMatch(output,/10:15–11:45 · 12:00–13:30/);
});

test('week callback stays on the week the user is browsing',()=>{
 const payload=weekCallbackData('group','Дг-304','2026-11-16');
 assert.deepEqual(parseWeekCallback(payload),{kind:'group',id:'Дг-304',date:'2026-11-16'});
 assert.ok(Buffer.byteLength(payload,'utf8')<=64);
});
