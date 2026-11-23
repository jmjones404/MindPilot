import type { AppData, Routine, TaskDraft } from '../types';
import { localDate, parseDate, timeLabel, DAY_NAMES, dateTime } from '../lib/dates';
import { conflicts, nextFreeSlot } from '../lib/planning';
import { extractDuration } from './temporal';
export type WorkoutResult = { kind: 'question'; question: string; choices: Routine[] } | {
  kind: 'proposal'; draft: TaskDraft; facts: string[]; inferences: string[]; conflictNames: string[]; freeTime: string | null;
};
export function proposeWorkout(data: AppData, request: TaskDraft, now: Date, chosenId?: string): WorkoutResult {
  const date = request.date || localDate(now), weekday = parseDate(date).getDay();
  const workouts = data.routines.filter(r => r.kind === 'workout');
  const matches = workouts.filter(r => r.days.includes(weekday));
  const routine = chosenId ? workouts.find(r => r.id === chosenId) : matches.length === 1 ? matches[0] : undefined;
  if (!routine) return { kind: 'question', question: !workouts.length ? 'What workout, time, and exercises do you prefer? Save a workout in My Rhythm, then return here.' : matches.length > 1 ? `Which saved workout would you like for ${DAY_NAMES[weekday]}?` : `No workout is saved for ${DAY_NAMES[weekday]}. Which routine would you like to use this time?`, choices: matches.length ? matches : workouts };
  if (!routine.time || !routine.exercises.length) return { kind: 'question', question: `Add a preferred time and exercises to “${routine.name}” in My Rhythm, then try again.`, choices: [] };
  let time = request.time || routine.time;
  const duration = extractDuration(request.sourceText ?? '').span ? request.duration : routine.duration;
  const inferences = ['3 sets of 8–12 repetitions per exercise are a basic editable suggestion, not a saved preference or personalized training advice.'];
  if (request.time && dateTime(date, time) < now.getTime()) inferences.push('Your explicit start time has already passed. It is preserved for your review.');
  if (!request.time && dateTime(date, time) < now.getTime()) {
    if (date < localDate(now)) return { kind: 'question', question: 'That date has passed. Choose today or a future date for this workout.', choices: [] };
    const next = new Date(Math.ceil((now.getTime() + 15 * 60_000) / (15 * 60_000)) * 15 * 60_000);
    if (localDate(new Date(next.getTime() + duration * 60_000)) !== date) return { kind: 'question', question: 'There isn’t enough time left tonight for this routine. Choose tomorrow or another date.', choices: [] };
    time = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
    inferences.push('Your requested or preferred time has passed. The next quarter-hour with at least 15 minutes of lead time is proposed.');
  }
  const draft: TaskDraft = { ...request, title: routine.name, category: request.category, date, time, duration,
    routineId: routine.id, exercises: routine.exercises.map(name => ({ name, sets: 3, reps: '8–12' })),
    notes: `Based on your saved ${routine.name} routine. Sets and reps are editable suggestions.` };
  return { kind: 'proposal', draft,
    facts: [`Saved routine: ${routine.name} (${routine.days.map(day => DAY_NAMES[day]).join(', ')}).`, `Preferred time: ${timeLabel(routine.time)} · duration: ${routine.duration} minutes.`, 'Exercise names come from your saved routine.'],
    inferences, conflictNames: conflicts(draft, data.tasks).map(t => t.title), freeTime: nextFreeSlot(date, time, duration, data.tasks) };
}
