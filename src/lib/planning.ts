import { uid, type AppData, type Task, type TaskDraft } from '../types';
import { dateTime } from './dates';
export function conflicts(draft: Pick<TaskDraft, 'date' | 'time' | 'duration' | 'kind'>, tasks: Task[], excludeId?: string): Task[] {
  if (draft.kind === 'note' || !draft.date || !draft.time) return [];
  const start = dateTime(draft.date, draft.time), end = start + draft.duration * 60_000;
  return tasks.filter(task => {
    if (task.kind === 'note' || task.id === excludeId || !task.date || !task.time || task.completedAt) return false;
    const other = dateTime(task.date, task.time);
    return start < other + task.duration * 60_000 && end > other;
  });
}
export function nextFreeSlot(date: string, time: string, duration: number, tasks: Task[]): string | null {
  const start = dateTime(date, time);
  for (let n = 0; n < 96; n++) {
    const candidate = new Date(start + n * 15 * 60_000);
    const end = new Date(candidate.getTime() + duration * 60_000);
    if (candidate.getDate() !== new Date(start).getDate() || end.getDate() !== candidate.getDate()) return null;
    const value = `${String(candidate.getHours()).padStart(2, '0')}:${String(candidate.getMinutes()).padStart(2, '0')}`;
    if (!conflicts({ date, time: value, duration }, tasks).length) return value;
  }
  return null;
}

// Called inside the existing storage transaction, after explicit review approval.
export function approveRoutine(draft: TaskDraft, state: AppData): TaskDraft {
  const {saveAsRoutine, ...approved} = draft;
  if (draft.kind === 'note' || !saveAsRoutine || !draft.recurrence) return approved;
  const days = [...draft.recurrence.days].sort();
  const existing = state.routines.find(r => r.name === draft.title && r.time === draft.time && r.duration === draft.duration && [...r.days].sort().join() === days.join());
  const routineId = existing?.id ?? uid();
  if (!existing) state.routines.push({id:routineId,name:draft.title,kind:'routine',days,time:draft.time,duration:draft.duration,exercises:[],createdAt:new Date().toISOString()});
  return {...approved,routineId};
}
