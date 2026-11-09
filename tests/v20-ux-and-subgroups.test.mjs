import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withVerifiedSubgroup } from '../src/shared/lib/subgroup-resolution.mjs';
import { lessonsToCards } from '../src/entities/lesson/lib/cards.js';
import { richScheduleDay } from '../src/shared/lib/telegram-rich.mjs';
import { replyKeyboard, replyShortcut } from '../src/shared/lib/telegram-bot.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const webhook=readFileSync(new URL('../src/app/api/telegram/webhook/route.js',import.meta.url),'utf8');
const base={group:'Дг-304',subject:'Веб-дизайн',time:'10:15 - 11:45',date:'2026-11-10',type:'Лаб.зан-я',room:'11-313 УК М9'};

test('single clean /start + no keyboard-install spam on schedule navigation',()=>{
 assert.match(webhook,/async function welcome\(chatId\)/);
 assert.match(webhook,/await welcome\(chat\.id\);return ok\(\)/);
 assert.doesNotMatch(webhook,/Быстрый доступ к расписанию|installReplyKeyboard|showBottomKeyboard/);
 assert.deepEqual(replyKeyboard().keyboard.map(row=>row.map(x=>x.text)),[
   ['Выбрать расписание'],['Открыть приложение']
 ]);
 assert.equal(replyShortcut('Выбрать расписание'),'auto');
});

test('both UIs get identical subgroup assignments after source confirmation',()=>{
 const teacher1='Ченушкина Светлана Владимировна';
 const teacher2='Шмакова Лариса Евгеньевна';
 const records=[{...base,teacher:teacher1,subgroup:''},{...base,teacher:teacher2,subgroup:'0'}];
 const rules=[{group:'ДГ-304',subject:'Веб-дизайн',teacher:teacher1,subgroup:'1'},
              {group:'Дг-304',subject:'Веб-дизайн',teacher:teacher2,subgroup:'2'}];
 assert.equal(withVerifiedSubgroup(records[0],rules).subgroup,'1');
 assert.equal(withVerifiedSubgroup(records[1],rules).subgroup,'2');
 const result=lessonsToCards(records.map(x=>withVerifiedSubgroup(x,rules)),'2026-11-10',{group:'Дг-304'})[0].items;
 assert.deepEqual(result.map(x=>[x.displaySubgroup,x.teacher]),[
  ['1 подгруппа',teacher1],['2 подгруппа',teacher2]
 ]);
 const rich=richScheduleDay(records.map(x=>withVerifiedSubgroup(x,rules)),'2026-11-10','Дг-304');
 assert.match(rich,/1 подгруппа/);
 assert.match(rich,/2 подгруппа/);
});

test('unknown subgroup 0 never implies official first subgroup',()=>{
 assert.equal(withVerifiedSubgroup({...base,teacher:'Шмакова Лариса Евгеньевна',subgroup:'0'},[]).subgroup,'0');
});

test('one-time mapping CLI requires confirmation and rejects conflicting reassignment',()=>{
 const temp=mkdtempSync(join(tmpdir(),'uspu-map-'));
 try {
  mkdirSync(join(temp,'scripts'),{recursive:true});
  mkdirSync(join(temp,'src/shared/lib'),{recursive:true});
  cpSync(join(root,'scripts/assign-subgroups.mjs'),join(temp,'scripts/assign-subgroups.mjs'));
  cpSync(join(root,'src/shared/lib/schedule-utils.mjs'),join(temp,'src/shared/lib/schedule-utils.mjs'));
  cpSync(join(root,'src/shared/lib/verified-subgroup-assignments.mjs'),join(temp,'src/shared/lib/verified-subgroup-assignments.mjs'));
  const args=['--group','Дг-304','--subject','Веб-дизайн','--first','Ченушкина Светлана Владимировна','--second','Шмакова Лариса Евгеньевна'];
  const run=(extra=[])=>spawnSync(process.execPath,[join(temp,'scripts/assign-subgroups.mjs'),...args,...extra],{encoding:'utf8'});
  assert.equal(run().status,2);
  assert.equal(run(['--confirmed']).status,0);
  const mapped=readFileSync(join(temp,'src/shared/lib/verified-subgroup-assignments.mjs'),'utf8');
  assert.match(mapped,/"subgroup": "1"/);
  assert.match(mapped,/"subgroup": "2"/);
  assert.equal(run(['--confirmed']).status,0);
  const flip=spawnSync(process.execPath,[join(temp,'scripts/assign-subgroups.mjs'),
      '--group','Дг-304','--subject','Веб-дизайн',
      '--first','Шмакова Лариса Евгеньевна','--second','Ченушкина Светлана Владимировна','--confirmed'],{encoding:'utf8'});
  assert.equal(flip.status,2);
 } finally {rmSync(temp,{recursive:true,force:true});}
});
