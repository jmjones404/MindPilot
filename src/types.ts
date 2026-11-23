export interface Exercise { name: string; sets: number; reps: string }
export type ItemKind = 'task' | 'reminder' | 'event' | 'note';
export interface CategoryDetails { description: string; subcategories: string[] }
export interface OrganizerPreference {
  match: string;
  matchMode: 'exact' | 'similar';
  category: string;
  subcategory: string;
  time: string;
  days: number[];
  source: 'manual' | 'correction';
}
export interface Task {
  id: string; title: string; category: string; date: string; time: string;
  duration: number; priority: boolean; completedAt: string | null;
  createdAt: string; notes: string; exercises?: Exercise[]; routineId?: string;
  kind?: ItemKind; subcategory?: string; sourceText?: string;
}
export interface Routine {
  id: string; name: string; kind: 'routine' | 'workout'; days: number[];
  time: string; duration: number; exercises: string[]; createdAt: string;
}
export interface Memory { id: string; kind: 'goal' | 'preference'; title: string; detail: string; rule?: OrganizerPreference }
export interface RoutineLog { id: string; routineId: string; date: string; name: string }
export interface Settings { name: string; theme: 'light' | 'dark' | 'system'; categories: string[]; categoryDetails?: Record<string, CategoryDetails> }
export interface AppData {
  version: 2; tasks: Task[]; routines: Routine[]; memories: Memory[];
  routineLogs: RoutineLog[]; settings: Settings;
}
export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'completedAt'>;
export const emptyData = (): AppData => ({
  version: 2, tasks: [], routines: [], memories: [], routineLogs: [],
  settings: { name: '', theme: 'system', categories: ['Personal', 'Work', 'Wellness', 'Home', 'Learning', 'Communication', 'Recreation', 'Education', 'Finance', 'Relationships', 'Travel'], categoryDetails: {} },
});
export const uid = () => crypto.randomUUID();

// Keep the database/store and every existing record. Old records acquire only
// additive defaults; a normal successful transaction persists the migration.
export function migrateData(value: unknown): AppData {
  if (value == null) return emptyData();
  const data = value as AppData;
  if (![1, 2].includes(data.version as number) || !Array.isArray(data.tasks) || !Array.isArray(data.routines) || !Array.isArray(data.memories) || !Array.isArray(data.routineLogs) || !Array.isArray(data.settings?.categories)) {
    throw new Error('This saved data format cannot be opened safely. Your records have not been replaced.');
  }
  const categories = [...data.settings.categories];
  // Extend the original defaults only. A deliberately customized list stays yours.
  if ((data.version as number) === 1 && categories.length === 5 && ['Personal', 'Work', 'Wellness', 'Home', 'Learning'].every(c => categories.includes(c))) {
    for (const category of emptyData().settings.categories) if (!categories.includes(category)) categories.push(category);
  }
  return { ...data, version: 2, tasks: data.tasks.map(t => ({ ...t, kind: t.kind ?? 'task', subcategory: t.subcategory ?? '' })), settings: { ...data.settings, categories, categoryDetails: data.settings.categoryDetails ?? {} } };
}

export function validateTask(task: TaskDraft) {
  if (!task.title.trim()) throw new Error('Give this activity a name.');
  if (task.title.length > 180) throw new Error('Keep the title under 180 characters.');
  if (!task.category.trim()) throw new Error('Choose a category.');
  if (task.kind && !['task', 'reminder', 'event', 'note'].includes(task.kind)) throw new Error('Choose a valid item type.');
  if (task.kind === 'note') return;
  if (task.time && !task.date) throw new Error('Choose a date for the start time.');
  if (task.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time)) throw new Error('Choose a valid start time.');
  if (task.date) {
    const parsed = new Date(`${task.date}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(task.date) || Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(task.date.slice(0, 4)) || parsed.getMonth() + 1 !== Number(task.date.slice(5, 7)) || parsed.getDate() !== Number(task.date.slice(8, 10))) throw new Error('Choose a valid date.');
  }
  if (!Number.isFinite(task.duration) || task.duration < 5 || task.duration > 1440) throw new Error('Duration must be between 5 and 1,440 minutes.');
  if (task.exercises?.some(e => !e.name.trim() || !Number.isInteger(e.sets) || e.sets < 1 || e.sets > 20 || !e.reps.trim())) throw new Error('Each exercise needs a name, 1–20 sets, and repetitions.');
}
