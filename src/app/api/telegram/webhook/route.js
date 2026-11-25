import { timingSafeEqual } from 'node:crypto';
import { catalogItems, readSchedule } from '@/lib/snapshot.mjs';
import { todayYekaterinburg } from '@/shared/lib/date';
import { parseBotCommand, periodDate, parseCallbackData, parseWeekCallback, parseMenuCallback, menuKeyboard, replyKeyboard, replyShortcut, scheduleKeyboard, BOT_SITE, safeNormalizeGroup, parseTeacherChoiceData, teacherChoiceCallbackData, needsTeacherNameLookup, scheduleDisplayName } from '@/shared/lib/telegram-bot.mjs';
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
  for(const row of [...(body.reply_markup?.inline_keyboard||[]),...(body.reply_markup?.keyboard||[])]) {
    for(const button of row) if(button&&typeof button==='object') delete button.icon_custom_emoji_id;
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
    const exact=catalogItems('group').filter(x=>safeNormalizeGroup(x.label)===normalized).slice(0,2);
    if(exact.length===1) return {item:exact[0]};
    if(exact.length>1) return {choices:exact};
    return {notFound:true};
  }
  if (/^\d{1,15}$/.test(query)) {
    const exact=catalogItems('teacher').filter(x=>x.id===query).slice(0,1);
    return exact.length?{item:exact[0]}:{notFound:true};
  }
  const surname=query.split(/\s+/u)[0].toLocaleLowerCase('ru').replace(/ё/g,'е');
  const rows=catalogItems('teacher').filter(x=>x.label.toLocaleLowerCase('ru').replace(/ё/g,'е').startsWith(surname)).slice(0,40);
  if(!rows.length) return {notFound:true};
  const match=uniqueTeacherMatch(query,rows);
  if(match) return {item:match};
  const exact=rows.filter(r=>r.label.localeCompare(query,'ru',{sensitivity:'base'})===0);
  if(exact.length===1) return {item:exact[0]};
  return {choices:rows.slice(0,6)};
}

