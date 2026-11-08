/** Pure helpers shared by the API, browser UI and smoke tests. */
export const normalizeGroup = input => String(input || '')
  .normalize('NFKC').toUpperCase().replace(/Ё/g, 'Е')
  .replace(/[\s\u00a0\u200b\-_\u2010-\u2015]+/g, '');

export const normalizeTeacherName = input => String(input || '').normalize('NFKC')
  .toLowerCase().replace(/ё/g, 'е').replace(/[.\s]+/g, ' ').trim();

export function lessonCategory(type = '') {
  const t = String(type).toLowerCase().replace(/ё/g, 'е');
  if (/экзам|аттестац/.test(t)) return { key: 'exam', label: 'Экзамен' };
  if (/зачет/.test(t)) return { key: 'exam', label: 'Зачёт' };
  if (/лаборат|^лаб[.\s-]|лаб\.зан/.test(t)) return { key: 'lab', label: 'Лабораторная' };
  if (/семинар/.test(t)) return { key: 'seminar', label: 'Семинар' };
  if (/практ|практич/.test(t)) return { key: 'practice', label: 'Практика' };
  if (/лекц/.test(t)) return { key: 'lecture', label: 'Лекция' };
  if (/консультац/.test(t)) return { key: 'other', label: 'Консультация' };
  return { key: 'other', label: type ? String(type).trim() : 'Занятие' };
}

export function splitTimes(time = '') {
  const match = String(time).match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  return match ? [match[1], match[2]] : [time, ''];
}

export function groupSlots(lessons = [], day) {
  const relevant = lessons.filter(l => l.date === day);
  const byTime = new Map();
  for (const item of relevant) {
    const t = splitTimes(item.time).join('-');
    if (!byTime.has(t)) byTime.set(t, []);
    const bucket = byTime.get(t);
    const key = [item.subject, item.type, item.room, item.teacher, item.group, item.subgroup].join('|');
    if (!bucket.some(x => [x.subject, x.type, x.room, x.teacher, x.group, x.subgroup].join('|') === key)) {
      bucket.push(item);
    }
  }
  return [...byTime].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, items]) => ({ key, time: items[0].time, items }));
}

export function daysFrom(start, count) {
  return Array.from({ length: count }, (_, i) => shiftISO(start, i));
}

export function shiftISO(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeek(iso) {
  const n = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return shiftISO(iso, -(n === 0 ? 6 : n - 1));
}

/** Choose the closest upcoming teaching day so an empty Sunday never traps a first-time user. */
export function nearestTeachingDay(lessons, todayISO) {
  const future = [...new Set(lessons.map(x => x.date).filter(Boolean))]
    .filter(d => d >= todayISO).sort();
  return future[0] || todayISO;
}
