export const shortTeacher = name => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name || 'Не указан';
  return `${parts[0]} ${parts.slice(1).map(part => `${part[0]}.`).join(' ')}`;
};
/** Compact room label for cards; preserve the unabridged source in title/aria-label. */
export const shortRoom = input => {
  const source = String(input || '').trim();
  if (!source) return 'Не указана';
  if (/дистант|виртуальн/i.test(source)) return source;
  const room = source.match(/(?:^|[^\d])([МM]?\d{1,3}-\d{1,4}|\d{2,5}[А-Яа-яA-Za-z]?)(?=[^\d]|$)/u);
  const building = source.match(/(?:^|[\s,;])((?:УК|ГУК)\s*[МM]?\s*\d+)/iu);
  if (room) return `${room[1]}${building ? ' · ' + building[1].replace(/\s+/g,' ').trim() : ''}`;
  const cleaned = source.replace(/^ГУК:\s*/i,'').replace(/^Кабинет\s*/i,'')
    .replace(/^аудитория\s*/i,'').replace(/^Ауд\.?\s*/i,'').trim();
  const first = cleaned.split(/[,;\n]/,1)[0].trim();
  return first.length <= 34 ? first : `${first.slice(0,32).trimEnd()}…`;
};
export const keyFor = value => String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]/g,'');
