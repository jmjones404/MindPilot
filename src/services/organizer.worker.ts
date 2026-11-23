/// <reference lib="webworker" />
import { OfflineAssistant } from './offlineAssistant';
import type { InterpretationContext } from './assistant';
const organizer = new OfflineAssistant();
self.addEventListener('message', async (event: MessageEvent<{ id: number; text: string; context: InterpretationContext }>) => {
  const { id, text, context } = event.data;
  try { self.postMessage({ id, result: await organizer.interpret(text, context) }); }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'The organizer could not finish. Your text is still here.' }); }
});
