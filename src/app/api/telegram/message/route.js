import { response, validId } from '@/lib/db';
import { catalogItems, readSchedule } from '@/lib/snapshot.mjs';
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
    const data=readSchedule(kind,id,false);
    if(!data?.cached) return response({pending:false,unavailable:true,rich_message:null});
    const result=needsTeacherNameLookup(kind,id,id)?catalogItems('teacher').filter(x=>x.id===id):[];
    const title=scheduleDisplayName(kind,id,id,result[0]?.label);
    return response({pending:false,method:'sendRichMessage',rich_message:{html:richScheduleDay(data.lessons,date,title,kind)}});
  }catch(error){
    console.error('Telegram rich preview failed:',error.message);
    return response({error:'Временно недоступно'},503);
  }
}
