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

/** Keep each actual time slot separate. Never merge distinct timestamps into one lesson. */
function lessonBlock(card, kind) {
  const { main, items, time } = card;
  const category = lessonCategory(main.type);
  const slot = time[1] ? `${time[0]}–${time[1]}` : time[0];
  const subject = esc(main.subject || 'Занятие');
  const meta = items.map(item => {
    // Only source-confirmed subgroup numbers appear in messages.
    const subgroup = item.displaySubgroup ? `<b>${esc(item.displaySubgroup)}</b><br/>` : '';
    const name = kind === 'teacher' ? item.group : item.teacher;
    const glyph = kind === 'teacher' ? 'group' : 'teacher';
    const who = name ? `${richEmoji(glyph)} ${esc(name)}` : '';
    const where = item.room ? `${richEmoji('location')} ауд. ${esc(shortRoom(item.room))}` : '';
    return `<li>${subgroup}${who}${who && where ? '<br/>' : ''}${where}</li>`;
  }).join('');
  const people = meta ? `<ul>${meta}</ul>` : '';
  // RichMessage heading + quotation visually distinguish one period from the next.
  return `<h3>${esc(slot)}</h3><blockquote><p><b>${subject}</b></p><p>${esc(category.label)}</p>${people}</blockquote>`;
}

function dayHeading(day) {
  return `<h2>${esc(fullDate(day).toLocaleUpperCase('ru-RU'))}</h2>`;
}

export function richScheduleDay(lessons, day, title='', kind='group', {compact=false}={}) {
  const cards = lessonsToCards(lessons,day,kind==='group'?{group:title}:{});
  const header = compact ? dayHeading(day) :
    `<h2>${richEmoji('calendar')} ${esc(title||'Расписание УрГПУ')}</h2>${dayHeading(day)}`;
  if(!cards.length) return `${header}<p>Занятий нет.</p>`;
  let result=header;
  const budget=compact?25000:29000;
  for (const card of cards) {
    const block=lessonBlock(card,kind);
    if(bytes(result+block)>budget) {
      result+='<footer>Остальные занятия — в приложении.</footer>';
      break;
    }
    result+=(result===header?'':'<hr/>')+block;
  }
  return result;
}

export function richScheduleWeek(lessons,anchor,title='',kind='group') {
  const start=startOfWeek(anchor);
  let html=`<h2>${richEmoji('calendar')} Неделя · ${esc(title||'УрГПУ')}</h2>`;
  let found=false;
  for(let offset=0;offset<7;offset++) {
    const day=shiftISO(start,offset);
    const cards=lessonsToCards(lessons,day,kind==='group'?{group:title}:{});
    if(!cards.length) continue;
    const heading=`<hr/>${dayHeading(day)}`;
    if (bytes(html+heading)>30000) break;
    html+=heading;
    for(const card of cards) {
      const item=lessonBlock(card,kind);
      if(bytes(html+item)>30000) {
        html+='<footer>Продолжение — в приложении.</footer>';
        return html;
      }
      html+=item;
    }
    found=true;
  }
  return found ? html : `${html}<p>На этой неделе занятий нет.</p>`;
}

export function richGreeting() {
  return `<h2>${richEmoji('calendar')} Расписание УрГПУ</h2>`+
    `<p><b>Как пользоваться</b></p>`+
    `<ol><li>Отправь название любой группы или ФИО преподавателя.</li>`+
    `<li>Если совпадений несколько — выбери нужное расписание кнопкой.</li>`+
    `<li>Переключай дни и недели кнопками под расписанием.</li></ol>`+
    `<p>Чтобы выбрать другое расписание, используй кнопку внизу.</p>`;
}

export function richHelp() {
  return `<h2>${richEmoji('help')} Как пользоваться</h2>`+
    `<p>Отправь название любой группы или ФИО преподавателя, а затем переключай дни кнопками под сообщением.</p>`+
    `<p><b>Команды</b></p>`+
    `<ul><li><code>/search</code> — выбор расписания</li>`+
    `<li><code>/group ДГ-304</code> — группа</li>`+
    `<li><code>/teacher Шмакова</code> — преподаватель</li>`+
    `<li><code>/today ДГ-304</code> — сегодня</li>`+
    `<li><code>/tomorrow ДГ-304</code> — завтра</li>`+
    `<li><code>/week ДГ-304</code> — неделя</li>`+
    `<li><code>/start</code> — главное меню</li></ul>`+
    `<p>Если УрГПУ не обозначил номера параллельных подгрупп, номера 1/2 в приложении означают порядок отображения, а не подтверждённое распределение.</p>`;
}

export function richNotice(title,message) {
  return `<h3>${richEmoji('info')} ${esc(title)}</h3><p>${esc(message).replace(/\n/gu,'<br/>')}</p>`;
}

export function premiumButton(text,icon,action,style) {
  const button={text,icon_custom_emoji_id:(PREMIUM[icon]||PREMIUM.list).id,...action};
  if(style) button.style=style;
  return button;
}
