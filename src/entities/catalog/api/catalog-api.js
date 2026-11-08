export async function queryCatalog(kind, q = '', signal) {
  const response = await fetch(`/api/catalog?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(q)}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Справочник пока недоступен');
  return (await response.json()).items ?? [];
}
