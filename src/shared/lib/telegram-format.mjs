import { lessonsToCards } from '../../entities/lesson/lib/cards.js';
import { lessonCategory } from './schedule-utils.mjs';
import { fullDate } from './date.js';
import { shortRoom } from './text.js';

const ICON = {lecture:'📘',practice:'🟠',lab:'🧪',exam:'🎓',seminar:'📝',other:'📚'};
export function telegramEscape(value) {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
/** Build Telegram Bot API HTML (not Markdown) for a single calendar day. */
export function formatTelegramDay(lessons, day, title = '') {
  const cards = lessonsToCards(lessons, day);
  const head = `📅 <b>${telegramEscape(title || 'Расписание УрГПУ')}</b>\n${telegramEscape(fullDate(day))}`;
  if (!cards.length) return `${head}\n\nНа этот день занятий нет.`;
  const blocks = cards.map(({main,time,items})=>{
    const kind = lessonCategory(main.type);
    const lines = [`${ICON[kind.key] || '📚'} <b>${telegramEscape(time[0]+'–'+time[1])} · ${telegramEscape(kind.label)}</b>`,
      `<b>${telegramEscape(main.subject)}</b>`];
    if(items.length > 1 || items.some(x=>x.subgroup)) {
      for (const [idx,item] of items.entries()) {
        const label = item.subgroup ? `${item.subgroup} подгруппа` : `Параллельное занятие ${idx+1}`;
        const person = item.teacher || item.group || '';
        lines.push(`• <b>${telegramEscape(label)}</b>: ${telegramEscape(person)} · ауд. ${telegramEscape(shortRoom(item.room))}`);
      }
    } else {
      if(main.teacher) lines.push(`👤 ${telegramEscape(main.teacher)}`);
      if(main.group) lines.push(`👥 ${telegramEscape(main.group)}`);
      if(main.room) lines.push(`📍 ауд. ${telegramEscape(shortRoom(main.room))}`);
    }
    return lines.join('\n');
  });
  // Telegram limits sendMessage text to 4096 characters *after* entity parsing.
  // Prefer a conservative single-message cap to prevent partial HTML tags.
  let result=head;
  for (const block of blocks) {
    if ((result+'\n\n'+block).length > 3700) {
      result += '\n\n<i>Остальные занятия доступны в приложении.</i>';
      break;
    }
    result += '\n\n'+block;
  }
  return result;
}
