import { normalizeGroup, normalizeTeacherName } from './schedule-utils.mjs';

import { verifiedSubgroupAssignments } from './verified-subgroup-assignments.mjs';
export { verifiedSubgroupAssignments };

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
    (!rule.time||rule.time===record.time) &&
    /^[1-9]\d*$/u.test(String(rule.subgroup||''))
  );
  return match.length===1?{...record,subgroup:String(match[0].subgroup)}:record;
}


/** Display numbering in a GROUP view (not the teacher view).
 *
 * - A real subgroup (1/2) or a manually verified assignment always wins.
 * - Source `0` means no subgroup specified and is never treated as #1.
 * - Two unnumbered concurrent teachers for the same group/subject/time
 *   get STABLE PRESENTATION ORDINALS 1/2, based on teacher name, not source order.
 *   These ordinals are not university-confirmed assignments. Do not write them
 *   back into the upstream records, the database, or verified assignment rules.
 * - A single class with subgroup `0` has no subgroup badge.
 */
export function presentedSubgroups(items=[], {inferParallel=false}={}) {
  const numbered=items.map(row=>String(row.subgroup||'').trim());
  const known=new Set(numbered.filter(value=>/^[1-9]\d*$/u.test(value)));
  const unnumbered=items.map((row,index)=>({row,index})).filter(({index})=>
    !/^[1-9]\d*$/u.test(numbered[index]));
  // Only number two or more parallel records in the group schedule. Teacher
  // timetable rows may represent different groups, not student subgroups.
  const inferred=new Map();
  if(inferParallel && items.length>1) {
    const available=Array.from({length:items.length+known.size},(_,i)=>i+1)
      .filter(value=>!known.has(String(value)));
    unnumbered.sort((a,b)=>normalizeTeacherName(a.row.teacher).localeCompare(
      normalizeTeacherName(b.row.teacher),'ru') ||
      String(a.row.room||'').localeCompare(String(b.row.room||''),'ru'));
    unnumbered.forEach(({index},i)=>inferred.set(index,String(available[i])));
  }
  return items.map((entry,index)=>{
    const official=/^[1-9]\d*$/u.test(numbered[index]);
    const ordinal=official?numbered[index]:(inferred.get(index)||'');
    return {...entry,displaySubgroup:ordinal?`${ordinal} подгруппа`:'',
      subgroupVerified:official,subgroupInferred:!official&&Boolean(ordinal)};
  });
}
