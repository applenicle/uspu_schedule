import { db, response, validId } from '@/lib/db';
import { richScheduleDay } from '@/shared/lib/telegram-rich.mjs';
import { scheduleDisplayName, needsTeacherNameLookup } from '@/shared/lib/telegram-bot.mjs';
export const dynamic='force-dynamic';

/** Read-only preview for Telegram Bot API sendRichMessage; never sends a message. */
export async function GET(request) {
  const {searchParams} = new URL(request.url);
  const kind=searchParams.get('kind');
  const id=searchParams.get('id');
  const date=searchParams.get('date');
  if(!['group','teacher'].includes(kind) || !validId(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date||''))
    return response({error:'Некорректные параметры'},400);
  try {
    const sql=db();
    const rows=await sql`SELECT payload FROM schedules WHERE kind=${kind} AND id=${id} AND exam=false LIMIT 1`;
    if(!rows.length) return response({pending:true, rich_message:null});
    const result=needsTeacherNameLookup(kind,id,id)
      ?await sql`SELECT label FROM catalog WHERE kind='teacher' AND id=${id} LIMIT 1`
      :[];
    const title=scheduleDisplayName(kind,id,id,result[0]?.label);
    return response({pending:false,method:'sendRichMessage',rich_message:{html:richScheduleDay(rows[0].payload,date,title,kind)}});
  }catch(error){
    console.error('Telegram rich preview failed:',error.message);
    return response({error:'Временно недоступно'},503);
  }
}
