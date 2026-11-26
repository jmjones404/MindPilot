import nlp from 'compromise/two';

export interface Thought { text: string; action: boolean; sentence: string }
interface Term { text: string; tags: string[]; start: number; end: number }
const intent = /^(?:(?:i|we|you)\s+)?(?:(?:really|also|please)\s+)*(?:need|want|must|should|gotta|have to|ought to|plan to|will|remember to|remind me to|don['’]t forget to)\b/i;
export function cleanLead(text: string) {
  return text.replace(/^(?:(?:yo|hey|okay|ok|well)[,!]?\s+)+/i, '').replace(/^(?:and|then|also)\s+/i, '').trim();
}
function startsAction(text: string, terms: Term[]) {
  const value = cleanLead(text);
  if (intent.test(value)) return true;
  const first = terms.find(t => !['and', 'then', 'also', 'please', 'yo', 'hey'].includes(t.text.toLowerCase()));
  if (first?.tags.includes('Verb') && !first.tags.includes('PastTense') && !/^(?:is|are|am|was|were|be)$/i.test(first.text)) return true;
  // These common imperatives are ambiguous nouns in the tagger's lexicon.
  return /^(?:call|email|text|message)\s+\S/i.test(value);
}
function standaloneAction(text: string, terms: Term[]) {
  if (startsAction(text, terms)) return true;
  const probe = nlp(`please ${cleanLead(text).toLowerCase()}`).json() as { terms: { text: string; tags: string[] }[] }[];
  const first = probe.flatMap(s => s.terms).find(t => t.text && t.text !== 'please');
  return !!first?.tags.includes('Imperative');
}
export function splitThoughts(input: string): Thought[] {
  const result: Thought[] = [];
  const blocks = input.split(/\n\s*\n/).flatMap(block => extractChecklist(block) ? [block] : block.split(/[\n;]+/));
  for (const paragraph of blocks.map(s => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean)) {
    if (extractChecklist(paragraph)) { result.push({text: paragraph, action: true, sentence: paragraph}); continue; }
    for (const sentence of nlp(paragraph).json() as { text: string; terms: { text: string; tags: string[] }[] }[]) {
      const text = sentence.text;
      if (/^(?:do not|don['’]t(?! forget)|never|no need to|note\b|remember that\b|i (?:already|finished|completed|sent|paid|did|have already)|i['’]ve (?:already|finished|completed))\b/i.test(text)) {
        result.push({ text: text.replace(/[.!?]+$/, '').trim(), action: false, sentence: text }); continue;
      }
      let cursor = 0;
      const terms: Term[] = [];
      for (const t of sentence.terms) {
        if (!t.text) continue;
        const start = text.toLowerCase().indexOf(t.text.toLowerCase(), cursor);
        if (start < 0) continue;
        cursor = start + t.text.length;
        terms.push({ ...t, start, end: cursor });
      }
      let start = 0;
      const boundaries = [...text.matchAll(/,\s*(?:and\s+)?|\s+(?:and then|and|then|also|but)\s+/gi)];
      for (let i = 0; i < boundaries.length; i++) {
        const boundary = boundaries[i], right = boundary.index! + boundary[0].length;
        const next = boundaries[i + 1]?.index ?? text.length;
        const left = cleanLead(text.slice(start, boundary.index)).replace(/[,\s]+$/, '');
        const rightText = text.slice(right, next);
        const rightTerms = terms.filter(t => t.start >= right && t.start < next);
        // Keep object lists and coordinated names together. A new predicate,
        // not comma placement alone, starts another suggestion.
        if (!left || /^(?:i|we|yo|hey|okay|ok)$/i.test(left) || !startsAction(rightText, rightTerms)) continue;
        if (/\b(?:or|if|whether)\b/i.test(text.slice(start, right))) continue;
        const leftTerms = terms.filter(t => t.start >= start && t.start < boundary.index!);
        if (leftTerms.length && leftTerms.every(t => t.tags.some(tag => ['Date', 'Time', 'Value', 'Preposition'].includes(tag)) || /^(?:noon|midnight|next|this)$/i.test(t.text))) continue;
        if (leftTerms.length === 1 && !leftTerms[0].tags.includes('Verb')) continue;
        result.push({ text: left, action: standaloneAction(left, leftTerms), sentence: text });
        start = right;
      }
      const tail = cleanLead(text.slice(start)).replace(/[.!?]+$/, '').trim();
      if (tail) result.push({ text: tail, action: standaloneAction(tail, terms.filter(t => t.start >= start)), sentence: text });
    }
  }
  return result;
}
export function activityTitle(text: string) {
  let value = cleanLead(text).replace(/^(?:remind me|remember|don['’]t forget)\s+to\s+/i, '');
  value = value.replace(/^(?:i|we)\s+(?:am|are)\s+going to\s+/i, '').replace(/^(?:i|we)\s+(?:will|should|must|can)\s+/i, '');
  value = value.replace(/^(?:(?:i|we)\s+)?(?:(?:really|please)\s+)*(?:(?:need|want|ought|plan|have)\s+to\s+|(?:need|want)\s+|gotta\s+|must\s+)/i, '');
  value = value.replace(/^please\s+/i, '').replace(/^note(?:\s+that)?\s*:\s*/i, '').trim();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const isAction = (text: string) => !!text.trim() && standaloneAction(text, []);

export function extractChecklist(text: string): { title: string; items: string[] } | undefined {
  if (/[.!?]\s+\p{L}/u.test(text)) return;
  const value = activityTitle(text).replace(/[.!?]+$/, '').trim();
  const heading = value.match(/^(.+?(?:list|checklist)|(?:get |buy |do |run )?(?:groceries|shopping|errands)|packing(?: list)?)\s*[:,\n]\s*([\s\S]+)$/i);
  const action = value.match(/^(buy|purchase|pick up|pack|bring)\s+([\s\S]+)$/i);
  if (!heading && !action) return;
  const body = heading?.[2] ?? action![2];
  const items = body.split(/\s*(?:,|;|\n|\band\b)\s*/i).map(s => s.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
  if (items.length < 2) return;
  // Shopping object lists must not swallow an unrelated new action.
  if (!heading && items.some(item => isAction(item))) return;
  return { title: heading ? activityTitle(heading[1]) : /pack|bring/i.test(action![1]) ? 'Packing list' : 'Shopping list', items };
}
