import { useEffect, useRef, useState } from 'react';
import { Sparkles, ShieldCheck, Check, Dumbbell, Info, AlertTriangle, RotateCcw, X } from 'lucide-react';
import { useApp } from '../state';
import { assistant } from '../services/organizerClient';
import { MAX_INPUT_LENGTH } from '../services/assistant';
import { proposeWorkout, type WorkoutResult } from '../services/workout';
import { uid, validateTask, type Task, type TaskDraft } from '../types';
import { conflicts } from '../lib/planning';
import { emptyPreference, normalizePhrase, validatePreference } from '../lib/preferences';
import { timeLabel } from '../lib/dates';
import { TaskFields } from '../components/TaskEditor';

type ReviewItem = { id: string; selected: boolean; draft: TaskDraft; original: TaskDraft; explanations: string[]; warnings: string[]; workout: boolean; result?: WorkoutResult; remember: boolean };
export function MindDump({ incoming, navigate }: { incoming: { text: string; key: number }; navigate: (page: string, date?: string) => void }) {
  const { data, save } = useApp();
  const [text, setText] = useState(''), [items, setItems] = useState<ReviewItem[] | null>(null), [notices, setNotices] = useState<string[]>([]);
  const [busy, setBusy] = useState<'organizing' | 'saving' | null>(null), [error, setError] = useState(''), [savedCount, setSavedCount] = useState(0);
  const [savedDate, setSavedDate] = useState(''), [allowOverlap, setAllowOverlap] = useState(false), [analyzedText, setAnalyzedText] = useState('');
  const review = useRef<HTMLElement>(null), errorRef = useRef<HTMLParagraphElement>(null), request = useRef(0), processing = useRef<'organizing' | 'saving' | null>(null);
  const analyze = async (value: string) => {
    if (processing.current === 'saving') return;
    if (!value.trim()) { setError('Write a thought first, then organize it.'); return; }
    const id = ++request.current;
    processing.current = 'organizing'; setBusy('organizing'); setError(''); setSavedCount(0); setAllowOverlap(false);
    try {
      // Let the loading state paint before the bounded local grammar pass.
      await new Promise<void>(resolve => requestAnimationFrame(() => { setTimeout(resolve, 0); }));
      const response = await assistant.interpret(value, { data, now: new Date() });
      if (id !== request.current) return;
      setNotices(response.notices); setAnalyzedText(value);
      setItems(response.tasks.map(task => {
        const result: WorkoutResult | undefined = task.workout ? task.draft.date ? proposeWorkout(data, task.draft, new Date()) : { kind: 'question', question: 'Choose a date to use a saved workout, or keep this activity undated.', choices: [] } : undefined;
        return { ...task, id: uid(), original: task.draft, draft: result?.kind === 'proposal' ? result.draft : task.draft, result, remember: false };
      }));
    } catch (e) {
      if (id !== request.current) return;
      setItems(null);
      setError(e instanceof Error ? e.message : 'These thoughts could not be organized. Your text is still here; try again.');
    } finally { if (id === request.current) { processing.current = null; setBusy(null); } }
  };
  useEffect(() => { if (incoming.text) { setText(incoming.text); void analyze(incoming.text); } }, [incoming.key]);
  useEffect(() => {
    if (!busy && items !== null && text.trim() === analyzedText.trim()) { review.current?.focus(); review.current?.scrollIntoView({ block: 'start' }); }
  }, [analyzedText, busy === 'organizing']);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const update = (id: string, patch: Partial<ReviewItem>) => { setAllowOverlap(false); setItems(current => current?.map(i => i.id === id ? { ...i, ...patch } : i) ?? null); };
  const generate = (item: ReviewItem, chosenId?: string) => {
    const result: WorkoutResult = item.draft.date ? proposeWorkout(data, item.draft, new Date(), chosenId) : { kind: 'question', question: 'Choose a date above to use a saved workout, or save it undated.', choices: [] };
    update(item.id, { result, draft: result.kind === 'proposal' ? result.draft : item.draft });
  };
  const selected = items?.filter(i => i.selected) ?? [];
  const stale = items !== null && text.trim() !== analyzedText.trim();
  const proposals: Task[] = selected.map(i => ({ ...i.draft, id: i.id, createdAt: '', completedAt: null }));
  const overlapNames = [...new Set(proposals.flatMap(t => conflicts(t, [...data.tasks, ...proposals], t.id).map(x => x.title)))];
  const confirm = async () => {
    if (processing.current || stale || !selected.length) return;
    setError('');
    try { selected.forEach(i => validateTask(i.draft)); } catch (e) { setError((e as Error).message); return; }
    if (overlapNames.length && !allowOverlap) { setError('Review the overlaps below, or choose another time.'); return; }
    processing.current = 'saving'; setBusy('saving');
    const ok = await save(state => {
      if (!allowOverlap && proposals.some(t => conflicts(t, [...state.tasks, ...proposals], t.id).length)) throw new Error('Your schedule changed. Review the conflicts and try again.');
      for (const item of selected) {
        state.tasks.push({ ...item.draft, title: item.draft.title.trim(), id: uid(), createdAt: new Date().toISOString(), completedAt: null });
        if (item.remember && (item.draft.category !== item.original.category || item.draft.subcategory !== item.original.subcategory)) {
          const rule = { ...emptyPreference(), match: item.original.title, category: item.draft.category, subcategory: item.draft.subcategory ?? '', source: 'correction' as const };
          validatePreference(rule);
          const existing = state.memories.find(m => m.rule?.source === 'correction' && normalizePhrase(m.rule.match) === normalizePhrase(rule.match));
          const memory = { id: existing?.id ?? uid(), kind: 'preference' as const, title: `Category for ${rule.match}`.slice(0, 140), detail: 'Use only for similar subject words. Explicitly remembered during review; editable or removable here.', rule };
          if (existing) Object.assign(existing, memory); else state.memories.push(memory);
        }
      }
    }, `${selected.length} ${selected.length === 1 ? 'item' : 'items'} saved to your planner.`);
    processing.current = null; setBusy(null);
    if (ok) { setSavedDate(selected.find(i => i.draft.date)?.draft.date ?? 'undated'); setSavedCount(selected.length); setItems(null); setText(''); }
  };
  return <div className="screen minddump-screen">
    <div className="page-intro"><div><p className="eyebrow">A LANDING PLACE FOR YOUR THOUGHTS</p><h1>Let it all out<span className="soft-period">.</span></h1><p>It doesn’t have to be organized. That’s why you’re here.</p></div><span className="mode-badge"><ShieldCheck size={15}/>On-device mode</span></div>
    {savedCount > 0 ? <section className="card saved-state" role="status"><span className="success-orb"><Check size={32}/></span><h2>A little less on your mind.</h2><p>{savedCount} {savedCount === 1 ? 'item is' : 'items are'} saved in your local planner. Undated items stay under “When there’s a moment.”</p><div className="button-row"><button className="button button-primary" onClick={() => navigate('planner', savedDate)}>Open planner</button><button className="button button-secondary" onClick={() => setSavedCount(0)}>Capture another thought</button></div></section> : <>
      <section className="card minddump-input"><form onSubmit={e => { e.preventDefault(); void analyze(text); }}><label htmlFor="minddump-text"><Sparkles size={20}/>What’s on your mind?</label><textarea id="minddump-text" value={text} onChange={e => setText(e.target.value)} placeholder="I need groceries tomorrow, have to clean my apartment, and really need to hit the gym tonight…" rows={5}/><div className="minddump-input-footer"><span className="muted small">No perfect words needed. {text.length.toLocaleString()}/{MAX_INPUT_LENGTH.toLocaleString()} characters</span><button className="button button-primary" disabled={!text.trim() || !!busy}><Sparkles size={17}/>{busy === 'organizing' ? 'Organizing…' : items ? 'Review updated thoughts' : 'Find my next steps'}</button></div></form></section>
      <p className="honesty-note"><Info size={16}/>Your words are organized on your device, even offline. Review suggestions before saving.</p>
      <p className="sr-only" role="status" aria-live="polite">{busy === 'organizing' ? 'Organizing your thoughts.' : items ? `${items.length} suggestions ready. ${selected.length} selected. Nothing saved yet.` : ''}</p>
      {items && <section className="review-section" ref={review} tabIndex={-1} aria-label="Review suggestions">
        <div className="section-heading"><div><p className="eyebrow">YOU’RE IN THE PILOT’S SEAT</p><h2>{items.length ? 'A few possible next steps' : 'A moment to pause'}</h2></div><span className="count-badge">{selected.length} selected</span></div>
        {notices.map(n => <p key={n} className="muted small">{n}</p>)}
        {stale && <p className="notice notice-warning" role="status">Your input changed. Choose “Review updated thoughts” before saving these suggestions.</p>}
        {items.length === 0 && <div className="card"><p>No suggestion was found. Your text is still here. Try describing an activity or a note you want to keep.</p></div>}
        <div className="review-cards">{items.map((item, index) => <article className={`card review-card ${!item.selected ? 'deselected' : ''}`} key={item.id}>
          <div className="review-card-header"><label className="check-label"><input type="checkbox" checked={item.selected} onChange={e => update(item.id, { selected: e.target.checked })}/><strong>{`Suggested ${item.draft.kind ?? 'task'} ${index + 1}`}</strong></label><span className="tiny-label">ON YOUR DEVICE</span></div>
          <TaskFields draft={item.draft} prefix={`review-${item.id}`} onChange={draft => update(item.id, { draft })}/>
          {(item.draft.category !== item.original.category || item.draft.subcategory !== item.original.subcategory) && <label className="check-label"><input type="checkbox" checked={item.remember} onChange={e => update(item.id, { remember: e.target.checked })}/>Remember this category for thoughts similar to “{item.original.title}”. You can edit or delete it in My Rhythm.</label>}
          {item.draft.kind === 'reminder' && <p className="small muted">Saved reminders appear in the planner. MindPilot does not send background notifications.</p>}
          {item.warnings.length > 0 && <div className="notice notice-warning"><AlertTriangle size={18}/><ul>{item.warnings.map(w => <li key={w}>{w}</li>)}</ul></div>}
          {item.workout && item.result?.kind === 'question' && <div className="explanation workout-question"><h3>A little context would help</h3><p>{item.result.question} You can also save the activity above as it is.</p>{item.result.choices.length > 0 && <div className="routine-choices">{item.result.choices.map(r => <button className="button button-secondary" key={r.id} onClick={() => generate(item, r.id)}>{r.name} · {timeLabel(r.time)}</button>)}</div>}<div className="button-row"><button className="text-button" onClick={() => navigate('rhythm')}>Set workout preferences</button><button className="text-button" onClick={() => generate(item)}><RotateCcw size={15}/>Check saved routines</button></div></div>}
          <details className="explanation"><summary>Why this suggestion?</summary><p>From your words: {item.original.sourceText}</p>{item.explanations.map(ex => <p key={ex}>{ex}</p>)}{item.result?.kind === 'proposal' && <><h4><ShieldCheck size={15}/>What you told us</h4><ul>{item.result.facts.map(f => <li key={f}>{f}</li>)}</ul><h4><Sparkles size={15}/>What we’re suggesting</h4>{item.result.inferences.map(f => <p key={f}>{f}</p>)}{item.result.freeTime && item.result.conflictNames.length > 0 && <button className="text-button" onClick={() => update(item.id, { draft: { ...item.draft, time: item.result?.kind === 'proposal' ? item.result.freeTime ?? item.draft.time : item.draft.time } })}>Use free time {timeLabel(item.result.freeTime)}</button>}</>}</details>
        </article>)}</div>
        {overlapNames.length > 0 && <div className="notice notice-warning"><AlertTriangle size={20}/><div><strong>Your proposed schedule has overlaps</strong><p>{overlapNames.join(', ')}. Edit a start time above to make room.</p><label className="check-label"><input type="checkbox" checked={allowOverlap} onChange={e => setAllowOverlap(e.target.checked)}/>I reviewed these overlaps and want to keep them</label></div></div>}
        {items.length > 0 && <div className="confirm-bar"><span><ShieldCheck size={17}/>Nothing is saved until you confirm.</span><div className="button-row"><button className="text-button" onClick={() => setItems(null)} disabled={!!busy}><X size={15}/>Discard suggestions</button><button className="button button-primary" disabled={!!busy || stale || !selected.length || (!!overlapNames.length && !allowOverlap)} onClick={confirm}><Check size={18}/>{busy === 'saving' ? 'Saving…' : `Confirm ${selected.length} ${selected.length === 1 ? 'activity' : 'activities'}`}</button></div></div>}
      </section>}
      {error && <p className="error-text" role="alert" ref={errorRef} tabIndex={-1}>{error}</p>}
      {!items && <div className="minddump-tips"><div><span className="tip-icon"><Sparkles size={22}/></span><h3>Speak your mind</h3><p>Tasks, reminders, plans, or notes. Start with what’s there.</p></div><div><span className="tip-icon"><Dumbbell size={22}/></span><h3>Build on your rhythm</h3><p>Saved routines and preferences can help suggest a time or category.</p></div><div><span className="tip-icon"><Check size={22}/></span><h3>You have the final say</h3><p>Review, adjust, and confirm. Your day is always yours.</p></div></div>}
    </>}
  </div>;
}
