export interface Exercise { name: string; sets: number; reps: string }
export interface Task {
  id: string; title: string; category: string; date: string; time: string;
  duration: number; priority: boolean; completedAt: string | null;
  createdAt: string; notes: string; exercises?: Exercise[]; routineId?: string;
}
export interface Routine {
  id: string; name: string; kind: 'routine' | 'workout'; days: number[];
  time: string; duration: number; exercises: string[]; createdAt: string;
}
export interface Memory { id: string; kind: 'goal' | 'preference'; title: string; detail: string }
export interface RoutineLog { id: string; routineId: string; date: string; name: string }
export interface Settings { name: string; theme: 'light' | 'dark' | 'system'; categories: string[] }
export interface AppData {
  version: 1; tasks: Task[]; routines: Routine[]; memories: Memory[];
  routineLogs: RoutineLog[]; settings: Settings;
}
export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'completedAt'>;
export const emptyData = (): AppData => ({
  version: 1, tasks: [], routines: [], memories: [], routineLogs: [],
  settings: { name: '', theme: 'system', categories: ['Personal', 'Work', 'Wellness', 'Home', 'Learning'] },
});
export const uid = () => crypto.randomUUID();

export function validateTask(task: TaskDraft) {
  if (!task.title.trim()) throw new Error('Give this activity a name.');
  if (task.title.length > 180) throw new Error('Keep the title under 180 characters.');
  if (task.time && !task.date) throw new Error('Choose a date for the start time.');
  if (task.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time)) throw new Error('Choose a valid start time.');
  if (task.date) {
    const parsed = new Date(`${task.date}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(task.date) || Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(task.date.slice(0, 4)) || parsed.getMonth() + 1 !== Number(task.date.slice(5, 7)) || parsed.getDate() !== Number(task.date.slice(8, 10))) throw new Error('Choose a valid date.');
  }
  if (!Number.isFinite(task.duration) || task.duration < 5 || task.duration > 1440) throw new Error('Duration must be between 5 and 1,440 minutes.');
  if (task.exercises?.some(e => !e.name.trim() || !Number.isInteger(e.sets) || e.sets < 1 || e.sets > 20 || !e.reps.trim())) throw new Error('Each exercise needs a name, 1–20 sets, and repetitions.');
}
