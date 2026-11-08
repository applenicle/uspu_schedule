export const shortTeacher = name => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name || 'Не указан';
  return `${parts[0]} ${parts.slice(1).map(part => `${part[0]}.`).join(' ')}`;
};
/** Compact room label for cards; preserve the unabridged source in title/aria-label. */
export const shortRoom = input => {
  const cleaned=String(input || 'Не указана').trim()
    .replace(/^ГУК:\s*/i,'').replace(/^Кабинет\s*/i,'').replace(/^аудитория\s*/i,'')
    .replace(/^Ауд\.?\s*/i,'').trim();
  // Official responses often append a lengthy room description after the code.
  // e.g. "11-309, Учебная аудитория декоративно-прикладного искусства".
  const roomCode=cleaned.match(/^(?:[А-ЯA-Z]{1,5}\s+)?(\d{1,3}-\d{1,4}|\d{2,5}[А-ЯA-Zа-яa-z]?)\b/u);
  if(roomCode) return roomCode[0].trim();
  const first=cleaned.split(/[,;\n]/,1)[0].trim();
  return first.length<=34 ? first : `${first.slice(0,32).trimEnd()}…`;
};
export const keyFor = value => String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]/g,'');
