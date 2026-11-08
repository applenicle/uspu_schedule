import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme, sanitizeThemePreference } from '../src/shared/lib/theme.mjs';
import { favoritesForKind } from '../src/shared/lib/favorites.mjs';
import { uniqueTeacherMatch } from '../src/shared/lib/teacher.mjs';
import { formatTelegramDay } from '../src/shared/lib/telegram-format.mjs';

test('automatic theme follows device and manual overrides only when selected', () => {
  assert.equal(sanitizeThemePreference(null),'auto');
  assert.equal(resolveTheme('auto','dark'),'dark');
  assert.equal(resolveTheme('auto','light'),'light');
  assert.equal(resolveTheme('light','dark'),'light');
  assert.equal(resolveTheme('dark','light'),'dark');
});

test('favorites list never includes other entity types', () => {
  const items=[{kind:'group',id:'Дг-304'}, {kind:'teacher',id:'15763646'}, {kind:'room',id:'301'}];
  assert.deepEqual(favoritesForKind(items,'group'),[{kind:'group',id:'Дг-304'}]);
  assert.deepEqual(favoritesForKind(items,'teacher'),[{kind:'teacher',id:'15763646'}]);
});

test('teacher names with initials match full catalog names only when unambiguous', () => {
  const catalog=[{id:'123',label:'Иванова Анна Сергеевна'}, {id:'124',label:'Петров Дмитрий Васильевич'}];
  assert.equal(uniqueTeacherMatch('Иванова А. С.',catalog)?.id,'123');
  assert.equal(uniqueTeacherMatch('Иванова Анна Сергеевна',catalog)?.id,'123');
  assert.equal(uniqueTeacherMatch('Иванова А. С.',[...catalog,{id:'321',label:'Иванова Александра Сергеевна'}]),null);
});

test('Telegram HTML output escapes unsafe text and includes room and subgroup', () => {
  const rows=[{date:'2026-11-09',time:'12:00 - 13:30',subject:'Дизайн & <анимация>',type:'Практ.зан-я',room:'11-309, Учебная аудитория',teacher:'Иванова Анна Сергеевна',group:'ДГ-304',subgroup:'1'}];
  const html=formatTelegramDay(rows,'2026-11-09','ДГ-304');
  assert.match(html,/Дизайн &amp; &lt;анимация&gt;/);
  assert.match(html,/1 подгруппа/);
  assert.match(html,/11-309/);
  assert.doesNotMatch(html,/<анимация>/);
});
