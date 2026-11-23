import type { AppData, Memory, OrganizerPreference, TaskDraft } from '../types';
import { addDays, localDate, parseDate } from './dates';

export const emptyPreference = (): OrganizerPreference => ({ match: '', matchMode: 'similar', category: '', subcategory: '', time: '', days: [], source: 'manual' });
export function normalizePhrase(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function contentWords(text: string) {
  const generic = new Set('i we my our the a an this that to for of on in at with and need want have please really tomorrow today tonight send do get make go clean wash'.split(' '));
  return new Set(normalizePhrase(text).split(' ').filter(w => w && !generic.has(w)).map(w => w.replace(/ies$/, 'y').replace(/ing$/, '').replace(/s$/, '').replace(/^(vehicle|automobile)$/, 'car')));
}
export function preferenceMatch(text: string, pattern: string, mode: OrganizerPreference['matchMode']) {
  if (normalizePhrase(text) === normalizePhrase(pattern)) return 1;
  if (mode === 'exact') return 0;
  const expected = contentWords(pattern), actual = contentWords(text);
  if (!expected.size || !actual.size) return 0;
  const overlap = [...expected].filter(w => actual.has(w)).length;
  // Require shared subject words, not just a common action such as "send".
  return overlap === expected.size && overlap / actual.size >= 0.5 ? 0.8 : 0;
}
export function validatePreference(rule: OrganizerPreference) {
  if (!rule.match.trim() || rule.match.length > 180) throw new Error('Use a specific example of up to 180 characters.');
  if (!rule.category && !rule.time && !rule.days.length) throw new Error('Choose a category, a preferred time, or preferred days.');
  if (rule.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time)) throw new Error('Choose a valid preferred time.');
  if (rule.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Choose valid preferred days.');
}
export function applyPreferences(draft: TaskDraft, data: AppData, now: Date, dateMentioned: boolean, timeMentioned: boolean, durationMentioned = false) {
  const explanations: string[] = [], warnings: string[] = [];
  const matches = data.memories.filter((m): m is Memory & { rule: OrganizerPreference } => m.kind === 'preference' && !!m.rule)
    .map(memory => ({ memory, score: preferenceMatch(draft.title, memory.rule.match, memory.rule.matchMode) }))
    .filter(m => m.score > 0).sort((a, b) => b.score - a.score || b.memory.rule.match.length - a.memory.rule.match.length);
  const first = matches[0];
  if (first && matches.some(m => m !== first && m.score === first.score && m.memory.rule.match.length === first.memory.rule.match.length && JSON.stringify({ ...m.memory.rule, source: '' }) !== JSON.stringify({ ...first.memory.rule, source: '' }))) {
    warnings.push('More than one saved preference matches. Review them in My Rhythm; none was applied.');
  } else if (first) {
    const rule = first.memory.rule;
    if (rule.category && data.settings.categories.includes(rule.category)) { draft.category = rule.category; draft.subcategory = rule.subcategory; }
    if (draft.kind !== 'note' && !draft.date && !dateMentioned && rule.days.length) {
      const today = localDate(now);
      draft.date = Array.from({ length: 7 }, (_, i) => addDays(today, i)).find(d => rule.days.includes(parseDate(d).getDay())) ?? '';
    }
    if (draft.kind !== 'note' && !draft.time && !timeMentioned && draft.date && rule.time) draft.time = rule.time;
    explanations.push(`Saved preference “${first.memory.title}” matched ${rule.matchMode === 'exact' ? 'this exact activity' : 'shared subject words'}. You can edit or remove it in My Rhythm.`);
  }
  const routines = data.routines.filter(r => r.kind === 'routine' && preferenceMatch(draft.title, r.name, 'similar') > 0);
  if (draft.kind !== 'note' && routines.length === 1) {
    const routine = routines[0];
    if (!draft.date && !dateMentioned) draft.date = Array.from({ length: 7 }, (_, i) => addDays(localDate(now), i)).find(d => routine.days.includes(parseDate(d).getDay())) ?? '';
    if (!draft.time && !timeMentioned && draft.date) draft.time = routine.time;
    if (!durationMentioned) draft.duration = routine.duration;
    draft.routineId = routine.id;
    explanations.push(`Applied your saved “${routine.name}” routine where timing was not explicitly stated. Nothing is scheduled until you confirm.`);
  } else if (routines.length > 1) warnings.push('Several saved routines match. Choose the timing yourself or refine them in My Rhythm.');
  return { draft, explanations, warnings };
}
