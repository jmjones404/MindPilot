import type { AppData, Task, TaskDraft } from '../types';
import { addDays, dateTime, localDate, parseDate } from '../lib/dates';
import { conflicts } from '../lib/planning';
import { preferenceMatch } from '../lib/preferences';
import { periodHours } from './temporal';

// Propose one first occurrence plus reusable routine days, never a series of tasks.
export function recommendSchedule(draft: TaskDraft, data: AppData, now: Date, dateMentioned: boolean, timeMentioned: boolean) {
  const explanations: string[] = [], warnings: string[] = [];
  if (draft.kind === 'note' || (!draft.preferredPeriod && !draft.recurrence) || draft.timeChoices?.length) return { explanations, warnings };
  if (!draft.date && dateMentioned) return { explanations, warnings };
  const days = draft.recurrence?.days ?? [0,1,2,3,4,5,6];
  const dates = draft.date ? [draft.date] : Array.from({length: 8}, (_, i) => addDays(localDate(now), i)).filter(d => days.includes(parseDate(d).getDay()));
  const [low, high] = draft.preferredPeriod ? periodHours[draft.preferredPeriod] : [7, 22];
  const matches = data.routines.filter(r => preferenceMatch(draft.title, r.name, 'similar') > 0);
  const preferred = matches.length === 1 ? matches[0].time : draft.preferredPeriod === 'afternoon' ? '14:00' : draft.preferredPeriod === 'evening' ? '18:00' : '08:00';
  const times = draft.time ? [draft.time] : timeMentioned && !draft.preferredPeriod ? [] : [...new Set([preferred, ...Array.from({length: (high-low)*4}, (_, i) => `${String(low + Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`)])].filter(t => t && Number(t.slice(0,2)) >= low && Number(t.slice(0,2))*60 + Number(t.slice(3)) + draft.duration <= high*60);
  const busyOn = (date: string) => [...data.tasks, ...data.routines.filter(r => r.id !== draft.routineId && !(matches.length === 1 && matches[0].id === r.id) && r.days.includes(parseDate(date).getDay())).map(r => ({ id:r.id, title:r.name, kind:'task', time:r.time, duration:r.duration, createdAt:r.createdAt, date, completedAt:null, category:'', notes:'', priority:false } as Task))];
  for (const date of dates) for (const time of times) {
    if (dateTime(date,time) < now.getTime() || conflicts({...draft,date,time}, busyOn(date)).length) continue;
    // Check the coming week's occurrences, not only the first day's availability.
    const following = draft.recurrence ? Array.from({length:7},(_,i)=>addDays(date,i)).filter(d=>days.includes(parseDate(d).getDay())) : [];
    if (following.some(d=>conflicts({...draft,date:d,time},busyOn(d)).length)) continue;
    draft.date = date; draft.time = time;
    explanations.push(`Suggested ${time} starting ${date}, considering saved activities and routines for the coming week. Review before confirming; later availability is not guaranteed.`);
    return {explanations,warnings};
  }
  warnings.push('No suitable free time was found in the requested window. Review the date/time; no recurring commitment has been created.');
  return {explanations,warnings};
}
