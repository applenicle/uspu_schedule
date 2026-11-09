import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { menuKeyboard, scheduleKeyboard } from '../src/shared/lib/telegram-bot.mjs';
const read = path => readFileSync(new URL(path,import.meta.url),'utf8');

test('mobile navigation is in a FSD widget, uses all 3 types and opens picker',()=>{
 const nav=read('../src/widgets/mobile-entity-nav/ui/mobile-entity-nav.jsx');
 const page=read('../src/fsd/pages/schedule/ui/schedule-page.jsx');
 const css=read('../src/app/globals.css');
 for(const kind of ["group","teacher","room"]) assert.match(nav,new RegExp(`kind: '${kind}'`));
 assert.match(nav,/onClick=\{\(\)=>onSelectKind\(target\)\}/);
 assert.match(page,/<MobileEntityNav kind=\{kind\} onSelectKind=\{selectKind\}/);
 assert.match(css,/backdrop-filter:blur\(22px\)/);
 assert.match(css,/prefers-reduced-transparency/);
 assert.match(css,/\.app-header \.entity-tabs \{display:none;\}/);
});

test('teacher and room labels are left aligned, not forced to the trailing edge',()=>{
 const css=read('../src/app/globals.css');
 const cards=read('../src/entities/lesson/ui/lesson-card.jsx');
 assert.match(css,/\.lesson-card \.lesson-meta \.inline-room/);
 assert.match(css,/align-self:flex-start;justify-self:start;justify-content:flex-start/);
 assert.match(cards,/<RoomButton room=\{main.room\}/);
});

test('catalog hides only recently confirmed empty cached schedules, not pending or forever',()=>{
 const api=read('../src/app/api/catalog/route.js');
 assert.match(api,/NOT EXISTS/);
 assert.match(api,/interval '12 hours'/);
 assert.match(api,/jsonb_array_length\(s.payload\) = 0/);
 assert.doesNotMatch(api,/DELETE FROM catalog/);
});

test('Telegram navigation clearly names selection',()=>{
 assert.equal(menuKeyboard().inline_keyboard[0][0].text,'Выбрать расписание');
 const rows=scheduleKeyboard('group','Дг-304','2026-11-09').inline_keyboard;
 assert.equal(rows[1][1].text,'Другое расписание');
 assert.equal(rows[1][1].callback_data,'m|find');
});
