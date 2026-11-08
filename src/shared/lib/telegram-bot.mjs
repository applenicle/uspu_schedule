import { shiftISO, startOfWeek, normalizeGroup } from './schedule-utils.mjs';
import { todayYekaterinburg } from './date.js';
import { formatTelegramDay, telegramEscape } from './telegram-format.mjs';

export const BOT_SITE = 'https://uspu-schedule.vercel.app/';

/** No Telegram account matching or user storage: a command always contains its schedule. */
export function parseBotCommand(input = '') {
  const text = String(input).trim().slice(0, 200);
  if (!text) return {type:'help'};
  const match = text.match(/^\/(start|help|group|teacher|today|tomorrow|week)(?:@\w+)?(?:\s+([\s\S]*))?$/iu);
  if (match) {
    const command = match[1].toLowerCase();
    const query = (match[2] || '').trim();
    if (['start','help'].includes(command)) return {type:'help'};
    if (!query) return {type:'missing',command};
    return {type:'schedule',kind:command==='teacher'?'teacher':'group', period:command==='tomorrow'?'tomorrow':command==='week'?'week':command==='group'?'next':'today', query};
  }
  if (/^\//u.test(text)) return {type:'help'};
  return {type:'schedule',kind:'group',period:'next',query:text.replace(/^расписание\s+/iu,'')};
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
export function scheduleKeyboard(kind,id,date,site=BOT_SITE) {
  const prev=callbackData(kind,id,shiftISO(date,-1));
  const next=callbackData(kind,id,shiftISO(date,1));
  const rows=[];
  if(prev&&next) rows.push([{text:'‹ Предыдущий день',callback_data:prev},{text:'Следующий день ›',callback_data:next}]);
  rows.push([{text:'🌐 Открыть расписание',url:site}]);
  return {inline_keyboard:rows};
}

export function greeting(site=BOT_SITE) {
  return {
    text:'📚 <b>Расписание УрГПУ</b>\n\nНапиши название группы — например, <code>дг304</code>.\n\n<b>Команды:</b>\n/group ДГ-304 — ближайший день с занятиями\n/today ДГ-304 — сегодня\n/tomorrow ДГ-304 — завтра\n/week ДГ-304 — вся неделя\n/teacher Иванова Анна Сергеевна — преподаватель\n\nРегистрация не требуется.',
    reply_markup:{inline_keyboard:[[{text:'🌐 Открыть приложение',url:site}]]}
  };
}

export function safeNormalizeGroup(name) {
  return normalizeGroup(name).slice(0,120);
}
