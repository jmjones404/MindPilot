import { useEffect, useRef, useState } from 'react';
import { Home as HomeIcon, Sparkles, CalendarDays, Leaf, ChartNoAxesCombined, Settings2, ShieldCheck, WifiOff, X, CheckCircle2, AlertCircle, Compass, Download } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useApp } from './state';
import { Logo } from './components/ui';
import { Settings } from './components/Settings';
import { TaskEditor } from './components/TaskEditor';
import { Home } from './screens/Home';
import { Planner } from './screens/Planner';
import { Rhythm } from './screens/Rhythm';
import { Progress } from './screens/Progress';
import { MindDump } from './screens/MindDump';
import { localDate } from './lib/dates';
import type { Task } from './types';
const navigation = [ { id: 'home', label: 'Home', icon: HomeIcon }, { id: 'minddump', label: 'MindDump', icon: Sparkles }, { id: 'planner', label: 'Planner', icon: CalendarDays }, { id: 'rhythm', label: 'My Rhythm', icon: Leaf }, { id: 'progress', label: 'Progress', icon: ChartNoAxesCombined } ];
function pageFromHash() { const key = location.hash.slice(1); return navigation.some(n => n.id === key) ? key : 'home'; }
export default function App() {
  const { data, loading, loadError, save, toast, notify, now } = useApp();
  const [plannerDate, setPlannerDate] = useState('');
  const [page, setPage] = useState(pageFromHash), [settings, setSettings] = useState(false), [editor, setEditor] = useState<{ task?: Task; date?: string } | null>(null);
  const [incoming, setIncoming] = useState({ text: '', key: 0 }), [online, setOnline] = useState(navigator.onLine), [cached, setCached] = useState(false), [swError, setSwError] = useState(false);
  const main = useRef<HTMLElement>(null);
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const { offlineReady: [offlineReady], needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, current) {
      registration.current = current;
      if (navigator.onLine && current?.active && !current.installing) void current.update().catch(() => {});
    },
    onRegisterError() { setSwError(true); },
  });
  useEffect(() => {
    const checkForUpdate = () => {
      const current = registration.current;
      if (navigator.onLine && document.visibilityState === 'visible' && current?.active && !current.installing) void current.update().catch(() => {});
    };
    window.addEventListener('online', checkForUpdate);
    window.addEventListener('focus', checkForUpdate);
    document.addEventListener('visibilitychange', checkForUpdate);
    const interval = window.setInterval(checkForUpdate, 60 * 60 * 1000);
    return () => {
      window.removeEventListener('online', checkForUpdate);
      window.removeEventListener('focus', checkForUpdate);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    const hash = () => setPage(pageFromHash()), network = () => setOnline(navigator.onLine);
    window.addEventListener('hashchange', hash); window.addEventListener('online', network); window.addEventListener('offline', network);
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(() => setCached(true)).catch(() => {});
    return () => { window.removeEventListener('hashchange', hash); window.removeEventListener('online', network); window.removeEventListener('offline', network); };
  }, []);
  useEffect(() => { main.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); document.title = `${navigation.find(n => n.id === page)?.label ?? 'Home'} · MindPilot`; }, [page]);
  const navigate = (value: string, date?: string) => { if (value === 'planner') setPlannerDate(date ?? ''); location.hash = value; setPage(value); };
  const toggleTask = async (task: Task) => {
    await save(state => { const found = state.tasks.find(t => t.id === task.id); if (!found) throw new Error('This activity was removed in another tab.'); found.completedAt = found.completedAt ? null : new Date().toISOString(); }, task.completedAt ? 'Activity marked unfinished.' : 'One little step, done.');
  };
  const capture = (text: string) => { setIncoming({ text, key: Date.now() }); navigate('minddump'); };
  const nav = (mobile = false) => <nav className={mobile ? 'bottom-nav' : 'side-nav'} aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}>{navigation.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon size={mobile ? 21 : 20} strokeWidth={1.7}/><span>{item.label}</span>{!mobile && item.id === 'minddump' && <span className="nav-new">✧</span>}</button>)}</nav>;
  if (loading) return <div className="loading-screen"><Logo/><span className="loading-dot"/><p>Making a little space…</p></div>;
  if (loadError) return <div className="loading-screen"><Logo/><AlertCircle size={32}/><h1>Your local storage needs attention</h1><p role="alert">{loadError}</p><button className="button button-primary" onClick={() => location.reload()}>Try again</button></div>;
  return <div className="app-shell"><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); main.current?.focus(); }}>Skip to content</a><aside className="sidebar"><button className="brand-button" aria-label="MindPilot home" onClick={() => navigate('home')}><Logo/></button><p className="sidebar-tagline">A little less on your mind.</p><span className="sidebar-section-label">YOUR EVERYDAY SPACE</span>{nav()}<div className="sidebar-bottom"><div className="sidebar-note"><Compass size={27} strokeWidth={1.3}/><h3>More space.<br/>More possibility.</h3><p>You steer.<br/>We help clear the way.</p><span className="sidebar-note-decoration" aria-hidden="true">✧</span></div><button className="sidebar-settings" onClick={() => setSettings(true)}><Settings2 size={19}/>Make it yours</button><div className="local-label"><ShieldCheck size={14}/>Local & private</div></div></aside><div className="app-content"><header className="topbar"><div className="desktop-breadcrumb"><span>Your space</span><span>/</span><strong>{navigation.find(n => n.id === page)?.label}</strong></div><div className="mobile-brand"><Logo small/></div><div className="topbar-actions"><span className={`connection-status ${!online ? 'offline' : ''}`}>{online ? <ShieldCheck size={15}/> : <WifiOff size={15}/>}<span>{online ? 'Your mind, your space' : 'Working offline'}</span></span><button className="icon-button settings-trigger" aria-label="Open settings" onClick={() => setSettings(true)}><Settings2 size={19}/></button><button className="avatar" aria-label="Personalize MindPilot" onClick={() => setSettings(true)}>{data.settings.name ? data.settings.name.slice(0, 1).toUpperCase() : <Compass size={20}/>}</button></div></header>{!online && <div className="offline-banner"><WifiOff size={15}/>You’re offline. Your saved activities and on-device planning are still available.</div>}{swError && <div className="offline-banner warning"><AlertCircle size={15}/>Offline setup didn’t finish. Reopen online to retry; local data is still saved.</div>}<main ref={main} id="main-content" tabIndex={-1}>{page === 'home' && <Home capture={capture} navigate={navigate} editTask={task => setEditor({ task })} toggleTask={toggleTask} addTask={() => setEditor({ date: localDate(now) })}/>}<div hidden={page !== 'minddump'}><MindDump incoming={incoming} navigate={navigate}/></div>{page === 'planner' && <Planner initialDate={plannerDate} editTask={task => setEditor({ task })} toggleTask={toggleTask} addTask={date => setEditor({ date })}/ >}{page === 'rhythm' && <Rhythm openSettings={() => setSettings(true)}/ >}{page === 'progress' && <Progress/>}</main>{nav(true)}</div>{settings && <Settings offlineReady={offlineReady || cached} onClose={() => setSettings(false)}/ >}{editor && <TaskEditor {...editor} onClose={() => setEditor(null)}/ >}{toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <AlertCircle size={19}/> : <CheckCircle2 size={19}/>}<span>{toast.text}</span></div>}{needRefresh && <div className="update-prompt" role="status"><Download size={20}/><div><strong>A fresh version is ready</strong><p>Finish any edits before updating.</p></div><button className="button button-primary" onClick={() => updateServiceWorker(true).catch(() => notify('Update couldn’t finish. Try reopening the app online.', true))}>Update</button><button className="icon-button" aria-label="Update later" onClick={() => setNeedRefresh(false)}><X size={18}/></button></div>}</div>;
}
