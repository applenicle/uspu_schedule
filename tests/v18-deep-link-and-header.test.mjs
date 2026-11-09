import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readScheduleLink, scheduleLink} from '../src/shared/lib/schedule-link.mjs';
import {scheduleKeyboard, menuKeyboard} from '../src/shared/lib/telegram-bot.mjs';

const source = path => readFileSync(new URL(path,import.meta.url),'utf8');

test('selected Telegram group opens the same group in Mini App', () => {
 const buttons = scheduleKeyboard('group','Дг-206','2026-11-10','https://uspu-schedule.vercel.app/');
 const link = buttons.inline_keyboard.flat().find(b => b.text === 'Открыть приложение').web_app.url;
 assert.deepEqual(readScheduleLink(new URL(link).search),{kind:'group',id:'Дг-206',label:'Дг-206'});
 const menuLink = menuKeyboard('https://uspu-schedule.vercel.app/').inline_keyboard[1][0].web_app.url;
 assert.equal(menuLink, 'https://uspu-schedule.vercel.app/');
});

test('teacher URLs include real ID and display name; labels are encoded', () => {
 const buttons = scheduleKeyboard('teacher','15763646','2026-11-10','https://uspu-schedule.vercel.app/', '2026-11-10','day','Микушина Марина Михайловна');
 const url = buttons.inline_keyboard.flat().find(b=>b.text==='Открыть приложение').web_app.url;
 assert.deepEqual(readScheduleLink(new URL(url).search),{kind:'teacher',id:'15763646',label:'Микушина Марина Михайловна'});
 assert.equal(readScheduleLink('?kind=whatever&id=Дг-206'),null);
 assert.equal(readScheduleLink('?kind=group'),null);
 assert.equal(readScheduleLink('?kind=group&id='+encodeURIComponent('A'.repeat(170))),null);
 assert.equal(scheduleLink('https://test.org/','invalid','123'),'https://test.org/');
});

test('web deep link takes priority over saved group, and selection updates URL',()=>{
 const page=source('../src/fsd/pages/schedule/ui/schedule-page.jsx');
 assert.match(page,/const link=readScheduleLink\(url.search\)/);
 assert.match(page,/if \(link\) \{setSelected\(link\)/);
 assert.match(page,/history.replaceState/);
 assert.match(page,/scheduleLink\(window.location.href,item.kind,item.id,item.label\)/);
 const webhook=source('../src/app/api/telegram/webhook/route.js');
 assert.match(webhook,/period==='week'\?'week':'day',title/);
});

test('mobile switch control is full width, opens the current category search',()=>{
 const css=source('../src/app/globals.css');
 const header=source('../src/widgets/app-header/ui/app-header.jsx');
 assert.match(css,/\.subject-block > \.change-entity \{ display:flex;width:100%/);
 assert.match(header,/Сменить группу/);
 assert.match(header,/onClick=\{onChangeSelection\}/);
 const page=source('../src/fsd/pages/schedule/ui/schedule-page.jsx');
 assert.match(page,/setSearchKind\(kind\);setSearchTerm\(''\);setDialog\('search'\)/);
});

test('parallel records without official numbers are separate but not falsely numbered',()=>{
 const card=source('../src/entities/lesson/ui/lesson-card.jsx');
 assert.match(card,/displaySubgroup/);
 assert.doesNotMatch(card,/\? `\$\{i\+1\} подгруппа`/);
});
