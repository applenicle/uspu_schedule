import { response, validKind, validId } from '@/lib/db';
import { readSchedule } from '@/lib/snapshot.mjs';
export const dynamic='force-dynamic';
export async function GET(request){
 const p=new URL(request.url).searchParams,kind=p.get('kind'),id=p.get('id');
 if(!validKind(kind,true)||!validId(id))return response({error:'Некорректный запрос'},400);
 try{
 const data=readSchedule(kind,id,p.get('exam')==='true');
 if(!data)return response({error:'Расписание отсутствует в каталоге'},404);
 return Response.json(data,{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=300','X-USPU-Cache':'SNAPSHOT'}});
 }catch{return response({error:'Снимок расписания недоступен'},503);}
}
