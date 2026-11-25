import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { normalizeGroup } from '../shared/lib/schedule-utils.mjs';
const directory=()=>join(process.cwd(),'schedule-data');
const read=(name)=>JSON.parse(gunzipSync(readFileSync(join(directory(),name))));
let cachedCatalog;
export function catalog(){return cachedCatalog??=read('catalog.json.gz');}
export function catalogItems(kind){return catalog().items.filter(x=>x.kind===kind);}
const normalized=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
export function searchCatalog(kind,q=''){
  const norm=kind==='group'?normalizeGroup:normalized;
  const n=norm(q);
  const rank=x=>norm(x.label)===n?0:norm(x.label).startsWith(n)?1:2;
  return catalogItems(kind).filter(x=>norm(x.label).includes(n)).sort((a,b)=>rank(a)-rank(b)||a.label.localeCompare(b.label,'ru')).slice(0,50).map(({id,label})=>({id,label}));
}
export function readSchedule(kind,id,exam=false){
  const item=catalogItems(kind).find(x=>x.id===id);
  if(!item)return null;
  const name=createHash('sha256').update(JSON.stringify([kind,id,exam])).digest('hex')+'.json.gz';
  return read(name);
}
