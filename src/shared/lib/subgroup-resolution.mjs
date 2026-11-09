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


/** Only official or explicitly verified subgroup numbers are displayed.
 *  Missing or zero values are not evidence of subgroup 1 or 2.
 *  Parallel teachers remain separate in the UI and in Telegram.
 */
export function presentedSubgroups(items=[]) {
  return items.map(entry=>{
    const official=String(entry.subgroup||'');
    const confirmed=/^[1-9]\d*$/u.test(official);
    return {...entry,displaySubgroup:confirmed?`${official} подгруппа`:'',subgroupVerified:confirmed};
  });
}
