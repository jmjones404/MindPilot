import { useEffect, useState } from 'react';
import { useApp } from '../state';
import { categoryInfo } from '../lib/categories';
export function CategoryDetailsEditor() {
  const { data, save } = useApp();
  const [category, setCategory] = useState(data.settings.categories[0] ?? ''), [description, setDescription] = useState(''), [subcategories, setSubcategories] = useState('');
  useEffect(() => {
    if (!data.settings.categories.includes(category)) { setCategory(data.settings.categories[0] ?? ''); return; }
    const info = categoryInfo(category, data.settings); setDescription(info.description); setSubcategories(info.subcategories.join(', '));
  }, [category, data.settings]);
  return <details className="explanation"><summary>Category descriptions and subcategories</summary><form className="form-fields" onSubmit={async e => {
    e.preventDefault();
    await save(s => { if (!s.settings.categories.includes(category)) throw new Error('This category was removed. Choose another category.'); s.settings.categoryDetails ??= {}; s.settings.categoryDetails[category] = { description: description.trim(), subcategories: [...new Set(subcategories.split(',').map(c => c.trim()).filter(Boolean))] }; }, 'Category details saved. Existing activities keep their labels.');
  }}><label>Describe category<select value={category} onChange={e => setCategory(e.target.value)}>{data.settings.categories.map(c => <option key={c}>{c}</option>)}</select></label><label>Category description<textarea rows={2} maxLength={500} value={description} onChange={e => setDescription(e.target.value)} placeholder="What belongs in this category?"/></label><label>Subcategories, separated by commas<input maxLength={500} value={subcategories} onChange={e => setSubcategories(e.target.value)}/></label><button className="button button-secondary">Save category details</button></form></details>;
}
