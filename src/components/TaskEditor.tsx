import { useState, type FormEvent } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../state';
import { uid, validateTask, type Task, type TaskDraft, type ItemKind } from '../types';
import { conflicts } from '../lib/planning';
import { timeLabel } from '../lib/dates';
import { Modal } from './ui';
import { categoryInfo } from '../lib/categories';

export function blankTask(date = ''): TaskDraft { return { title: '', kind: 'task', subcategory: '', category: 'Personal', date, time: '', duration: 30, priority: false, notes: '' }; }
function asDraft(task: Task): TaskDraft {
  const { id: _id, createdAt: _createdAt, completedAt: _completedAt, ...draft } = task;
  return draft;
}
export function TaskFields({ draft, onChange, prefix = 'task' }: { draft: TaskDraft; onChange: (task: TaskDraft) => void; prefix?: string }) {
  const { data } = useApp();
  const patch = (values: Partial<TaskDraft>) => onChange({ ...draft, ...values });
  const categories = [...new Set([...data.settings.categories, draft.category])];
  const subcategories = categoryInfo(draft.category, data.settings).subcategories;
  return <div className="form-fields"><label htmlFor={`${prefix}-title`}>Activity name<input id={`${prefix}-title`} value={draft.title} maxLength={180} onChange={e => patch({ title: e.target.value })} required placeholder="What would you like to do?"/></label><div className="form-grid">
    <label>Type<select value={draft.kind ?? 'task'} onChange={e => patch({ kind: e.target.value as ItemKind })}>{['task', 'reminder', 'event', 'note'].map(kind => <option key={kind} value={kind}>{kind.charAt(0).toUpperCase() + kind.slice(1)}</option>)}</select></label>
    <label>Category<select value={draft.category} onChange={e => patch({ category: e.target.value, subcategory: '' })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
    <label>Subcategory <span className="optional">optional</span><input list={`${prefix}-subcategories`} value={draft.subcategory ?? ''} maxLength={60} onChange={e => patch({ subcategory: e.target.value })}/><datalist id={`${prefix}-subcategories`}>{subcategories.map(c => <option key={c} value={c}/>)}</datalist></label>
    {draft.kind !== 'note' && <><label>Duration (minutes)<input type="number" min="5" max="1440" value={draft.duration} onChange={e => patch({ duration: Number(e.target.value) })} required/></label><label>Date<input type="date" value={draft.date} onChange={e => patch({ date: e.target.value })}/></label><label>Start time<input type="time" value={draft.time} onChange={e => patch({ time: e.target.value })}/></label></>}
  </div>{draft.kind !== 'note' && <label className="check-label"><input type="checkbox" checked={draft.priority} onChange={e => patch({ priority: e.target.checked })}/> Make this a top priority</label>}{draft.exercises && <fieldset className="exercise-fields"><legend>Workout details</legend><p className="muted small">Adjust these suggested sets and reps to suit you.</p>{draft.exercises.map((exercise, index) => <div className="exercise-row" key={index}><label>Exercise<input aria-label={`Exercise ${index + 1}`} value={exercise.name} required onChange={e => patch({ exercises: draft.exercises!.map((x, i) => i === index ? { ...x, name: e.target.value } : x) })}/></label><label>Sets<input type="number" min="1" max="20" value={exercise.sets} required onChange={e => patch({ exercises: draft.exercises!.map((x, i) => i === index ? { ...x, sets: Number(e.target.value) } : x) })}/></label><label>Reps<input value={exercise.reps} required onChange={e => patch({ exercises: draft.exercises!.map((x, i) => i === index ? { ...x, reps: e.target.value } : x) })}/></label><button className="icon-button" type="button" aria-label={`Remove ${exercise.name}`} onClick={() => patch({ exercises: draft.exercises!.filter((_, i) => i !== index) })}><Trash2 size={16}/></button></div>)}<button className="text-button" type="button" onClick={() => patch({ exercises: [...draft.exercises!, { name: '', sets: 3, reps: '8–12' }] })}><Plus size={16}/>Add exercise</button></fieldset>}<label>Notes <span className="optional">optional</span><textarea rows={2} maxLength={2000} value={draft.notes} onChange={e => patch({ notes: e.target.value })} placeholder="Anything worth remembering"/></label></div>;
}
export function TaskEditor({ task, date, onClose }: { task?: Task; date?: string; onClose: () => void }) {
  const { data, save } = useApp(), [draft, setDraft] = useState<TaskDraft>(task ? asDraft(task) : blankTask(date)), [busy, setBusy] = useState(false), [error, setError] = useState(''), [deleting, setDeleting] = useState(false), [allowConflict, setAllowConflict] = useState(false);
  const overlaps = conflicts(draft, data.tasks, task?.id);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setError('');
    try { validateTask(draft); } catch (e) { setError((e as Error).message); return; }
    if (overlaps.length && !allowConflict) { setError('Review the schedule conflict before saving.'); return; }
    setBusy(true);
    const ok = await save(state => {
      if (conflicts(draft, state.tasks, task?.id).length && !allowConflict) throw new Error('The schedule changed. Review conflicts and try again.');
      if (task) { const index = state.tasks.findIndex(t => t.id === task.id); if (index < 0) throw new Error('This task was removed in another tab.'); state.tasks[index] = { ...state.tasks[index], ...draft, title: draft.title.trim() }; }
      else state.tasks.push({ ...draft, title: draft.title.trim(), id: uid(), createdAt: new Date().toISOString(), completedAt: null });
    }, task ? 'Activity updated.' : 'Added to your planner.');
    setBusy(false); if (ok) onClose();
  };
  return <Modal title={task ? 'Edit activity' : 'A little intention'} onClose={() => !busy && onClose()}><form onSubmit={submit}><TaskFields draft={draft} onChange={next => { setDraft(next); setAllowConflict(false); }}/>{overlaps.length > 0 && <div className="notice notice-warning"><AlertTriangle size={18}/><div><strong>These activities overlap</strong><p>{overlaps.map(t => `${t.title} · ${timeLabel(t.time)}`).join(', ')}</p><label className="check-label"><input type="checkbox" checked={allowConflict} onChange={e => setAllowConflict(e.target.checked)}/>Keep this overlap</label></div></div>}{error && <p role="alert" className="error-text">{error}</p>}<div className="modal-actions">{task && <button type="button" className="icon-button danger" aria-label="Delete activity" onClick={() => setDeleting(true)}><Trash2 size={20}/></button>}<button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : task ? 'Save changes' : 'Add activity'}</button></div>{deleting && <div className="delete-confirm"><p>Delete “{task?.title}”? This also removes it from progress statistics.</p><button className="button button-danger" type="button" disabled={busy} onClick={async () => { setBusy(true); const ok = await save(s => { s.tasks = s.tasks.filter(t => t.id !== task?.id); }, 'Activity deleted.'); setBusy(false); if (ok) onClose(); }}>Delete activity</button><button className="text-button" type="button" onClick={() => setDeleting(false)}>Keep it</button></div>}</form></Modal>;
}
