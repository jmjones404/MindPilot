import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, mutateData, readData } from '../../src/lib/db';
beforeEach(async () => { await closeDatabase(); await new Promise<void>((resolve, reject) => { const req = indexedDB.deleteDatabase('mindpilot-local-v1'); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); }); });
describe('IndexedDB persistence and transaction safety', () => {
  it('starts empty and persists through a closed connection', async () => { expect((await readData()).tasks).toEqual([]); await mutateData(s => { s.settings.name = 'Jayden'; }); await closeDatabase(); expect((await readData()).settings.name).toBe('Jayden'); });
  it('serializes simultaneous writes without lost changes', async () => { await Promise.all(Array.from({ length: 12 }, (_, i) => mutateData(s => { s.memories.push({ id: `${i}`, title: `Goal ${i}`, detail: '', kind: 'goal' }); }))); expect((await readData()).memories).toHaveLength(12); });
  it('rolls back every change if one item fails', async () => { await expect(mutateData(s => { s.settings.name = 'Should not save'; throw new Error('Validation failed'); })).rejects.toThrow('Validation failed'); expect((await readData()).settings.name).toBe(''); });
  it('persists and deletes tasks, routines, logs and editable memory', async () => { await mutateData(s => { s.routines.push({ id: 'r', name: 'Push', kind: 'workout', days: [3], time: '19:00', duration: 55, exercises: ['Bench press'], createdAt: new Date().toISOString() }); s.memories.push({ id: 'm', kind: 'preference', title: 'Quiet mornings', detail: 'For reading' }); }); await closeDatabase(); expect((await readData()).routines[0].duration).toBe(55); await mutateData(s => { s.memories[0].detail = 'For writing'; s.routines = []; }); expect((await readData()).memories[0].detail).toBe('For writing'); expect((await readData()).routines).toEqual([]); });
});
