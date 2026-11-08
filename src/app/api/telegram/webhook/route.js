import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { todayYekaterinburg } from '@/shared/lib/date';
import { telegramEscape, formatTelegramDay } from '@/shared/lib/telegram-format.mjs';
import { parseBotCommand, periodDate, parseCallbackData, renderTelegramWeek, scheduleKeyboard, greeting, BOT_SITE, safeNormalizeGroup } from '@/shared/lib/telegram-bot.mjs';
import { uniqueTeacherMatch } from '@/shared/lib/teacher.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ok = () => Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
const origin = () => (process.env.PUBLIC_SITE_URL||BOT_SITE).replace(/\/$/,'') + '/';
function secretMatches(candidate, secret) {
  if (typeof candidate!=='string'||typeof secret!=='string') return false;
  const a=Buffer.from(candidate);const b=Buffer.from(secret);
  return a.length===b.length && a.length>0 && timingSafeEqual(a,b);
}
async function telegram(method,data) {
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const res=await fetch(`https://api.telegram.org/bot${token}/${method}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)
  });
  if(!res.ok) throw new Error(`Bot API ${method} HTTP ${res.status}`);
  const payload=await res.json();
  if(!payload.ok) throw new Error(`Bot API ${method} rejected`);
  return payload;
}
async function findCatalog(sql,kind,input) {
  const query=input.trim().slice(0,120);
  if (kind==='group') {
    const normalized=safeNormalizeGroup(query);
    const exact=await sql`
      SELECT id,label FROM catalog WHERE kind='group'
      AND regexp_replace(replace(upper(label),'Ё','Е'),'[-[:space:]_–—‑]','','g')=${normalized}
      LIMIT 2`;
    if(exact.length===1) return {item:exact[0]};
    if(exact.length>1) return {choices:exact};
    return {notFound:true};
  }
  if (/^\d{1,15}$/.test(query)) {
    const exact=await sql`SELECT id,label FROM catalog WHERE kind='teacher' AND id=${query} LIMIT 1`;
    return exact.length?{item:exact[0]}:{notFound:true};
  }
  // Search full/surname names; never silently choose an ambiguous teacher.
  const surname=query.split(/\s+/u)[0].replace(/[!%_]/g,c=>'!'+c);
  const rows=await sql`SELECT id,label FROM catalog WHERE kind='teacher' AND label ILIKE ${surname+'%'} ESCAPE '!' ORDER BY label LIMIT 40`;
  if(!rows.length) return {notFound:true};
  const match=uniqueTeacherMatch(query,rows);
  if(match) return {item:match};
  const exact=rows.filter(r=>r.label.localeCompare(query,'ru',{sensitivity:'base'})===0);
  if(exact.length===1) return {item:exact[0]};
  return {choices:rows.slice(0,6)};
}
async function timetable(sql,kind,id,period,forcedDate,label) {
  // Refresh active interest so the existing Russian worker can fetch or update the schedule.
  await sql`INSERT INTO interests(kind,id,exam,requested_at) VALUES (${kind},${id},false,now())
    ON CONFLICT(kind,id,exam) DO UPDATE SET requested_at=now()`;
  const rows=await sql`SELECT payload,source_updated FROM schedules WHERE kind=${kind} AND id=${id} AND exam=false LIMIT 1`;
  const url=origin();
  if(!rows.length) return {text:'⏳ <b>Расписание загружается.</b>\nСборщик получает данные УрГПУ. Попробуй команду снова через пару минут.',reply_markup:{inline_keyboard:[[{text:'🌐 Открыть сайт',url}]]}};
  const lessons=Array.isArray(rows[0].payload)?rows[0].payload:[];
  const today=todayYekaterinburg();
  const date=forcedDate||periodDate(period,today,lessons);
  const title=label||id;
  const text=period==='week'&&!forcedDate?renderTelegramWeek(lessons,today,title):formatTelegramDay(lessons,date,title);
  const stamp=rows[0].source_updated?`\n\n<i>Источник: ${telegramEscape(rows[0].source_updated)}</i>`:'';
  return {text:text.length+stamp.length<3900?text+stamp:text,
    reply_markup:scheduleKeyboard(kind,id,date,url)};
}

export async function POST(request) {
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if (!secret||!token) return Response.json({error:'Bot is not configured'},{status:503});
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'),secret))
    return Response.json({error:'Unauthorized'},{status:401});
  try {
    const raw=await request.text();
    if(raw.length>64000) return Response.json({error:'Request too large'},{status:413});
    const update=JSON.parse(raw);
    const message=update?.message;
    const callback=update?.callback_query;
    const chat=callback?.message?.chat||message?.chat;
    if(chat?.type!=='private'||!Number.isSafeInteger(chat.id)) return ok();
    let content;
    let replyMethod='sendMessage';
    if (callback) {
      const parsed=parseCallbackData(callback.data);
      if (!parsed) {await telegram('answerCallbackQuery',{callback_query_id:callback.id});return ok();}
      const sql=db();
      content=await timetable(sql,parsed.kind,parsed.id,'today',parsed.date,parsed.id);
      await telegram('answerCallbackQuery',{callback_query_id:callback.id});
      if(callback.message?.message_id) replyMethod='editMessageText';
    } else if (typeof message?.text==='string') {
      const parsed=parseBotCommand(message.text);
      if(parsed.type==='help') content=greeting(origin());
      else if(parsed.type==='missing') content={text:'Укажи группу или преподавателя после команды.\n\nПример: <code>/group ДГ-304</code>',reply_markup:greeting(origin()).reply_markup};
      else {
        const sql=db();
        const found=await findCatalog(sql,parsed.kind,parsed.query);
        if(found.item) content=await timetable(sql,parsed.kind,found.item.id,parsed.period,null,found.item.label);
        else if(found.choices) content={text:`Найдено несколько преподавателей. Уточни полное ФИО или ID:\n\n${found.choices.map(x=>`• ${telegramEscape(x.label)} · <code>/teacher ${telegramEscape(x.id)}</code>`).join('\n')}`};
        else content={text:'Ничего не нашлось. Проверь название группы или ФИО преподавателя.'};
      }
    } else return ok();
    const body={chat_id:chat.id,text:content.text,parse_mode:'HTML',link_preview_options:{is_disabled:true},...(content.reply_markup?{reply_markup:content.reply_markup}:{})};
    if (replyMethod==='editMessageText') body.message_id=callback.message.message_id;
    await telegram(replyMethod,body);
    return ok();
  }catch(error){
    console.error('Telegram schedule webhook failed:',error?.message?.replace(/\d{7,}/g,'[redacted]')||'error');
    return Response.json({error:'Temporarily unavailable'},{status:500});
  }
}
