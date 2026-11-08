import { db, response, validId } from '@/lib/db';
import { formatTelegramDay } from '@/shared/lib/telegram-format.mjs';
export const dynamic='force-dynamic';

/** A read-only formatter for a future Telegram bot integration; never sends messages itself. */
export async function GET(request) {
  const {searchParams} = new URL(request.url);
  const kind=searchParams.get('kind');
  const id=searchParams.get('id');
  const date=searchParams.get('date');
  if(!['group','teacher'].includes(kind) || !validId(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date||''))
    return response({error:'Некорректные параметры'},400);
  try {
    const sql=db();
    const result=await sql`SELECT payload FROM schedules WHERE kind=${kind} AND id=${id} AND exam=false LIMIT 1`;
    if(!result.length) return response({pending:true, parse_mode:'HTML', text:null});
    return response({pending:false, parse_mode:'HTML', text:formatTelegramDay(result[0].payload,date,id)});
  }catch(error){console.error('telegram format error:',error.message);return response({error:'Временно недоступно'},503);}
}
