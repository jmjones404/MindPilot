import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { readData, mutateData } from './lib/db';
import { emptyData, type AppData } from './types';

type Store = { data: AppData; loading: boolean; loadError: string; now: Date; toast: { text: string; error: boolean } | null;
  save: (change: (draft: AppData) => void, message?: string) => Promise<boolean>; notify: (message: string, error?: boolean) => void };
const Context = createContext<Store | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(emptyData), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [now, setNow] = useState(new Date()), [toast, setToast] = useState<Store['toast']>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const notify = (text: string, error = false) => setToast({ text, error });
  useEffect(() => {
    let active = true;
    const refresh = async () => { try { const result = await readData(); if (active) { setData(result); setLoadError(''); } } catch { if (active) setLoadError('MindPilot couldn’t open local storage. Enable browser storage, then reload. Your unsaved changes have not been stored.'); } finally { if (active) setLoading(false); } };
    void refresh();
    channel.current = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mindpilot-changes') : null;
    if (channel.current) channel.current.onmessage = () => void refresh();
    window.addEventListener('focus', refresh);
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => { active = false; channel.current?.close(); window.removeEventListener('focus', refresh); clearInterval(timer); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), toast.error ? 9000 : 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => document.documentElement.classList.toggle('dark', data.settings.theme === 'dark' || (data.settings.theme === 'system' && media.matches));
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, [data.settings.theme]);
  const save: Store['save'] = async (change, message) => {
    try {
      const result = await mutateData(change); setData(result); channel.current?.postMessage('changed');
      if (message) notify(message); return true;
    } catch (error) { notify(error instanceof Error ? `Not saved: ${error.message}` : 'Not saved. Local storage may be full or unavailable.', true); return false; }
  };
  return <Context.Provider value={{ data, loading, loadError, now, toast, save, notify }}>{children}</Context.Provider>;
}
export function useApp() { const context = useContext(Context); if (!context) throw new Error('AppProvider missing'); return context; }
