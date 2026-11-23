import { describe, expect, it } from 'vitest';
import { OfflineAssistant } from '../../src/services/offlineAssistant';
import { emptyData, migrateData, validateTask, type Task } from '../../src/types';
import { emptyPreference, preferenceMatch } from '../../src/lib/preferences';
import { dailyProgress } from '../../src/lib/progress';
const now = new Date(2026, 10, 23, 12);
const interpret = (text: string, data = emptyData()) => new OfflineAssistant().interpret(text, { data, now });

describe('everyday organizing without a model', () => {
  it('separates and classifies the four activities in the requested example', async () => {
    const r = await interpret('Yo, I gotta study, send this email, catch some fish, and clean the inside of my car.');
    expect(r.tasks.map(t => [t.draft.title, t.draft.category, t.draft.subcategory, t.draft.kind])).toEqual([
      ['Study', 'Education', 'Learning', 'task'], ['Send this email', 'Communication', 'Messages', 'task'],
      ['Catch some fish', 'Recreation', 'Hobbies', 'task'], ['Clean the inside of my car', 'Personal', 'Vehicle Maintenance', 'task'],
    ]);
  });
  it.each([
    ['Book a dentist appointment, send a birthday card, and renew my passport.', 3],
    ['Water the plants and repair my bicycle, then write to my friend.', 3],
    ['Buy apples, oranges, and milk.', 1], ['Call Mom and Dad tomorrow at 6 pm.', 1],
    ['Study science and math tomorrow.', 1], ['Clean and polish my shoes.', 1], ['Do not call Alex and send a message.', 1], ['Pay rent on December 1, 2026 at 9 am.', 1],
    ['Buy bread\nCollect my prescription; wash the car', 3],
  ])('handles independent actions and shared objects: %s', async (text, count) => {
    expect((await interpret(text)).tasks).toHaveLength(count);
  });
  it.each([
    ['Run errands tomorrow.', 'Personal'], ['Have brunch with Sam on Friday at noon.', 'Relationships'],
    ['Practice the guitar.', 'Recreation'], ['Renew my passport.', 'Personal'],
    ['Pay the electricity bill.', 'Finance'], ['Reply to the letter.', 'Communication'],
    ['Prepare a client presentation.', 'Work'], ['Pick up my prescription.', 'Wellness'],
  ])('uses context rather than substrings: %s', async (text, category) => {
    const item = (await interpret(text)).tasks[0]; expect(item.draft.category).toBe(category); expect(item.draft.kind).not.toBe('note');
  });
  it('does not make new obligations out of negation, completion or feelings', async () => {
    const r = await interpret("Do not call Alex. I already sent the email. I'm stressed.");
    expect(r.tasks).toHaveLength(3);
    expect(r.tasks.every(t => t.draft.kind === 'note' && !t.selected)).toBe(true);
  });
  it('recognizes reminders, dated events and explicit notes', async () => {
    const r = await interpret('Remind me to call Pat tomorrow at 6 pm. Dentist appointment on December 1 at 9 am. Note: the spare key is in the drawer.');
    expect(r.tasks.map(t => t.draft.kind)).toEqual(['reminder', 'event', 'note']);
  });
  it('applies a leading date to the coordinated activities without making it a separate note', async () => {
    const r = await interpret('Tomorrow at 6 pm, call Mom and email Pat.');
    expect(r.tasks).toHaveLength(2);
    expect(r.tasks.every(t => t.draft.kind === 'task' && t.draft.date === '2026-11-24' && t.draft.time === '18:00')).toBe(true);
    expect(r.tasks[0].draft.title).toBe('Call Mom');
  });
  it('keeps all suggestions after the old twelve-item limit', async () => {
    const r = await interpret(Array.from({ length: 16 }, (_, i) => `Call person ${i + 1}`).join('\n'));
    expect(r.tasks).toHaveLength(16);
    expect(r.tasks[15].draft.title).toBe('Call person 16');
  });
  it('rejects excessive input explicitly instead of silently truncating it', async () => {
    await expect(interpret('a'.repeat(20_001))).rejects.toThrow('full text is still here');
  });
  it('preserves long content in the source and notes', async () => {
    const text = 'Note: ' + 'Useful context '.repeat(30);
    const r = await interpret(text);
    expect(r.tasks[0].draft.title).toHaveLength(180);
    expect(r.tasks[0].draft.notes).toContain('Useful context '.repeat(20));
  });
  it('uses a custom category description without adding a keyword rule', async () => {
    const data = emptyData(); data.settings.categories = ['Personal', 'Community'];
    data.settings.categoryDetails = { Community: { description: 'Neighborhood volunteering and mutual aid', subcategories: ['Volunteering'] } };
    expect((await interpret('Plan neighborhood volunteering', data)).tasks[0].draft.category).toBe('Community');
  });
});

