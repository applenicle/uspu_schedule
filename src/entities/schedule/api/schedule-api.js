export async function getSchedule(kind, id, signal) {
  const args = new URLSearchParams({kind,id});
  const response = await fetch(`/api/schedule?${args.toString()}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Не получилось загрузить расписание');
  return await response.json();
}
export async function requestSchedule(kind,id) {
  const response = await fetch('/api/request', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id})});
  if (!response.ok) throw new Error('Не удалось запросить обновление');
  return await response.json();
}
