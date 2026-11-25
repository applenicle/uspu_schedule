import { response, validKind } from '@/lib/db';
import { searchCatalog } from '@/lib/snapshot.mjs';
export const dynamic='force-dynamic';
export async function GET(request){
 const p=new URL(request.url).searchParams, kind=p.get('kind')||'group';
 if(!validKind(kind,true))return response({error:'Неверный тип справочника'},400);
 try{return Response.json({items:searchCatalog(kind,(p.get('q')||'').trim().slice(0,120))},{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=300'}});}
 catch{return response({error:'Снимок расписания недоступен'},503);}
}
