import {response,validKind,validId} from '@/lib/db';
export async function POST(request){
 let body;try{body=await request.json();}catch{return response({error:'Неверный JSON'},400);}
 if(!validKind(body?.kind,true)||!validId(body?.id))return response({error:'Неверные параметры'},400);
 return response({queued:false,mode:'snapshot'});
}