async function timetable(sql,kind,id,period,forcedDate,label) {
  const data=readSchedule(kind,id,false);
  const url=origin();
  if(!data?.cached) return {html:richNotice('Расписание недоступно','УрГПУ пока не предоставил данные или первичный сбор ещё не завершён.'),reply_markup:menuKeyboard(url)};
  const lessons=data.lessons;
  const today=todayYekaterinburg();
  const date=forcedDate||periodDate(period,today,lessons);
  // Calendar callbacks carry numeric teacher IDs, not display names.
  // Resolve the human-readable FIO every time a callback lacks its label.
  let catalogLabel='';
  if (needsTeacherNameLookup(kind,id,label)) {
    const teacher=catalogItems('teacher').filter(x=>x.id===id).slice(0,1);
    catalogLabel=teacher[0]?.label || '';
  }
  const title=scheduleDisplayName(kind,id,label,catalogLabel);
  const html=period==='week'?richScheduleWeek(lessons,forcedDate||today,title,kind):richScheduleDay(lessons,date,title,kind);
  return {html,reply_markup:scheduleKeyboard(kind,id,date,url,today,period==='week'?'week':'day',title)};
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
/** One /start reply installs the keyboard. Telegram keeps it for later messages. */
async function welcome(chatId) {
  return safeTelegram('sendRichMessage',{
    chat_id:chatId,
    rich_message:{html:richGreeting()},
    reply_markup:replyKeyboard(origin())
  });
}

async function prompt(chatId,kind) {
  const isTeacher=kind==='teacher';
  await telegram('sendMessage',{
    chat_id:chatId,
    text:kind==='auto'?'Введи название группы или ФИО преподавателя:':isTeacher?
      'Напиши фамилию преподавателя.':'Напиши название группы.',
    reply_markup:{force_reply:true,input_field_placeholder:kind==='auto'?'ДГ-304 или Иванова':isTeacher?'Фамилия Имя Отчество':'Например, дг304',selective:true}
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
      const menu=parseMenuCallback(callback.data);
      const weekAction=parseWeekCallback(callback.data);
      await telegram('answerCallbackQuery',{
        callback_query_id:callback.id,
        ...(weekAction?{text:'Открываю неделю'}:{})
      });
      if(menu==='find'||menu==='group'||menu==='teacher') {
        // After a new search, old day/week controls must not navigate an old selection.
        if(callback.message?.message_id) {
          try {
            await telegram('editMessageReplyMarkup',{
              chat_id:chat.id,message_id:callback.message.message_id,
              reply_markup:{inline_keyboard:[]}
            });
          }catch(error) {
            console.warn('Unable to clear old schedule buttons:',error?.status||'unknown');
          }
        }
        await prompt(chat.id,menu==='find'?'auto':menu);
        return ok();
      }
      if(menu==='home') {await welcome(chat.id);return ok();}
      else if(menu==='help') content={html:richHelp(),reply_markup:menuKeyboard(origin())};
      else if(parseTeacherChoiceData(callback.data)) {
        const sql=null;
        const found=await findCatalog(sql,'teacher',parseTeacherChoiceData(callback.data));
        content=found.item
          ?await timetable(sql,'teacher',found.item.id,'next',null,found.item.label)
          :{html:richNotice('Не найдено','Преподаватель отсутствует в справочнике.'),reply_markup:menuKeyboard(origin())};
      }
      else {
        const day=parseCallbackData(callback.data);
        const week=weekAction;
        if(!day&&!week) return ok();
        const choice=day||week;
        content=await timetable(null,choice.kind,choice.id,week?'week':'today',day?.date||week?.date||null,choice.id);
      }
      // Weekly output is a new Rich Message with a dedicated weekly keyboard.
      // Re-editing the old day/menu message can appear as an ignored tap in clients.
      if(!weekAction&&callback.message?.message_id) editId=callback.message.message_id;
    } else if(typeof message?.text==='string') {
      const shortcut=replyShortcut(message.text);
      if(shortcut) {
        await prompt(chat.id,shortcut);
        return ok();
      }
      let parsed=parseBotCommand(message.text);
      // The ForceReply prompt identifies the kind without user accounts or server-side state.
      const repliedTo=message.reply_to_message?.text||'';
      if((repliedTo.startsWith('Поиск расписания')||repliedTo.startsWith('Какое расписание')||repliedTo.startsWith('Введи название группы или ФИО преподавателя')) && !message.text.startsWith('/')) parsed=parseBotCommand(message.text);
      else if((repliedTo.startsWith('Поиск преподавателя')||repliedTo.startsWith('Введи ФИО преподавателя')) && !message.text.startsWith('/')) parsed={type:'schedule',kind:'teacher',period:'today',query:message.text.trim()};
      else if((repliedTo.startsWith('Поиск группы')||repliedTo.startsWith('Введи название группы')) && !message.text.startsWith('/')) parsed={type:'schedule',kind:'group',period:'next',query:message.text.trim()};
      if(parsed.type==='help') {await welcome(chat.id);return ok();}
      else if(parsed.type==='instructions') content={html:richHelp(),reply_markup:menuKeyboard(origin())};
      else if(parsed.type==='missing') {
        await prompt(chat.id,parsed.command==='search'?'auto':parsed.command==='teacher'?'teacher':'group');
        return ok();
      } else {
        const sql=null;
        const found=await findCatalog(sql,parsed.kind,parsed.query);
        if(found.item) content=await timetable(sql,parsed.kind,found.item.id,parsed.period,null,found.item.label);
        else if(found.choices) {
          const rows=found.choices.map(item=>{
            const callback_data=teacherChoiceCallbackData(item.id);
            return callback_data?[premiumButton(item.label,'teacher',{callback_data})]:null;
          }).filter(Boolean);
          content={
            html:richNotice('Выберите преподавателя','Найдено несколько совпадений — нажмите на нужное ФИО.'),
            reply_markup:{inline_keyboard:[...rows,[premiumButton('Найти другое','search',{callback_data:'m|find'})]]}
          };
        }
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
