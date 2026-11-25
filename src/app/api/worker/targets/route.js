import {authorized,response} from '@/lib/db';
export async function GET(request){
 if(!authorized(request))return response({error:'Unauthorized'},401);
 return response({error:'Legacy worker disabled'},410);
}
