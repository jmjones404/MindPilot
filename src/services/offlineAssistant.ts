import type { AssistantService, Interpretation, InterpretationContext } from './assistant';
import type { ItemKind, TaskDraft } from '../types';
import { suggestCategory } from '../lib/categories';
import { applyPreferences } from '../lib/preferences';
import { activityTitle, splitThoughts, isAction, extractChecklist } from './language';
import { extractDate, extractTemporal } from './temporal';
import { recommendSchedule } from './scheduling';
export { extractDate, extractTime } from './temporal';
import { MAX_INPUT_LENGTH } from './assistant';
export { MAX_INPUT_LENGTH } from './assistant';

export class OfflineAssistant implements AssistantService {
  async interpret(text: string, { data, now }: InterpretationContext): Promise<Interpretation> {
    if (text.length > MAX_INPUT_LENGTH) throw new Error('Please divide messages longer than 20,000 characters into smaller parts. Your full text is still here.');
    const thoughts = splitThoughts(text);
    const sentenceDates = new Map<string, ReturnType<typeof extractDate>>();
    const tasks = thoughts.map(thought => {
      const source = thought.text;
      const nonAction = /^(?:do not|don['’]t(?! forget)|never|no need to|i (?:already|finished|completed|sent|paid|did|have already)|i['’]ve (?:already|finished|completed))\b/i.test(source);
      const emotion = /^(?:i['’]?m|i am|feeling)\s+(?:stressed|tired|overwhelmed|anxious|sad|happy)\b/i.test(source);
      const note = /^(?:note\b|remember that\b|remember:|fyi\b)/i.test(source) || nonAction || emotion;
      const temporal = extractTemporal(source, now);
      if (!sentenceDates.has(thought.sentence)) sentenceDates.set(thought.sentence, extractDate(thought.sentence, now));
      const sharedDate = sentenceDates.get(thought.sentence)!;
      const sentenceStart = thought.sentence.toLowerCase().replace(/^(?:on|by)\s+/i, '');
      const leading = sharedDate.spans.some(span => sentenceStart.startsWith(span.toLowerCase()));
      if (!temporal.dateMentioned && leading && sharedDate.date) {
        temporal.date = sharedDate.date; temporal.dateMentioned = true;
        const comma = thought.sentence.indexOf(',');
        if (comma >= 0 && !temporal.timeMentioned) temporal.time = extractTemporal(thought.sentence.slice(0, comma), now).time;
        temporal.explanation = `The date at the start of the sentence applies to this activity: ${sharedDate.date}.`;
      } else if (!temporal.dateMentioned && sharedDate.mentioned && !leading) {
        temporal.warnings.push('A date appears elsewhere in this sentence. Choose a date here if it applies to this activity too.');
      }
      const checklist = !note ? extractChecklist(temporal.title) : undefined;
      const reminder = /^(?:remind me|remember to|don['’]t forget)/i.test(source);
      const event = !!temporal.date && /\b(?:appointment|meeting|birthday|concert|flight|train|brunch|dinner|lunch)\b/i.test(source) && !/^(?:book|schedule|cancel|arrange|buy|send|renew)\b/i.test(activityTitle(source));
      const kind: ItemKind = note ? 'note' : reminder ? 'reminder' : event ? 'event' : thought.action || isAction(temporal.title) || checklist || temporal.durationMentioned || temporal.period || temporal.recurrence ? 'task' : 'note';
      const category = suggestCategory(source, data.settings);
      const warnings = [...temporal.warnings];
      if (nonAction) warnings.push('This sounds negated or already completed. Kept as an unselected note, not a new obligation.');
      else if (emotion) warnings.push('This sounds like a feeling. Keep it as a note only if you want to.');
      else if (kind === 'note' && !note) warnings.push('The action is unclear. Kept as an editable note; change its type if you meant a task.');
      if (category.uncertain) warnings.push('The category is uncertain. Please review the suggestion.');
      let title = checklist?.title ?? activityTitle(kind === 'note' ? source : temporal.title);
      if (!title) title = activityTitle(source);
      if (title.length > 180) warnings.push('The full thought is retained in notes; the title was shortened for review.');
      const draft: TaskDraft = { title: title.slice(0, 180), kind, subcategory: category.subcategory, sourceText: source,
        date: kind === 'note' ? '' : temporal.date, time: kind === 'note' ? '' : temporal.time,
        checklist: checklist?.items.map(text => ({text, done:false})), recurrence: temporal.recurrence, preferredPeriod: temporal.period, timeChoices: temporal.timeChoices,
        duration: temporal.duration, category: category.category, priority: /\b(urgent|important|priority)\b/i.test(source),
        notes: title.length > 180 ? source : '' };
      const personalized = applyPreferences(draft, data, now, temporal.dateMentioned || !!temporal.recurrence, temporal.timeMentioned, temporal.durationMentioned);
      const schedule = recommendSchedule(personalized.draft, data, now, temporal.dateMentioned, temporal.timeMentioned);
      return { draft: personalized.draft, workout: kind !== 'note' && /\b(gym|workout|work out|lift weights)\b/i.test(source), selected: !nonAction && !emotion,
        warnings: [...warnings, ...personalized.warnings, ...schedule.warnings], explanations: [temporal.explanation, 'Category and duration are editable suggestions.', ...personalized.explanations, ...schedule.explanations] };
    });
    return { provider: 'offline-rules', tasks, notices: ['Organized on your device. Review the types, categories and dates; only selected items are saved when you confirm.'] };
  }
}
export const assistant: AssistantService = new OfflineAssistant();
