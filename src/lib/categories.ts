import type { Settings } from '../types';

export interface CategoryDefinition { name: string; description: string; subcategories: { name: string; description: string; terms: string[] }[] }
// Descriptions are also suitable for a future local embedding classifier. The
// small rule vocabulary is a transparent fallback, not a model's training set.
export const categoryDefinitions: CategoryDefinition[] = [
  { name: 'Education', description: 'Education, understanding ideas, practicing skills and lifelong learning.', subcategories: [
    { name: 'Learning', description: 'Studying, reading, lessons, research, courses and practice.', terms: ['study', 'studying', 'learn', 'learning', 'homework', 'class', 'course', 'lesson', 'exam', 'read', 'reading', 'research'] },
  ] },
  { name: 'Communication', description: 'Exchanging messages and information with other people.', subcategories: [
    { name: 'Messages', description: 'Writing, sending and answering correspondence.', terms: ['email', 'e-mail', 'message', 'text', 'reply', 'respond', 'letter', 'card'] },
    { name: 'Calls', description: 'Telephone and video conversations.', terms: ['call', 'phone', 'telephone'] },
  ] },
  { name: 'Recreation', description: 'Enjoying leisure, hobbies, creativity and time outdoors.', subcategories: [
    { name: 'Hobbies', description: 'Outdoor hobbies, games, music, crafts and creative projects.', terms: ['fish', 'fishing', 'hike', 'hiking', 'camp', 'camping', 'paint', 'painting', 'knit', 'knitting', 'guitar', 'piano', 'game', 'gaming', 'photography', 'craft'] },
    { name: 'Entertainment', description: 'Shows, films, concerts and leisure outings.', terms: ['movie', 'film', 'concert', 'show', 'museum'] },
  ] },
  { name: 'Personal', description: 'Personal responsibilities, errands, documents and maintaining belongings.', subcategories: [
    { name: 'Vehicle Maintenance', description: 'Looking after a car, bicycle or other vehicle.', terms: ['car', 'vehicle', 'tire', 'tyre', 'oil change', 'windshield', 'mechanic', 'bike', 'bicycle'] },
    { name: 'Administration', description: 'Personal documents, applications and renewals.', terms: ['passport', 'license', 'licence', 'permit', 'registration', 'application', 'renew'] },
    { name: 'Errands', description: 'Shopping, collecting supplies, returns and everyday errands.', terms: ['errand', 'errands', 'buy', 'shop', 'shopping', 'pick up', 'return', 'collect'] },
  ] },
  { name: 'Home', description: 'Caring for a household, food, living space and garden.', subcategories: [
    { name: 'Household', description: 'Cleaning, laundry, repairs and organizing the living space.', terms: ['clean', 'tidy', 'laundry', 'dishes', 'apartment', 'house', 'vacuum', 'mop', 'declutter', 'garden', 'plants'] },
    { name: 'Food & Groceries', description: 'Buying groceries, cooking and preparing meals.', terms: ['groceries', 'grocery', 'cook', 'cooking', 'meal', 'bake', 'baking', 'supermarket'] },
  ] },
  { name: 'Wellness', description: 'Physical and mental wellbeing, healthcare and exercise.', subcategories: [
    { name: 'Health', description: 'Appointments, medicine, rest and caring for health.', terms: ['doctor', 'dentist', 'medicine', 'medication', 'prescription', 'therapy', 'sleep', 'rest'] },
    { name: 'Exercise', description: 'Movement, exercise and fitness activities.', terms: ['gym', 'workout', 'exercise', 'yoga', 'jog', 'jogging', 'swim', 'swimming', 'meditate', 'meditation', 'run', 'running'] },
  ] },
  { name: 'Finance', description: 'Managing personal money, bills, accounts and payments.', subcategories: [
    { name: 'Bills & Budget', description: 'Paying bills, budgeting, banking, saving and taxes.', terms: ['rent', 'bill', 'bills', 'pay', 'payment', 'budget', 'bank', 'tax', 'taxes', 'invoice', 'savings'] },
  ] },
  { name: 'Relationships', description: 'Spending time with friends, family and community.', subcategories: [
    { name: 'Social & Family', description: 'Visiting people, shared meals, celebrations and care.', terms: ['visit', 'family', 'friend', 'friends', 'brunch', 'birthday', 'anniversary', 'volunteer', 'babysit'] },
  ] },
  { name: 'Travel', description: 'Planning travel and getting from place to place.', subcategories: [
    { name: 'Trips & Transport', description: 'Trips, transport, bookings, accommodation and packing.', terms: ['flight', 'train', 'bus', 'hotel', 'trip', 'travel', 'airport', 'ticket', 'pack', 'vacation'] },
  ] },
  { name: 'Work', description: 'Employment, business responsibilities and professional projects.', subcategories: [
    { name: 'Projects', description: 'Work deliverables, meetings, clients and professional commitments.', terms: ['client', 'report', 'deadline', 'presentation', 'meeting', 'office', 'proposal', 'shift'] },
  ] },
];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const hasPhrase = (text: string, phrase: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(phrase)}(?:$|[^\\p{L}\\p{N}])`, 'iu').test(text);
export function categoryInfo(name: string, settings: Settings) {
  const definition = categoryDefinitions.find(c => c.name === (name === 'Learning' ? 'Education' : name));
  return settings.categoryDetails?.[name] ?? { description: definition?.description ?? '', subcategories: definition?.subcategories.map(s => s.name) ?? [] };
}
export function suggestCategory(text: string, settings: Settings) {
  const scores: { category: string; subcategory: string; score: number }[] = [];
  for (const category of settings.categories) {
    const def = categoryDefinitions.find(c => c.name === (category === 'Learning' ? 'Education' : category));
    for (const sub of def?.subcategories ?? []) {
      let hits = sub.terms.filter(term => hasPhrase(text, term));
      if (sub.name === 'Exercise' && /\brun(?:ning)?\s+(?:errands|a business|a report)\b/i.test(text)) hits = hits.filter(t => !['run', 'running'].includes(t));
      let score = hits.length;
      if (sub.name === 'Errands') score *= 0.5;
      if (sub.name === 'Vehicle Maintenance' && score && /\b(clean|wash|fix|repair|service|maintain|change|replace)\b/i.test(text)) score += 3;
      if (category === 'Education' && score) score += 0.1;
      if (category === 'Communication' && score && /\b(send|write|reply|respond|call|email|text|message)\b/i.test(text)) score += 1;
      if (score) scores.push({ category, subcategory: !settings.categoryDetails?.[category] || settings.categoryDetails[category].subcategories.includes(sub.name) ? sub.name : '', score });
    }
    // User descriptions and names can contribute without adding code or rules.
    const custom = settings.categoryDetails?.[category];
    const words = `${category} ${custom?.description ?? ''}`.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    const hits = [...new Set(words)].filter(w => !['with', 'this', 'that', 'your', 'about', 'other', 'things'].includes(w) && hasPhrase(text, w));
    if (hits.length) scores.push({ category, subcategory: '', score: hits.length + 0.25 });
  }
  scores.sort((a, b) => b.score - a.score);
  const winner = scores[0];
  const fallback = settings.categories.includes('Personal') ? 'Personal' : settings.categories[0] ?? 'Personal';
  return { category: winner?.category ?? fallback, subcategory: winner?.subcategory ?? '', uncertain: !winner || scores.some(s => s.category !== winner.category && s.score === winner.score) };
}
