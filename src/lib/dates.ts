export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(value: string): Date { return new Date(`${value}T12:00:00`); }
export function addDays(value: string, count: number): string {
  const date = parseDate(value); date.setDate(date.getDate() + count); return localDate(date);
}
export function startOfWeek(value: string): string {
  return addDays(value, -((parseDate(value).getDay() + 6) % 7));
}
export function dateLabel(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return parseDate(value).toLocaleDateString(undefined, options);
}
export function timeLabel(value: string): string {
  if (!value) return 'Any time';
  return new Date(`2000-01-01T${value}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export function friendlyDate(value: string, today = localDate()) {
  if (!value) return 'No date'; if (value === today) return 'Today';
  if (value === addDays(today, 1)) return 'Tomorrow'; return dateLabel(value);
}
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function dateTime(date: string, time: string): number { return new Date(`${date}T${time}`).getTime(); }
