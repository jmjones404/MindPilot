import { useApp } from '../state';
import type { OrganizerPreference } from '../types';
import { DAY_NAMES } from '../lib/dates';
export function PreferenceFields({ rule, onChange }: { rule: OrganizerPreference; onChange: (rule: OrganizerPreference) => void }) {
  const { data } = useApp();
  const patch = (value: Partial<OrganizerPreference>) => onChange({ ...rule, ...value });
  const categories = [...new Set([...data.settings.categories, ...(rule.category ? [rule.category] : [])])];
  return <div className="form-fields">
    <label>Example activity<input required maxLength={180} value={rule.match} onChange={e => patch({ match: e.target.value })} placeholder="Reply to family emails"/></label>
    <label>Apply this preference to<select value={rule.matchMode} onChange={e => patch({ matchMode: e.target.value as OrganizerPreference['matchMode'] })}><option value="exact">Only this exact activity</option><option value="similar">Activities with similar subject words</option></select></label>
    <p className="small muted">Similar matches must share specific subject words. A correction never applies to every activity. Preferred times need a date. Suggested timing stays editable and explicit dates and times take priority.</p>
    <div className="form-grid"><label>Preferred category<select value={rule.category} onChange={e => patch({ category: e.target.value, subcategory: '' })}><option value="">No category preference</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>Preferred subcategory<input value={rule.subcategory} maxLength={60} onChange={e => patch({ subcategory: e.target.value })}/></label><label>Preferred time<input type="time" value={rule.time} onChange={e => patch({ time: e.target.value })}/></label></div>
    <fieldset><legend>Preferred days <span className="optional">optional; proposes the next matching day</span></legend><div className="day-pills">{[1, 2, 3, 4, 5, 6, 0].map(day => <button type="button" key={day} aria-label={DAY_NAMES[day]} aria-pressed={rule.days.includes(day)} className={rule.days.includes(day) ? 'selected' : ''} onClick={() => patch({ days: rule.days.includes(day) ? rule.days.filter(d => d !== day) : [...rule.days, day] })}>{DAY_NAMES[day].slice(0, 2)}</button>)}</div></fieldset>
  </div>;
}
