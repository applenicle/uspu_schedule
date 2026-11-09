import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBotCommand} from '../src/shared/lib/telegram-bot.mjs';
import {richGreeting, richHelp, richScheduleDay, richScheduleWeek} from '../src/shared/lib/telegram-rich.mjs';

const read = (path) => readFileSync(new URL(path,import.meta.url),'utf8');

test('catalog SQL attaches ESCAPE to ILIKE, not a parenthesized expression',()=>{
  const route=read('../src/app/api/catalog/route.js');
  assert.match(route,/label ILIKE \${like} ESCAPE '!'/);
  assert.doesNotMatch(route,/\)\) ESCAPE '!'/);
  assert.match(route,/jsonb_array_length\(s\.payload\) = 0/);
  assert.match(route,/interval '12 hours'/);
});

test('telegram bot opens search command without demanding group or teacher first',()=>{
  assert.deepEqual(parseBotCommand('/search'),{type:'missing',command:'search'});
  assert.deepEqual(parseBotCommand('/search Дг304'),{type:'schedule',kind:'group',period:'next',query:'Дг304'});
  assert.deepEqual(parseBotCommand('/search Шмакова'),{type:'schedule',kind:'teacher',period:'next',query:'Шмакова'});
  assert.equal(parseBotCommand('/help').type,'instructions');
  assert.equal(parseBotCommand('/commands').type,'instructions');
  assert.equal(parseBotCommand('/start').type,'help');
});

test('help lists discoverable commands; rich message has no marked background',()=>{
  assert.match(richHelp(),/\/search/);
  assert.match(richHelp(),/\/teacher/);
  assert.match(richHelp(),/\/week/);
  assert.match(richGreeting(),/Выбери расписание/);
  const rows = [
    {date:'2026-11-09',time:'10:15 - 11:45',subject:'Графика',type:'Лабораторная',teacher:'Иванова',room:'101',subgroup:'1'},
    {date:'2026-11-09',time:'10:15 - 11:45',subject:'Графика',type:'Лабораторная',teacher:'Смирнова',room:'102',subgroup:'2'},
  ];
  assert.doesNotMatch(richScheduleDay(rows,'2026-11-09'),/<mark>/);
  assert.doesNotMatch(richScheduleWeek(rows,'2026-11-09'),/<mark>/);
  assert.match(richScheduleDay(rows,'2026-11-09'),/1 подгруппа/);
  assert.match(richScheduleDay(rows,'2026-11-09'),/2 подгруппа/);
});

test('menu commands registration does not replace existing webhook',()=>{
  const script=read('../scripts/register-telegram-commands.sh');
  assert.match(script,/setMyCommands/);
  assert.doesNotMatch(script, /\/setWebhook/);
  assert.match(script, /getpass\.getpass/);
});
