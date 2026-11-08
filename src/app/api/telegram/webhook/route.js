import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { todayYekaterinburg } from '@/shared/lib/date';
import { parseBotCommand, periodDate, parseCallbackData, parseWeekCallback, parseMenuCallback, menuKeyboard, scheduleKeyboard, BOT_SITE, safeNormalizeGroup } from '@/shared/lib/telegram-bot.mjs';
import { richScheduleDay, richScheduleWeek, richGreeting, richHelp, richNotice, premiumButton, withoutPremium } from '@/shared/lib/telegram-rich.mjs';
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
class TelegramApiError extends Error {
  constructor(status,description) {
    super(`Bot API ${status}: ${String(description).slice(0,200)}`);
    this.status=status;
    this.description=description;
  }
}
async function telegram(method,data) {
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const res=await fetch(`https://api.telegram.org/bot${token}/${method}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)
  });
  const payload=await res.json().catch(()=>({ok:false,description:'Invalid Bot API response'}));
  if(!res.ok||!payload.ok) throw new TelegramApiError(res.status,payload.description||'API rejected');
  return payload;
}
function removePremiumFields(data) {
  const body=structuredClone(data);
  if(body.rich_message?.html) body.rich_message.html=withoutPremium(body.rich_message.html);
  for(const row of (body.reply_markup?.inline_keyboard||[])) {
    for(const button of row) delete button.icon_custom_emoji_id;
  }
  return body;
}
async function safeTelegram(method,data) {
  try {return await telegram(method,data);}
  catch(error) {
    if(error.status!==400 || !/custom.?(emoji|icon)|emoji.?id|emoji.*not allowed|premium/i.test(error.description||'')) throw error;
    // Premium ownership requirement not met: retain Rich Messages, omit only custom icons.
    return telegram(method,removePremiumFields(data));
  }
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
  // Save only an interested schedule, never the Telegram user's profile or chat ID.
  await sql`INSERT INTO interests(kind,id,exam,requested_at) VALUES (${kind},${id},false,now())
    ON CONFLICT(kind,id,exam) DO UPDATE SET requested_at=now()`;
  const rows=await sql`SELECT payload,source_updated FROM schedules WHERE kind=${kind} AND id=${id} AND exam=false LIMIT 1`;
  const url=origin();
  if(!rows.length) return {
    html:richNotice('Расписание загружается','Сборщик получает данные УрГПУ. Повтори запрос немного позже.'),
    reply_markup:menuKeyboard(url)
  };
  const lessons=Array.isArray(rows[0].payload)?rows[0].payload:[];
  const today=todayYekaterinburg();
  const date=forcedDate||periodDate(period,today,lessons);
  const title=label||id;
  const html=period==='week'&&!forcedDate?richScheduleWeek(lessons,today,title,kind):richScheduleDay(lessons,date,title,kind);
  const source=rows[0].source_updated ? `<footer>Обновлено в УрГПУ: ${escapeText(rows[0].source_updated)}</footer>` : '';
  return {html:html+source,reply_markup:scheduleKeyboard(kind,id,date,url,today)};
}
function escapeText(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
async function sendRich(chatId,content,editId) {
  const data={chat_id:chatId,rich_message:{html:content.html},...(content.reply_markup?{reply_markup:content.reply_markup}:{})};
  if(editId) {
    try {return await safeTelegram('editMessageText',{...data,message_id:editId});}
    catch(error) {
      if(error.status===400 && /message is not modified/i.test(error.description||'')) return;
      // Non-editable previous message (legacy bot / inaccessible): send a new rich message instead.
      if(error.status!==400 || !/can't be edited|there is no text|message to edit not found/i.test(error.description||'')) throw error;
    }
  }
  return safeTelegram('sendRichMessage',data);
}
async function prompt(chatId,kind) {
  const isTeacher=kind==='teacher';
  await telegram('sendMessage',{
    chat_id:chatId,
    text:isTeacher?'Поиск преподавателя\n\nНапиши ФИО преподавателя в ответ на это сообщение.':
      'Поиск группы\n\nНапиши название группы (например, ДГ-304) в ответ на это сообщение.',
    reply_markup:{force_reply:true,input_field_placeholder:isTeacher?'Фамилия Имя Отчество':'Например, дг304',selective:true}
  });
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
    let editId=null;
    if(callback) {
      await telegram('answerCallbackQuery',{callback_query_id:callback.id});
      const menu=parseMenuCallback(callback.data);
      if(menu==='group'||menu==='teacher') {
        await prompt(chat.id,menu);
        return ok();
      }
      if(menu==='home') content={html:richGreeting(),reply_markup:menuKeyboard(origin())};
      else if(menu==='help') content={html:richHelp(),reply_markup:menuKeyboard(origin())};
      else {
        const day=parseCallbackData(callback.data);
        const week=parseWeekCallback(callback.data);
        if(!day&&!week) return ok();
        const choice=day||week;
        content=await timetable(db(),choice.kind,choice.id,week?'week':'today',day?.date||null,choice.id);
      }
      if(callback.message?.message_id) editId=callback.message.message_id;
    } else if(typeof message?.text==='string') {
      let parsed=parseBotCommand(message.text);
      // The ForceReply prompt identifies the kind without user accounts or server-side state.
      const repliedTo=message.reply_to_message?.text||'';
      if(repliedTo.startsWith('Поиск преподавателя') && !message.text.startsWith('/')) parsed={type:'schedule',kind:'teacher',period:'today',query:message.text.trim()};
      else if(repliedTo.startsWith('Поиск группы') && !message.text.startsWith('/')) parsed={type:'schedule',kind:'group',period:'next',query:message.text.trim()};
      if(parsed.type==='help') content={html:richGreeting(),reply_markup:menuKeyboard(origin())};
      else if(parsed.type==='missing') {
        await prompt(chat.id,parsed.command==='teacher'?'teacher':'group');
        return ok();
      } else {
        const sql=db();
        const found=await findCatalog(sql,parsed.kind,parsed.query);
        if(found.item) content=await timetable(sql,parsed.kind,found.item.id,parsed.period,null,found.item.label);
        else if(found.choices) content={html:richNotice('Уточни преподавателя',`Есть несколько совпадений. Напиши полное ФИО или ID:\n${found.choices.map(x=>`${x.label} — /teacher ${x.id}`).join('\n')}`),reply_markup:menuKeyboard(origin())};
        else content={html:richNotice('Не найдено','Проверь название группы или ФИО преподавателя.'),reply_markup:menuKeyboard(origin())};
      }
    } else return ok();
    await sendRich(chat.id,content,editId);
    return ok();
  }catch(error) {
    console.error('Telegram rich webhook failed:',String(error?.message||'error').replace(/\d{7,}/g,'[redacted]'));
    return Response.json({error:'Temporarily unavailable'},{status:500});
  }
}
