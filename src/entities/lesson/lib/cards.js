import { lessonCategory, splitTimes } from '../../../shared/lib/schedule-utils.mjs';
import { withVerifiedSubgroup } from '../../../shared/lib/subgroup-resolution.mjs';

/** Same subject/time/type = one slot, even when subgroup records differ. */
export function lessonsToCards(lessons, day) {
  const buckets = new Map();
  (lessons||[]).filter(x=>x.date===day).forEach(raw=>{
    const item=withVerifiedSubgroup(raw);
    const key = [item.time, item.subject, lessonCategory(item.type).key].join('||');
    if (!buckets.has(key)) buckets.set(key, []);
    if (!buckets.get(key).some(x=>[x.teacher,x.room,x.group,x.subgroup].join('|') === [item.teacher,item.room,item.group,item.subgroup].join('|'))) {
      buckets.get(key).push(item);
    }
  });
  return [...buckets.entries()].map(([key,items])=>({key,items, main:items[0], time:splitTimes(items[0].time)}))
    .sort((a,b)=>a.time[0].localeCompare(b.time[0])||a.main.subject.localeCompare(b.main.subject));
}