describe('explicit dates and uncertainty', () => {
  it.each([
    ['Pay rent on December 1 at 9 am.', '2026-12-01', '09:00'],
    ['Call Pat on 1 December 2026 at noon.', '2026-12-01', '12:00'],
    ['Read tomorrow at midnight.', '2026-11-24', '00:00'],
    ['Book tickets in two weeks.', '2026-12-07', ''],
    ['Call Pat on 2026-12-31 at 18:30.', '2026-12-31', '18:30'],
  ])('extracts dates without inventing today: %s', async (text, date, time) => {
    expect((await interpret(text)).tasks[0].draft).toMatchObject({ date, time });
  });
  it.each(['Pay rent on February 30 at 9 am.', 'Call Pat on 03/04 at 6 pm.', 'Call Pat next month at 6 pm.', 'Call Pat at 6 pm.'])('keeps missing or uncertain dates unset: %s', async text => {
    const r = (await interpret(text)).tasks[0];
    expect(r.draft.date).toBe(''); expect(r.warnings.length).toBeGreaterThan(0);
    expect(() => validateTask(r.draft)).toThrow('date');
  });
  it('leaves conflicting dates and ambiguous times for review', async () => {
    const r = (await interpret('Call Pat Monday or Tuesday at 7.')).tasks[0];
    expect(r.draft).toMatchObject({ date: '', time: '' });
    expect(r.warnings.join(' ')).toMatch(/More than one date/);
  });
});

describe('permission-based local preferences', () => {
  const withPreference = () => {
    const data = emptyData();
    data.memories.push({ id: 'p', kind: 'preference', title: 'My email routine', detail: '', rule: { ...emptyPreference(), match: 'Send family email', category: 'Relationships', subcategory: 'Family', time: '18:00', days: [2] } });
    return data;
  };
  it('applies an enabled preference and explains its source', async () => {
    const r = (await interpret('Send family email', withPreference())).tasks[0];
    expect(r.draft).toMatchObject({ category: 'Relationships', subcategory: 'Family', date: '2026-11-24', time: '18:00' });
    expect(r.explanations.join(' ')).toContain('My email routine');
  });
  it('respects explicit scheduling over preferences', async () => {
    const r = (await interpret('Send family email on Friday at noon', withPreference())).tasks[0];
    expect(r.draft).toMatchObject({ date: '2026-11-27', time: '12:00' });
  });
  it('does not use preferences to resolve an ambiguous explicit date', async () => {
    const r = (await interpret('Send family email next month at 6 pm', withPreference())).tasks[0];
    expect(r.draft.date).toBe('');
  });
  it('does not treat plain notes or unrelated corrections as rules', async () => {
    const data = withPreference(); data.memories.push({ id: 'n', kind: 'preference', title: 'Always use Wellness', detail: 'For everything' });
    expect((await interpret('Send a client email', data)).tasks[0].draft.category).toBe('Communication');
    expect(preferenceMatch('Send a birthday card', 'Send family email', 'similar')).toBe(0);
    expect(preferenceMatch('Send family email later', 'Send family email', 'exact')).toBe(0);
  });
  it('stops applying a correction after it is deleted', async () => {
    const data = withPreference(); data.memories = [];
    expect((await interpret('Send family email', data)).tasks[0].draft.category).toBe('Communication');
  });
  it('uses everyday routines, not just workouts', async () => {
    const data = emptyData(); data.routines.push({ id: 'r', name: 'Read a book', kind: 'routine', days: [1], time: '19:30', duration: 20, exercises: [], createdAt: now.toISOString() });
    expect((await interpret('Read a book', data)).tasks[0].draft).toMatchObject({ routineId: 'r', time: '19:30', duration: 20 });
  });
  it('preserves an explicit duration instead of replacing it with a routine preference', async () => {
    const data = emptyData(); data.routines.push({ id: 'r', name: 'Read a book', kind: 'routine', days: [1], time: '19:30', duration: 20, exercises: [], createdAt: now.toISOString() });
    expect((await interpret('Read a book for 45 minutes', data)).tasks[0].draft).toMatchObject({ routineId: 'r', duration: 45 });
  });
});

describe('preserving existing local records', () => {
  it('migrates legacy data without changing identifiers, content or custom categories', () => {
    const legacy = { ...emptyData(), version: 1, settings: { name: 'Test', theme: 'dark', categories: ['Errands'] }, tasks: [{ id: 'keep', title: 'Original activity', category: 'Old label', date: '', time: '', duration: 30, notes: 'Keep me', priority: false, completedAt: null, createdAt: now.toISOString() }] };
    const migrated = migrateData(legacy);
    expect(migrated.version).toBe(2); expect(migrated.tasks[0]).toMatchObject({ ...legacy.tasks[0], kind: 'task', subcategory: '' });
    expect(migrated.settings.categories).toEqual(['Errands']); expect(legacy.version).toBe(1);
    expect(migrateData(migrated)).toEqual(migrated);
  });
  it('refuses an unknown format without replacing it with an empty app', () => { expect(() => migrateData({ version: 99 })).toThrow('not been replaced'); });
  it('does not count notes as tasks or obligations', () => {
    const data = emptyData();
    data.tasks.push({ id: 'note', title: 'A thought', kind: 'note', category: 'Personal', date: '', time: '', duration: 30, priority: false, notes: '', completedAt: null, createdAt: now.toISOString() });
    expect(dailyProgress(data.tasks, '2026-11-23').total).toBe(0);
  });
});
