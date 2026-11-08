import { shiftISO } from './schedule-utils.mjs';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

export function todayYekaterinburg(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Yekaterinburg', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function partsOf(iso) {
  const date = new Date(`${iso}T12:00:00Z`);
  return { day: date.getUTCDate(), month: MONTHS[date.getUTCMonth()], weekday: DAYS[date.getUTCDay()] };
}
export function dateChip(iso) {
  const {weekday,day,month} = partsOf(iso);
  return { weekday, day, month };
}
export function fullDate(iso) {
  return new Intl.DateTimeFormat('ru-RU', {weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(`${iso}T12:00:00Z`));
}
export function dayRange(anchor, count = 5) { return Array.from({length:count}, (_,i)=>shiftISO(anchor,i)); }
export function monthShort(iso) { const {month}=partsOf(iso); return month; }
