export const shortTeacher = name => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name || 'Не указан';
  return `${parts[0]} ${parts.slice(1).map(part => `${part[0]}.`).join(' ')}`;
};
export const shortRoom = input => String(input || 'Не указана')
  .replace(/^ГУК:\s*/i,'').replace(/^Кабинет\s*/i,'').replace(/^аудитория\s*/i,'')
  .replace(/^Ауд\.?\s*/i,'').trim();
export const keyFor = value => String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]/g,'');
