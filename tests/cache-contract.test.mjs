import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const load = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
test('public APIs and bot do not call Neon',()=>{
 for(const route of ['catalog','schedule','request','telegram/webhook','telegram/message','worker/targets','worker/ingest']){
   const source=load(`src/app/api/${route}/route.js`);
   assert.doesNotMatch(source,/\bdb\(|\bsql`|INSERT INTO|FROM schedules/);
 }
 assert.match(load('src/app/api/request/route.js'),/queued:false/);
 assert.match(load('src/app/api/worker/targets/route.js'),/410/);
 assert.doesNotMatch(load('src/fsd/pages/schedule/ui/schedule-page.jsx'),/setInterval|requestSchedule/);
});
test('read real compressed snapshots, normalize group queries and reject missing IDs',async()=>{
 const old=process.cwd(),dir=mkdtempSync(join(tmpdir(),'uspu-snapshot-'));
 try{
  const data=join(dir,'schedule-data');mkdirSync(data);process.chdir(dir);
  const dump=(name,object)=>writeFileSync(join(data,name),gzipSync(JSON.stringify(object)));
  dump('catalog.json.gz',{items:[{kind:'group',id:'Дг-304',label:'Дг-304'},{kind:'teacher',id:'123',label:'Петров Пётр'}]});
  const key=createHash('sha256').update(JSON.stringify(['group','Дг-304',false])).digest('hex');
  dump(key+'.json.gz',{cached:true,pending:false,lessons:[{subgroup:'2'}]});
  const {readSchedule,searchCatalog}=await import('../src/lib/snapshot.mjs');
  assert.equal(searchCatalog('group','дг 304')[0].id,'Дг-304');
  assert.equal(searchCatalog('teacher','петров')[0].id,'123');
  assert.equal(readSchedule('group','Дг-304').lessons[0].subgroup,'2');
  assert.equal(readSchedule('group','../x'),null);
 }finally{process.chdir(old);rmSync(dir,{recursive:true,force:true});}
});
