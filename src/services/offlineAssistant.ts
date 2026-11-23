import type { AssistantService, Interpretation, InterpretationContext } from './assistant';
import { addDays, DAY_NAMES, localDate, parseDate } from '../lib/dates';
import type { TaskDraft } from '../types';

export function extractDate(text: string, now: Date): { date: string; explanation: string } {
  const today = localDate(now), lower = text.toLowerCase();
  const iso = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (iso && !Number.isNaN(parseDate(iso).getTime()) && localDate(parseDate(iso)) === iso) return { date: iso, explanation: `Explicit date: ${iso}.` };
  if (/\btomorrow\b/.test(lower)) return { date: addDays(today, 1), explanation: '“Tomorrow” uses your device’s local date.' };
  if (/\b(today|tonight)\b/.test(lower)) return { date: today, explanation: '“Today / tonight” uses your device’s local date.' };
  for (let day = 0; day < 7; day++) {
    if (new RegExp(`\\b${DAY_NAMES[day].toLowerCase()}\\b`).test(lower)) {
      let offset = (day - now.getDay() + 7) % 7;
      if (offset === 0 && /\bnext\b/.test(lower)) offset = 7;
      return { date: addDays(today, offset), explanation: 'Weekday matched to its next occurrence; please review.' };
    }
  }
  return { date: '', explanation: 'No date inferred. Choose one if needed.' };
}
export function extractTime(text: string): string {
  if (/\bnoon\b/i.test(text)) return '12:00';
  const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (match) return `${String(Number(match[1]) % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0)).padStart(2, '0')}:${match[2] || '00'}`;
  return text.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/)?.[0] ?? '';
}
function categoryFor(text: string, categories: string[]) {
  const pairs = [['Wellness', /gym|workout|run|exercise|yoga|meditat/i], ['Home', /grocer|clean|laundry|apartment|dishes|cook/i], ['Work', /meeting|email|project|client|report/i], ['Learning', /study|read|class|learn|homework/i]] as const;
  return pairs.find(([name, regex]) => categories.includes(name) && regex.test(text))?.[0] ?? categories[0] ?? 'Personal';
}
export class OfflineAssistant implements AssistantService {
  async interpret(text: string, { data, now }: InterpretationContext): Promise<Interpretation> {
    const chunks = text.trim().split(/(?:[;\n]+|[.!?]+\s+|,\s*(?=(?:I\s+)?(?:have|need|want|must|really|clean|buy|hit|go|call|finish|study|do|book|pay|pick)\b)|\s+and\s+(?=(?:I\s+)?(?:have|need|want|must|really|clean|buy|hit|go|call|finish|study|do|book|pay|pick)\b))/i)
      .map(s => s.replace(/[.!?]+$/, '').trim()).filter(s => s && !/^(?:i['’]?m|i am|feeling)\s+(?:stressed|tired|overwhelmed|anxious|sad|happy)[\s.!]*$/i.test(s));
    const tasks = chunks.slice(0, 12).map(chunk => {
      const extracted = extractDate(chunk, now), time = extractTime(chunk);
      const workout = /\b(gym|workout|work out|lift weights)\b/i.test(chunk);
      let title = chunk.replace(/^(?:I\s+)?(?:(?:really\s+)?(?:need|want|have|ought)\s+(?:to\s+)?|must\s+)/i, '').trim();
      title = title.replace(/\s+\b(?:today|tomorrow|tonight)\b/gi, '').replace(/\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '').trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      const draft: TaskDraft = { title: title || chunk, date: extracted.date || (time ? localDate(now) : ''), time, duration: 30,
        category: categoryFor(chunk, data.settings.categories), priority: /\b(urgent|important|priority)\b/i.test(chunk), notes: '' };
      return { draft, workout, explanations: [extracted.explanation, 'Category and 30-minute duration are editable suggestions.', ...(time && !extracted.date ? ['Time found without a date; today is proposed.'] : [])] };
    });
    return { provider: 'offline-rules', tasks, notices: ['Basic on-device rules identified these possibilities. They can miss context; review every suggestion.', ...(chunks.length > 12 ? ['Only the first 12 items are shown. Capture the rest in a second MindDump.'] : [])] };
  }
}
export const assistant: AssistantService = new OfflineAssistant();
