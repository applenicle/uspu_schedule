import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PREMIUM, richEmoji, richGreeting, richHelp, richScheduleDay, richScheduleWeek, premiumButton, withoutPremium } from '../src/shared/lib/telegram-rich.mjs';
import { menuKeyboard, scheduleKeyboard, parseMenuCallback, parseWeekCallback, weekCallbackData, parseBotCommand } from '../src/shared/lib/telegram-bot.mjs';

const sample=[
 {date:'2026-11-09',time:'10:15 - 11:45',subject:'Рисунок <дизайн> & чертёж',type:'Лабораторная',teacher:'Александрова-Кузнецова Екатерина Константиновна',room:'ауд. Учебная аудитория М1-313 УК М9',group:'Дг-304',subgroup:'1'},
 {date:'2026-11-09',time:'10:15 - 11:45',subject:'Рисунок <дизайн> & чертёж',type:'Лабораторная',teacher:'Станиславская-Владимирова Анна Константиновна',room:'М1-314 УК М9',group:'Дг-304',subgroup:'2'},
 {date:'2026-11-09',time:'12:00 - 13:30',subject:'Экономика & право',type:'Лекция',teacher:'Иванова Александра Вячеславовна',room:'дистант: Виртуальная аудитория',group:'Дг-304',subgroup:''},
];

test('true rich message HTML uses headings/lists/hr and safe source strings',()=>{
 const html=richScheduleDay(sample,'2026-11-09','ДГ-304');
 assert.match(html,/<h2>/);
 assert.match(html,/<h3>/);
 assert.match(html,/<ul><li>/);
 assert.match(html,/<hr\/>/);
 assert.match(html,/Рисунок &lt;дизайн&gt; &amp; чертёж/);
 assert.match(html,/1 подгруппа/);
 assert.match(html,/2 подгруппа/);
 assert.match(html,/М1-313/);
 assert.match(html,/Станиславская-Владимирова Анна Константиновна/);
});

test('premium IDs come from the verified custom emoji set and are attached to inline buttons',()=>{
 for (const name of ['calendar','group','teacher','search','location','back','globe']) {
   assert.match(PREMIUM[name].id,/^\d{18,20}$/);
   assert.match(richEmoji(name),new RegExp(`emoji-id="${PREMIUM[name].id}"`));
 }
 const b=premiumButton('Расписание','calendar',{callback_data:'m|group'},'primary');
 assert.equal(b.icon_custom_emoji_id,PREMIUM.calendar.id);
 assert.equal(b.style,'primary');
 assert.equal(b.text,'Расписание');
 assert.equal(withoutPremium(richGreeting()).includes('<tg-emoji'),false);
});

test('premium main menu navigation remains short and functional',()=>{
 const keyboard=menuKeyboard('https://example.org/');
 const flat=keyboard.inline_keyboard.flat();
 assert.equal(flat.length,2);
 assert.equal(flat.filter(x=>x.icon_custom_emoji_id).length,2);
 assert.equal(flat.find(x=>x.text==='Выбрать расписание').callback_data,'m|find');
 assert.equal(flat.find(x=>x.text==='Открыть приложение').style,'success');
 assert.deepEqual(flat.find(x=>x.text==='Открыть приложение').web_app,{url:'https://example.org/'});
 assert.equal(parseMenuCallback('m|find'),'find');
 assert.equal(parseMenuCallback('m|home'),'home');
 assert.equal(parseMenuCallback('s|g|2026-11-09|ДГ-304'),null);
 assert.match(richHelp(),/\/teacher/);
});

test('schedule navigation and weekly callback are under 64 UTF8 bytes',()=>{
 const callback=weekCallbackData('group','Дг-304');
 assert.deepEqual(parseWeekCallback(callback),{kind:'group',id:'Дг-304'});
 assert.equal(weekCallbackData('group','А'.repeat(80)),null);
 const keys=scheduleKeyboard('group','Дг-304','2026-11-09');
 assert.equal(keys.inline_keyboard[0][0].text,'← День');
 assert.equal(keys.inline_keyboard[1][0].text,'Неделя');
 for(const item of keys.inline_keyboard.flat()) if(item.callback_data) assert.ok(Buffer.byteLength(item.callback_data)<65);
});

test('stateless teacher and group input retain explicit semantics',()=>{
 assert.deepEqual(parseBotCommand('преподаватель Иванова Елена'),{type:'schedule',kind:'teacher',period:'today',query:'Иванова Елена'});
 assert.deepEqual(parseBotCommand('группа дг304'),{type:'schedule',kind:'group',period:'next',query:'дг304'});
 assert.equal(parseBotCommand('меню').type,'help');
});

test('weekly rich output contains subgroups, stays within limits, avoids plain HTML endpoint',()=>{
 const week=richScheduleWeek(sample,'2026-11-09','Дг-304');
 assert.ok(Buffer.byteLength(week,'utf8')<32768);
 assert.match(week,/2 подгруппа/);
 const webhook=readFileSync(new URL('../src/app/api/telegram/webhook/route.js',import.meta.url),'utf8');
 assert.match(webhook,/sendRichMessage/);
 assert.match(webhook,/rich_message:\{html:/);
 assert.doesNotMatch(webhook,/parse_mode:\s*'HTML'/);
});

test('unknown parallel entries do not invent subgroup numbers, week days are uppercase',()=>{
 const day=richScheduleDay([
  {date:'2026-11-09',time:'10:15 - 11:45',subject:'Веб-дизайн',type:'Лабораторная',teacher:'А',room:'301',subgroup:''},
  {date:'2026-11-09',time:'10:15 - 11:45',subject:'Веб-дизайн',type:'Лабораторная',teacher:'Б',room:'302',subgroup:''}
 ],'2026-11-09','Дг-304');
 assert.doesNotMatch(day,/Параллельное занятие|подгруппа/);
 assert.match(richScheduleWeek(sample,'2026-11-09'),/ПОНЕДЕЛЬНИК/);
 assert.doesNotMatch(richGreeting(),/Без регистрации/);
 assert.doesNotMatch(richHelp(),/Учётная запись/);
 assert.equal(menuKeyboard().inline_keyboard.at(-1)[0].style,'success');
});
