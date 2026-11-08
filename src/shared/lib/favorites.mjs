/** Favorites are private to each browser profile. Show only the active entity type. */
export function favoritesForKind(favorites, kind) {
  if (!Array.isArray(favorites)) return [];
  return favorites.filter(item => item?.kind === kind && typeof item.id === 'string');
}
