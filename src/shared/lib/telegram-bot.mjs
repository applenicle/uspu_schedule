import { shiftISO, startOfWeek, normalizeGroup } from './schedule-utils.mjs';
import { todayYekaterinburg } from './date.js';
import { formatTelegramDay, telegramEscape } from './telegram-format.mjs';
import { premiumButton as btn, PREMIUM } from './telegram-rich.mjs';
import { scheduleLink } from './schedule-link.mjs';

export const BOT_SITE = 'https://uspu-schedule.vercel.app/';

export const isTeacherQuery = query => !/\d/u.test(String(query)) && /[А-Яа-яЁё]/u.test(String(query));

/** Stateless parsing: no account, local bot profile or collection of chat IDs. */
export function parseBotCommand(input = '') {
  const text = String(input).trim().slice(0, 200);
  if (!text || /^(меню|расписание|\/start|\/menu)$/iu.test(text)) return {type:'help'};
  if (/^\/(?:help|commands)(?:@\w+)?$/iu.test(text)) return {type:'instructions'};
  const match = text.match(/^\/(start|help|menu|commands|search|group|teacher|today|tomorrow|week)(?:@\w+)?(?:\s+([\s\S]*))?$/iu);
  if (match) {
    const command = match[1].toLowerCase();
    const query = (match[2] || '').trim();
    if (['start','menu'].includes(command)) return {type:'help'};
    if (['help','commands'].includes(command)) return {type:'instructions'};
    if (!query) return {type:'missing',command};
    return {type:'schedule',kind:command==='search'?(isTeacherQuery(query)?'teacher':'group'):command==='teacher'?'teacher':'group', period:command==='tomorrow'?'tomorrow':command==='week'?'week':['group','search'].includes(command)?'next':'today', query};
  }
  if (/^\//u.test(text)) return {type:'help'};
  const teacher = text.match(/^(?:преподаватель|препод)\s*[:–-]?\s+(.+)$/iu);
  if (teacher) return {type:'schedule',kind:'teacher',period:'today',query:teacher[1]};
  const group = text.match(/^(?:группа|расписание)\s*[:–-]?\s+(.+)$/iu);
  if (group) return {type:'schedule',kind:'group',period:'next',query:group[1]};
  return {type:'schedule',kind:isTeacherQuery(text)?'teacher':'group',period:'next',query:text};
}

export function nextTeachingDate(lessons, today=todayYekaterinburg()) {
  const future = [...new Set((lessons||[]).map(l=>l.date).filter(d=>typeof d==='string'&&d>=today))].sort();
  return future[0]||today;
}
export function periodDate(period, today=todayYekaterinburg(), lessons=[]) {
  if (period==='tomorrow') return shiftISO(today,1);
  if (period==='next') return nextTeachingDate(lessons,today);
  return today;
}

// Kept for compatibility with existing HTML-read-only endpoint/tests.
export function renderTelegramWeek(lessons, start, name) {
  const prefix = `🗓 <b>Неделя · ${telegramEscape(name)}</b>`;
  let output=prefix;
  let shown=0;
  const weekStart=startOfWeek(start);
  for (let i=0;i<7;i++) {
    const day=shiftISO(weekStart,i);
    if (!lessons.some(x=>x.date===day)) continue;
    const block=formatTelegramDay(lessons,day,'').replace(/^📅 <b>Расписание УрГПУ<\/b>\n/u,'📅 ');
    if ((output+'\n\n'+block).length>3500) {output+='\n\n<i>Продолжение — на сайте.</i>';break;}
    output+='\n\n'+block;shown++;
  }
  return shown ? output : `${prefix}\n\nНа этой неделе занятий нет.`;
}

export function callbackData(kind,id,date) {
  const code=kind==='teacher'?'t':'g';
  const text=`s|${code}|${date}|${id}`;
  return Buffer.byteLength(text,'utf8')<=64?text:null;
}
export function parseCallbackData(raw='') {
  const match=String(raw).match(/^s\|(g|t)\|(\d{4}-\d{2}-\d{2})\|([^\r\n]{1,160})$/u);
  return match?{kind:match[1]==='t'?'teacher':'group',date:match[2],id:match[3]}:null;
}
export function weekCallbackData(kind,id,date='') {
  const code=kind==='teacher'?'t':'g';
  const text=date?`w|${code}|${date}|${id}`:`w|${code}|${id}`;
  return Buffer.byteLength(text,'utf8')<=64?text:null;
}
export function parseWeekCallback(raw='') {
  const m=String(raw).match(/^w\|(g|t)\|([^\r\n]{1,160})$/u);
  if(!m)return null;
  const contextual=m[2].match(/^(\d{4}-\d{2}-\d{2})\|(.+)$/u);
  return contextual?{kind:m[1]==='t'?'teacher':'group',id:contextual[2],date:contextual[1]}:
    {kind:m[1]==='t'?'teacher':'group',id:m[2]};
}
/** Compact, validated, stateless teacher-choice callbacks (<64 Telegram bytes). */
export function teacherChoiceCallbackData(id) {
  const text=String(id||'');
  return /^\d{1,15}$/u.test(text)?`p|${text}`:null;
}
export function parseTeacherChoiceData(raw='') {
  const match=String(raw).match(/^p\|(\d{1,15})$/u);
  return match?.[1]||null;
}

export function parseMenuCallback(raw='') {
  const m=String(raw).match(/^m\|(home|find|group|teacher|help)$/u);
  return m?.[1]||null;
}

/** ReplyKeyboardMarkup sits above the message composer, unlike inline buttons.
 *  Every label is an explicit action; no account/session state is required.
 */
export function replyKeyboard(site=BOT_SITE) {
  return {
    keyboard:[
      [
        {text:'Расписание группы',icon_custom_emoji_id:PREMIUM.group.id},
        {text:'Преподаватель',icon_custom_emoji_id:PREMIUM.teacher.id}
      ],
      [
        {text:'Сменить расписание',icon_custom_emoji_id:PREMIUM.search.id},
        {text:'Открыть приложение',icon_custom_emoji_id:PREMIUM.globe.id,web_app:{url:site},style:'success'}
      ]
    ],
    is_persistent:true,
    resize_keyboard:true,
    input_field_placeholder:'Группа или фамилия преподавателя'
  };
}

export function replyShortcut(text='') {
  const value=String(text).trim().toLocaleLowerCase('ru-RU');
  if(value==='расписание группы') return 'group';
  if(value==='преподаватель') return 'teacher';
  if(value==='сменить расписание') return 'auto';
  return null;
}

export function menuKeyboard(site=BOT_SITE) {
  return {inline_keyboard:[
    [btn('Выбрать расписание','search',{callback_data:'m|find'})],
    [btn('Открыть приложение','globe',{web_app:{url:site}},'success')]
  ]};
}
/** Different controls for day and week; never show a no-op Week button on a week. */
export function scheduleKeyboard(kind,id,date,site=BOT_SITE,today=todayYekaterinburg(),mode='day',label='') {
  const rows=[];
  if(mode==='week') {
    const anchor=startOfWeek(date);
    const prev=weekCallbackData(kind,id,shiftISO(anchor,-7));
    const next=weekCallbackData(kind,id,shiftISO(anchor,7));
    const day=callbackData(kind,id,anchor);
    if(prev&&next) rows.push([
      btn('Пред. неделя','back',{callback_data:prev}),
      btn('След. неделя','next',{callback_data:next})
    ]);
    if(day) rows.push([
      btn('К понедельнику','calendar',{callback_data:day}),
      btn('Другое расписание','search',{callback_data:'m|find'})
    ]);
  } else {
    const prev=callbackData(kind,id,shiftISO(date,-1));
    const next=callbackData(kind,id,shiftISO(date,1));
    const week=weekCallbackData(kind,id,date);
    if(prev&&next) rows.push([
      btn('Пред. день','back',{callback_data:prev}),
      btn('След. день','next',{callback_data:next})
    ]);
    if(week) rows.push([
      btn('Неделя','list',{callback_data:week}),
      btn('Другое расписание','search',{callback_data:'m|find'})
    ]);
  }
  rows.push([btn('Открыть приложение','globe',{web_app:{url:scheduleLink(site,kind,id,label)}},'success')]);
  return {inline_keyboard:rows};
}
export function greeting(site=BOT_SITE) {
  return {text:'<b>Расписание УрГПУ</b>\n\nОтправь название группы или фамилию преподавателя, например <code>дг304</code> или <code>Иванова</code>.',reply_markup:menuKeyboard(site)};
}

export function safeNormalizeGroup(name) {
  return normalizeGroup(name).slice(0,120);
}
