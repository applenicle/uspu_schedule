import { normalizeTeacherName } from './schedule-utils.mjs';

/** A schedule may contain abbreviated FIO, while the catalogue contains full names. */
export function teacherSurname(value) {
  return String(value || '').trim().split(/\s+/)[0] || '';
}
export function matchingTeachers(value, catalogue = []) {
  const normalized = normalizeTeacherName(value);
  const tokens = normalized.replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return catalogue.filter(item => {
    const parts = normalizeTeacherName(item.label).replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
    return parts[0] === tokens[0] && tokens.slice(1).every((token,index)=>parts[index+1]?.startsWith(token));
  });
}
export function uniqueTeacherMatch(value, catalogue = []) {
  const exact = catalogue.filter(item => normalizeTeacherName(item.label) === normalizeTeacherName(value));
  if (exact.length === 1) return exact[0];
  const matches = matchingTeachers(value, catalogue);
  return matches.length === 1 ? matches[0] : null;
}
