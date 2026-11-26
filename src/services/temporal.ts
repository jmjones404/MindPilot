import { addDays, DAY_NAMES, localDate, parseDate } from '../lib/dates';
const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthPattern = monthNames.map(m => `${m}|${m.slice(0, 3)}\\.?`).join('|');
const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parseDate(date).getTime()) && localDate(parseDate(date)) === date;
const buildDate = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
export interface DateResult { date: string; explanation: string; mentioned: boolean; spans: string[]; warnings: string[] }
export function extractDate(text: string, now: Date): DateResult {
  const today = localDate(now), candidates: { date: string; span: string }[] = [], warnings: string[] = [];
  let mentioned = false;
  const add = (date: string, span: string) => { mentioned = true; if (valid(date)) candidates.push({ date, span }); else warnings.push(`“${span}” is not a valid date. Choose a date in review.`); };
  for (const match of text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) add(match[0], match[0]);
  const named = new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})(?:\\s+(\\d{4}))?\\b`, 'gi');
  for (const m of text.matchAll(named)) {
    const month = monthNames.findIndex(n => n.startsWith((m[1] || m[5]).toLowerCase().slice(0, 3))) + 1;
    const day = Number(m[2] || m[4]), explicitYear = m[3] || m[6];
    let year = Number(explicitYear || now.getFullYear());
    if (!explicitYear && buildDate(year, month, day) < today) year++;
    add(buildDate(year, month, day), m[0]);
  }
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)) {
    mentioned = true;
    const a = Number(m[1]), b = Number(m[2]);
    if (a <= 12 && b <= 12 && a !== b) { warnings.push(`“${m[0]}” could mean two dates. Spell out the month or choose a date.`); continue; }
    const month = a > 12 ? b : a, day = a > 12 ? a : b;
    let year = Number(m[3] || now.getFullYear());
    if (!m[3] && buildDate(year, month, day) < today) year++;
    add(buildDate(year, month, day), m[0]);
  }
  for (const m of text.matchAll(/\b(day after tomorrow|tomorrow|today|tonight)\b/gi)) add(addDays(today, /day after/i.test(m[0]) ? 2 : /tomorrow/i.test(m[0]) ? 1 : 0), m[0]);
  const weekday = new RegExp(`\\b(?:(next|this)\\s+)?(${DAY_NAMES.join('|')})\\b`, 'gi');
  for (const m of text.matchAll(weekday)) {
    let offset = (DAY_NAMES.findIndex(d => d.toLowerCase() === m[2].toLowerCase()) - now.getDay() + 7) % 7;
    if (!offset && m[1]?.toLowerCase() === 'next') offset = 7;
    add(addDays(today, offset), m[0]);
    if (m[1]?.toLowerCase() === 'next') warnings.push(`“${m[0]}” means its next occurrence here; review the displayed date.`);
  }
  for (const m of text.matchAll(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven)\s+(days?|weeks?)\b/gi)) {
    const numbers: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
    const count = numbers[m[1].toLowerCase()] ?? Number(m[1]);
    if (count <= 365) add(addDays(today, count * (/week/i.test(m[2]) ? 7 : 1)), m[0]);
    else { mentioned = true; warnings.push('That relative date is too far away to infer safely. Choose a date.'); }
  }
  if (/\b(?:next week|next month|weekend|later|someday|every|daily|weekly|monthly)\b/i.test(text)) {
    mentioned = true; warnings.push('A vague or repeating schedule needs review. Choose one date; recurring tasks are not created automatically.');
  }
  const dates = [...new Set(candidates.map(c => c.date))];
  if (dates.length > 1) warnings.push('More than one date was found. Choose the intended date for this item.');
  const date = dates.length === 1 && !warnings.some(w => /not a valid|could mean/.test(w)) ? dates[0] : '';
  return { date, mentioned, spans: date ? candidates.map(c => c.span) : [], warnings, explanation: date ? `Suggested local date: ${date}. Please review.` : 'No definite date selected.' };
}
export function extractTime(text: string): string {
  if (/\bnoon\b/i.test(text)) return '12:00';
  if (/\bmidnight\b/i.test(text)) return '00:00';
  const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (match) return `${String(Number(match[1]) % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0)).padStart(2, '0')}:${match[2] || '00'}`;
  return text.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/)?.[0] ?? '';
}
export function extractDuration(text: string) {
  const match = text.match(/\b(?:for\s+)?(\d+(?:\.\d+)?)[ -]*(minutes?|mins?|hours?|hrs?)\b/i);
  return { duration: match ? Number(match[1]) * (/^(hour|hr)/i.test(match[2]) ? 60 : 1) : 30, span: match?.[0] ?? '' };
}
export function extractTemporal(text: string, now: Date) {
  const schedule = extractSchedule(text);
  const withoutSchedule = schedule.spans.reduce((value, span) => value.replace(span, ' '), text);
  const date = extractDate(withoutSchedule, now), warnings = [...date.warnings];
  const times = [...text.matchAll(/\b(?:noon|midnight|(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:am|pm)|(?:[01]\d|2[0-3]):[0-5]\d)\b/gi)].map(m => m[0]);
  const distinct = [...new Set(times.map(extractTime))];
  let time = distinct.length === 1 ? distinct[0] : '';
  const bare = !times.length ? text.match(/\bat\s+(0?\d|1\d|2[0-3])(?::([0-5]\d))?\b(?!\s*(?:am|pm))/i) : null;
  let timeChoices: string[] = [];
  if (bare) {
    const hour = Number(bare[1]), minute = bare[2] || '00';
    timeChoices = hour > 12 || hour === 0 ? [`${String(hour).padStart(2, '0')}:${minute}`] : [hour % 12, hour % 12 + 12].map(h => `${String(h).padStart(2, '0')}:${minute}`);
    if (schedule.period) {
      const [start, end] = periodHours[schedule.period];
      const matching = timeChoices.filter(t => Number(t.slice(0, 2)) >= start && Number(t.slice(0, 2)) < end);
      if (matching.length === 1) timeChoices = matching;
    }
    if (timeChoices.length === 1) { time = timeChoices[0]; timeChoices = []; }
    else warnings.push(`“${bare[0]}” needs AM or PM. Confirm a time below, or keep it unscheduled.`);
  }
  if (distinct.length > 1) warnings.push('Several times were found. Choose a start time and duration in review.');
  const timeMentioned = !!times.length || /\b(?:at\s+\d|morning|afternoon|evening|late|early)\b/i.test(text);
  if (timeMentioned && !time && !distinct.length && !bare && !schedule.period) warnings.push('The time is ambiguous. Choose a time if needed.');
  if (time && !date.date) warnings.push('A time was recognized, but its date is missing or unclear. Choose a date or clear the time before saving.');
  const duration = extractDuration(text);
  let title = withoutSchedule;
  if (bare) title = title.replace(bare[0], ' ');
  for (const span of [...date.spans, ...(time ? times : [])]) {
    const escaped = span.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`(?:\\b(?:on|by|at)\\s+)?\\b${escaped}\\b`, 'gi'), ' ');
  }
  if (duration.span) title = title.replace(duration.span, ' ');
  title = title.replace(/[ \t]+/g, ' ').replace(/^[,\s]+/, '').replace(/[,\s.!?]+$/, '').trim();
  return { date: date.date, time, duration: duration.duration, durationMentioned: !!duration.span, timeChoices, period: schedule.period, recurrence: schedule.days.length ? { days: schedule.days } : undefined, title, dateMentioned: date.mentioned, timeMentioned, warnings, explanation: date.explanation };
}

export const periodHours = { morning: [6, 12], afternoon: [12, 17], evening: [17, 22] } as const;
export function extractSchedule(text: string) {
  const spans: string[] = [];
  const periodMatch = text.match(/\b(?:(?:in the|every)\s+)?(morning|afternoon|evening)\b/i);
  const period = periodMatch?.[1].toLowerCase() as keyof typeof periodHours | undefined;
  if (periodMatch) spans.push(periodMatch[0]);
  let days: number[] = [];
  const daily = text.match(/\b(?:every day|each day|daily)\b/i);
  const weekdays = text.match(/\b(?:every weekday|on weekdays|weekdays)\b/i);
  const weekends = text.match(/\b(?:every weekend|on weekends|weekends)\b/i);
  const weekly = text.match(new RegExp(`\\b(?:every|each|on)\\s+((?:${DAY_NAMES.join('|')})s?(?:\\s*(?:,|and)\\s*(?:${DAY_NAMES.join('|')})s?)*)\\b`, 'i'));
  if (daily || /^every /i.test(periodMatch?.[0] ?? '')) { days = [0,1,2,3,4,5,6]; if (daily) spans.push(daily[0]); }
  else if (weekdays) { days = [1,2,3,4,5]; spans.push(weekdays[0]); }
  else if (weekends) { days = [0,6]; spans.push(weekends[0]); }
  else if (weekly && (/^(every|each)/i.test(weekly[0]) || /s\b/i.test(weekly[1]))) {
    days = DAY_NAMES.flatMap((day, i) => new RegExp(`\\b${day}s?\\b`, 'i').test(weekly[1]) ? [i] : []); spans.push(weekly[0]);
  }
  return { period, days, spans };
}
