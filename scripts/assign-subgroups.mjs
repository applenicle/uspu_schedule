#!/usr/bin/env node
/** Explicitly confirmed subgroup-to-teacher map, shared across browser and Telegram. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { normalizeGroup, normalizeTeacherName } from '../src/shared/lib/schedule-utils.mjs';

const raw=process.argv.slice(2);
const args={};
for(let i=0;i<raw.length;i++) {
  const key=raw[i];
  if(key==='--confirmed'){args.confirmed=true;continue;}
  if(!['--group','--subject','--first','--second','--date','--time'].includes(key)||!raw[i+1]){
    console.error('Нужно: --group --subject --first --second --confirmed [--date] [--time]');
    process.exit(2);
  }
  args[key.slice(2)]=raw[++i].trim();
}
if(!args.confirmed||!args.group||!args.subject||!args.first||!args.second){
  console.error('STOP: номера подгрупп требуют двух подтверждённых преподавателей и флаг --confirmed.');
  process.exit(2);
}
if(args.first.length<5||args.second.length<5||normalizeTeacherName(args.first)===normalizeTeacherName(args.second)){
  console.error('STOP: укажи два разных полных ФИО.');process.exit(2);
}
if(args.date&&!/^\d{4}-\d{2}-\d{2}$/.test(args.date)){
  console.error('STOP: неверная дата, требуется YYYY-MM-DD');process.exit(2);
}
if(args.time&&!/^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}$/.test(args.time)){
  console.error('STOP: время HH:MM - HH:MM');process.exit(2);
}
const file=resolve(dirname(fileURLToPath(import.meta.url)),'../src/shared/lib/verified-subgroup-assignments.mjs');
const prefix='export const verifiedSubgroupAssignments = ';
const content=readFileSync(file,'utf8');
const offset=content.indexOf(prefix);
if(offset<0){console.error('STOP: неизвестный формат файла правил');process.exit(2);}
let records;
try{records=JSON.parse(content.slice(offset+prefix.length).trim().replace(/;$/,''));}catch{
 console.error('STOP: некорректный JSON в правилах');process.exit(2);
}
if(!Array.isArray(records)){console.error('STOP: ожидается массив');process.exit(2);}
const newRules=[
  {group:args.group,subject:args.subject,teacher:args.first,subgroup:'1'},
  {group:args.group,subject:args.subject,teacher:args.second,subgroup:'2'}
].map(x=>({...x,...(args.date?{date:args.date}:{}),...(args.time?{time:args.time}:{})}));
const sameScope=(a,b)=>normalizeGroup(a.group)===normalizeGroup(b.group) &&
  a.subject.toLocaleLowerCase('ru-RU')===b.subject.toLocaleLowerCase('ru-RU') &&
  (a.date||'')===(b.date||'') && (a.time||'')===(b.time||'');
const existing=records.filter(r=>newRules.some(v=>sameScope(r,v)));
if(existing.length){
  const identical=existing.length===2 && newRules.every(r=>existing.some(e=>
    normalizeTeacherName(e.teacher)===normalizeTeacherName(r.teacher)&&e.subgroup===r.subgroup));
  if(!identical){console.error('STOP: ранее подтверждённая пара отличается; проверь источник перед заменой.');process.exit(2);}
  console.log('Пара уже подтверждена; изменения не требуются.');process.exit(0);
}
records.push(...newRules);
writeFileSync(file,content.slice(0,offset)+prefix+JSON.stringify(records,null,2)+';\n');
console.log(`Подтверждены: ${args.group} · ${args.subject}`);
console.log('1 подгруппа:',args.first);
console.log('2 подгруппа:',args.second);
console.log('Осталось закоммитить файл и дождаться деплоя Vercel.');
