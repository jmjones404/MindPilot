import type { AssistantService, Interpretation, InterpretationContext } from './assistant';
import { MAX_INPUT_LENGTH } from './assistant';
let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, { resolve: (value: Interpretation) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
function stopWorker() {
  worker?.terminate(); worker = undefined;
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Background organizer unavailable.')); }
  pending.clear();
}
function inWorker(text: string, context: InterpretationContext): Promise<Interpretation> {
  if (!worker) {
    worker = new Worker(new URL('./organizer.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; result?: Interpretation; error?: string }>) => {
      const entry = pending.get(event.data.id); if (!entry) return;
      clearTimeout(entry.timer); pending.delete(event.data.id);
      if (event.data.result) entry.resolve(event.data.result); else entry.reject(new Error(event.data.error ?? 'Could not organize this text.'));
    };
    worker.onerror = stopWorker;
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId, timer = setTimeout(stopWorker, 15_000);
    pending.set(id, { resolve, reject, timer });
    // The parser needs preferences, not the entire activity history.
    try { worker!.postMessage({ id, text, context: { ...context, data: { ...context.data, tasks: [], routineLogs: [] } } }); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}
export const assistant: AssistantService = {
  async interpret(text, context) {
    if (text.length > MAX_INPUT_LENGTH) throw new Error('Please divide messages longer than 20,000 characters into smaller parts. Your full text is still here.');
    try { return await inWorker(text, context); }
    catch {
      // A browser that blocks workers can still use the same deterministic
      // organizer. Both entry points are precached with the application shell.
      const { OfflineAssistant } = await import('./offlineAssistant');
      const result = await new OfflineAssistant().interpret(text, context);
      result.notices.push('Using compatibility mode because background processing was unavailable.');
      return result;
    }
  },
};
