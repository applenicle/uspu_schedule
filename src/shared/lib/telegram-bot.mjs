import { shiftISO, startOfWeek, normalizeGroup } from './schedule-utils.mjs';
import { todayYekaterinburg } from './date.js';
import { formatTelegramDay, telegramEscape } from './telegram-format.mjs';
import { premiumButton as btn } from './telegram-rich.mjs';

export const BOT_SITE = 'https://uspu-schedule.vercel.app/';

/** Stateless parsing: no account, local bot profile or collection of chat IDs. */
export function parseBotCommand(input = '') {
  const text = String(input).trim().slice(0, 200);
  if (!text || /^(меню|расписание|\/start|\/help)$/iu.test(text)) return {type:'help'};
  const match = text.match(/^\/(start|help|group|teacher|today|tomorrow|week)(?:@\w+)?(?:\s+([\s\S]*))?$/iu);
  if (match) {
    const command = match[1].toLowerCase();
    const query = (match[2] || '').trim();
    if (['start','help'].includes(command)) return {type:'help'};
    if (!query) return {type:'missing',command};
    return {type:'schedule',kind:command==='teacher'?'teacher':'group', period:command==='tomorrow'?'tomorrow':command==='week'?'week':command==='group'?'next':'today', query};
  }
  if (/^\//u.test(text)) return {type:'help'};
  const teacher = text.match(/^(?:преподаватель|препод)\s*[:–-]?\s+(.+)$/iu);
  if (teacher) return {type:'schedule',kind:'teacher',period:'today',query:teacher[1]};
  const group = text.match(/^(?:группа|расписание)\s*[:–-]?\s+(.+)$/iu);
  if (group) return {type:'schedule',kind:'group',period:'next',query:group[1]};
  return {type:'schedule',kind:'group',period:'next',query:text};
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
export function weekCallbackData(kind,id) {
  const code=kind==='teacher'?'t':'g';
  const text=`w|${code}|${id}`;
  return Buffer.byteLength(text,'utf8')<=64?text:null;
}
export function parseWeekCallback(raw='') {
  const m=String(raw).match(/^w\|(g|t)\|([^\r\n]{1,160})$/u);
  return m?{kind:m[1]==='t'?'teacher':'group',id:m[2]}:null;
}
export function parseMenuCallback(raw='') {
  const m=String(raw).match(/^m\|(home|group|teacher|help)$/u);
  return m?.[1]||null;
}

export function menuKeyboard(site=BOT_SITE) {
  return {inline_keyboard:[
    [btn('Расписание группы','calendar',{callback_data:'m|group'},'primary')],
    [btn('Преподаватели','teacher',{callback_data:'m|teacher'}),btn('Помощь','help',{callback_data:'m|help'})],
    [btn('Открыть приложение','globe',{web_app:{url:site}},'primary')],
  ]};
}
export function scheduleKeyboard(kind,id,date,site=BOT_SITE,today=todayYekaterinburg()) {
  const prev=callbackData(kind,id,shiftISO(date,-1));
  const next=callbackData(kind,id,shiftISO(date,1));
  const week=weekCallbackData(kind,id);
  const rows=[];
  if(prev&&next) rows.push([
    btn('Назад','back',{callback_data:prev}),
    btn('Вперёд','next',{callback_data:next})
  ]);
  const todayCb=callbackData(kind,id,today);
  const tomorrowCb=callbackData(kind,id,shiftISO(today,1));
  const modes=[];
  if(todayCb) modes.push(btn('Сегодня','calendar',{callback_data:todayCb},date===today?'primary':undefined));
  if(tomorrowCb) modes.push(btn('Завтра','clock',{callback_data:tomorrowCb}));
  if(week) modes.push(btn('Неделя','list',{callback_data:week}));
  if(modes.length) rows.push(modes);
  rows.push([btn('Меню','back',{callback_data:'m|home'}),btn('Приложение','globe',{web_app:{url:site}})]);
  return {inline_keyboard:rows};
}
export function greeting(site=BOT_SITE) {
  return {text:'📚 <b>Расписание УрГПУ</b>\n\nНапиши название группы — например, <code>дг304</code>.\n\n<b>Команды:</b>\n/group ДГ-304 — ближайший день с занятиями\n/today ДГ-304 — сегодня\n/tomorrow ДГ-304 — завтра\n/week ДГ-304 — вся неделя\n/teacher Иванова Анна Сергеевна — преподаватель\n\nРегистрация не требуется.',reply_markup:menuKeyboard(site)};
}
export function safeNormalizeGroup(name) {
  return normalizeGroup(name).slice(0,120);
}
