import type { AppData, Task } from '../types';
import { addDays, dateLabel, localDate, parseDate, startOfWeek } from './dates';
export function dailyProgress(tasks: Task[], date: string) {
  const due = tasks.filter(t => t.kind !== 'note' && (t.date || (t.completedAt ? localDate(new Date(t.completedAt)) : localDate(new Date(t.createdAt)))) === date);
  const completed = due.filter(t => t.completedAt).length;
  return { total: due.length, completed, percent: due.length ? Math.round(completed / due.length * 100) : 0 };
}
export function weekProgress(tasks: Task[], date: string) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    return { date: day, label: dateLabel(day, { weekday: 'short' }), ...dailyProgress(tasks, day),
      finished: tasks.filter(t => t.kind !== 'note' && t.completedAt && localDate(new Date(t.completedAt)) === day).length };
  });
}
export function routineConsistency(data: AppData, start: string, end: string) {
  let expected = 0, completed = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    for (const routine of data.routines) {
      if (day < localDate(new Date(routine.createdAt)) || !routine.days.includes(parseDate(day).getDay())) continue;
      expected++;
      if (data.routineLogs.some(log => log.routineId === routine.id && log.date === day)) completed++;
    }
  }
  return { expected, completed, percent: expected ? Math.round(completed / expected * 100) : 0 };
}
