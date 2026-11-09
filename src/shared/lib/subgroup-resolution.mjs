import { normalizeGroup, normalizeTeacherName } from './schedule-utils.mjs';

/** Verified by a human or official source; initially intentionally empty.
 *  Never infer 1/2 from teacher order, class order or the source value 0.
 *  Example after independent confirmation:
 *  {group:'Дг-304',subject:'Веб-дизайн',teacher:'Фамилия Имя Отчество',subgroup:'1'}
 */
export const verifiedSubgroupAssignments = [];

function normal(value='') {
  return String(value).normalize('NFKC').toLocaleLowerCase('ru-RU')
    .replace(/ё/gu,'е').replace(/\s+/gu,' ').trim();
}

export function withVerifiedSubgroup(record, assignments=verifiedSubgroupAssignments) {
  if(/^[1-9]\d*$/u.test(String(record.subgroup||''))) return record;
  const match=assignments.filter(rule=>
    normalizeGroup(rule.group)===normalizeGroup(record.group) &&
    normal(rule.subject)===normal(record.subject) &&
    normalizeTeacherName(rule.teacher)===normalizeTeacherName(record.teacher) &&
    (!rule.date||rule.date===record.date) &&
    /^[1-9]\d*$/u.test(String(rule.subgroup||''))
  );
  return match.length===1?{...record,subgroup:String(match[0].subgroup)}:record;
}


/** Presentation-only labels. Never translate a missing/zero official subgroup
 *  to numeric 1 or 2: different teaching staff can swap between periods.
 *  Stable alphabetical labels identify the *parallel option* on that card.
 */
export function presentedSubgroups(items=[]) {
  const key = entry => [entry.teacher||'',entry.group||'',entry.room||'']
    .map(normal).join('|');
  const unknownKeys=[...new Set(items.filter(entry=>!(/^[1-9]\d*$/u.test(String(entry.subgroup||'')))).map(key))].sort((a,b)=>a.localeCompare(b,'ru'));
  const symbols=['А','Б','В','Г','Д','Е','Ж','З'];
  return items.map(entry=>{
    const official=String(entry.subgroup||'');
    if (/^[1-9]\d*$/u.test(official))
      return {...entry,displaySubgroup:`${official} подгруппа`,subgroupVerified:true};
    const index=unknownKeys.indexOf(key(entry));
    const suffix=symbols[index]||String(index+1);
    return {...entry,displaySubgroup:`Вариант ${suffix}`,subgroupVerified:false};
  });
}
