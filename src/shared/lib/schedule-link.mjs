/** Shared, privacy-friendly deep links. No Telegram login or user profile needed. */
const ALLOWED = new Set(['group', 'teacher', 'room']);

export function readScheduleLink(search = '') {
  try {
    const params = new URLSearchParams(String(search).replace(/^\?/, ''));
    const kind = params.get('kind');
    const id = params.get('id')?.trim();
    if (!ALLOWED.has(kind) || !id || id.length > 160 || /[\x00-\x1f]/u.test(id)) return null;
    const label = params.get('label')?.trim();
    return {kind, id, label:label && label.length <= 160 ? label : id};
  } catch {return null;}
}

export function scheduleLink(site, kind, id, label = '') {
  if (!ALLOWED.has(kind) || !String(id||'').trim()) return site;
  const url = new URL(site);
  url.searchParams.set('kind', kind);
  url.searchParams.set('id', String(id).trim());
  if (label && label !== id) url.searchParams.set('label', String(label).slice(0,160));
  else url.searchParams.delete('label');
  return url.toString();
}
