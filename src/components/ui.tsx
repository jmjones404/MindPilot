import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X, Plus, Check, Clock3, Star, Dumbbell, MoreHorizontal } from 'lucide-react';
import type { Task } from '../types';
import { friendlyDate, timeLabel } from '../lib/dates';

export function Logo({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'brand-small' : ''}`}><span className="brand-symbol"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M9 26V15c0-4 3-5 5-1l6 10 6-10c2-4 5-3 5 1v11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 29q8 5 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span><span>mindpilot<span className="brand-period">.</span></span></div>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => { ref.current?.showModal(); const before = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = before; }; }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}><div className="modal-header"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
export function EmptyState({ icon, title, detail, action, onAction }: { icon: ReactNode; title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{detail}</p>{action && <button className="button button-secondary" onClick={onAction}><Plus size={16}/>{action}</button>}</div>;
}
export function ProgressRing({ percent, size = 74, children }: { percent: number; size?: number; children?: ReactNode }) {
  const radius = 31, circumference = 2 * Math.PI * radius;
  return <div className="progress-ring" style={{ width: size, height: size }} role="img" aria-label={`${percent}% complete`}><svg viewBox="0 0 76 76" aria-hidden="true"><circle className="ring-track" cx="38" cy="38" r={radius}/><circle className="ring-value" cx="38" cy="38" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)}/></svg><span>{children ?? `${percent}%`}</span></div>;
}
export function TaskRow({ task, onToggle, onEdit, showDate = false }: { task: Task; onToggle: () => void; onEdit: () => void; showDate?: boolean }) {
  return <div className={`task-row ${task.completedAt ? 'is-complete' : ''}`}><button className="task-check" role="checkbox" aria-checked={!!task.completedAt} aria-label={`Complete ${task.title}`} onClick={onToggle}>{task.completedAt && <Check size={16}/>}</button><button className="task-main" onClick={onEdit}><span className="task-title">{task.title}</span><span className="task-meta"><span className={`category category-${task.category.toLowerCase().replace(/\W/g, '')}`}>{task.exercises ? <Dumbbell size={12}/> : null}{task.category}</span>{showDate && <span>{friendlyDate(task.date)}</span>}{task.time && <span><Clock3 size={12}/>{timeLabel(task.time)}</span>}</span></button>{task.priority && <Star className="priority-star" size={15} aria-label="Priority"/>}<button className="icon-button" aria-label={`Edit ${task.title}`} onClick={onEdit}><MoreHorizontal size={19}/></button></div>;
}
