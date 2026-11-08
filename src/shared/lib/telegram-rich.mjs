/** Telegram Bot API 10.3 InputRichMessage HTML: not legacy sendMessage parse_mode. */
import { lessonsToCards } from '../../entities/lesson/lib/cards.js';
import { fullDate } from './date.js';
import { startOfWeek, shiftISO, lessonCategory } from './schedule-utils.mjs';
import { shortRoom } from './text.js';
import { telegramEscape as esc } from './telegram-format.mjs';

// Verified IDs from the Telegram iOS Icons (tgiosicons) premium emoji set.
// The emoji between the tags is the real alt glyph for accessibility/fallback.
export const PREMIUM = Object.freeze({
  calendar: {id:'5890937706803894250', alt:'📅'},
  group:    {id:'6032594876506312598', alt:'👥'},
  teacher:  {id:'6035084557378654059', alt:'👤'},
  search:   {id:'6032850693348399258', alt:'🔎'},
  location: {id:'6042011682497106307', alt:'📍'},
  clock:    {id:'5983150113483134607', alt:'⏰'},
  book:     {id:'5938195768832692153', alt:'🎓'},
  list:     {id:'5766994197705921104', alt:'🗂'},
  star:     {id:'6030425896546996257', alt:'⭐️'},
  info:     {id:'6028435952299413210', alt:'ℹ'},
  back:     {id:'5960671702059848143', alt:'⬅️'},
  next:     {id:'6037622221625626773', alt:'➡️'},
  globe:    {id:'5776233299424843260', alt:'🌐'},
  hello:    {id:'6041921818896372382', alt:'👋'},
  wait:     {id:'5891211339170326418', alt:'⌛️'},
  help:     {id:'6030848053177486888', alt:'❓'},
});

export function richEmoji(name) {
  const {id,alt}=PREMIUM[name]||PREMIUM.book;
  return `<tg-emoji emoji-id="${id}">${alt}</tg-emoji>`;
}

export function withoutPremium(html) {
  return String(html).replace(/<tg-emoji emoji-id="\d+">([^<]+)<\/tg-emoji>/gu,'$1');
}
const bytes=value=>Buffer.byteLength(value,'utf8');

function lessonBlock(card, kind) {
  const {main,items,time}=card;
  const category=lessonCategory(main.type);
  const displayTime=time[1]?`${time[0]}–${time[1]}`:time[0];
  const meta=[];
  for (const [index,item] of items.entries()) {
    // If source doesn't identify subgroup 1/2, do not invent one.
    const subgroup=item.subgroup?`<b>${esc(`${item.subgroup} подгруппа`)}</b><br/>`:'';
    const name=kind==='teacher'?item.group:item.teacher;
    const nameKey=kind==='teacher'?'group':'teacher';
    const person=name?`${richEmoji(nameKey)} ${esc(name)}<br/>`:'';
    const place=item.room?`${richEmoji('location')} ауд. ${esc(shortRoom(item.room))}`:'';
    meta.push(`<li>${subgroup}${person}${place}</li>`);
  }
  const subject=esc(main.subject||'Занятие');
  return `<h3>${subject}</h3><p>${richEmoji('clock')} ${esc(displayTime)} · ${esc(category.label)}</p><ul>${meta.join('')}</ul>`;
}

export function richScheduleDay(lessons, day, title='', kind='group', {compact=false}={}) {
  const cards=lessonsToCards(lessons,day);
  const heading=compact?`<h3>${esc(fullDate(day).toLocaleUpperCase('ru-RU'))}</h3>`:
    `<h2>${richEmoji('calendar')} ${esc(title||'Расписание УрГПУ')}</h2><p><b>${esc(fullDate(day))}</b></p>`;
  if(!cards.length) return `${heading}<p>На этот день занятий нет.</p>`;
  let html=heading;
  const max=compact?8500:23000;
  for(const card of cards) {
    const block=`<hr/>${lessonBlock(card,kind)}`;
    if(bytes(html+block)>max) {
      html+='<footer>Остальные занятия доступны в приложении.</footer>';
      break;
    }
    html+=block;
  }
  return html;
}

export function richScheduleWeek(lessons,anchor,title='',kind='group') {
  const start=startOfWeek(anchor);
  let html=`<h2>${richEmoji('calendar')} Неделя · ${esc(title||'УрГПУ')}</h2>`;
  let found=false;
  for(let offset=0;offset<7;offset++) {
    const day=shiftISO(start,offset);
    if(!lessons.some(x=>x.date===day)) continue;
    const block=richScheduleDay(lessons,day,'',kind,{compact:true});
    if(bytes(html+block)>24500) {
      html+='<footer>Продолжение расписания — на сайте.</footer>';
      break;
    }
    html+=`<hr/>${block}`;
    found=true;
  }
  return found?html:`${html}<p>На эту неделю занятий нет.</p>`;
}

export function richGreeting() {
  return `<h2>${richEmoji('calendar')} Расписание УрГПУ</h2>`+
    `<p>Выбери «Расписание группы» или «Преподаватели» в меню.</p>`+
    `<p>Можно просто отправить название группы: <code>дг304</code>.</p>`;
}

export function richHelp() {
  return `<h2>${richEmoji('help')} Как пользоваться</h2>`+
    `<p>Выбери раздел в меню и отправь группу или ФИО преподавателя.</p>`+
    `<h3>${richEmoji('list')} Команды</h3>`+
    `<ul><li><code>/group ДГ-304</code> — ближайшие занятия</li>`+
    `<li><code>/today ДГ-304</code> — сегодня</li>`+
    `<li><code>/tomorrow ДГ-304</code> — завтра</li>`+
    `<li><code>/week ДГ-304</code> — неделя</li>`+
    `<li><code>/teacher Фамилия Имя Отчество</code> — преподаватель</li></ul>`+
    `<p>Чтобы открыть календарь и поиск — выбери «Открыть приложение».</p>`;
}

export function richNotice(title,message) {
  return `<h3>${richEmoji('info')} ${esc(title)}</h3><p>${esc(message).replace(/\n/gu,'<br/>')}</p>`;
}

export function premiumButton(text,icon,action,style) {
  const button={text,icon_custom_emoji_id:(PREMIUM[icon]||PREMIUM.list).id,...action};
  if(style) button.style=style;
  return button;
}
