import type { AppData, TaskDraft } from '../types';
export interface InterpretationContext { data: AppData; now: Date }
export interface ParsedTask { draft: TaskDraft; explanations: string[]; workout: boolean }
export interface Interpretation { provider: 'offline-rules' | 'ai'; tasks: ParsedTask[]; notices: string[] }
// A future AI adapter must call a server-side endpoint, validate its response, and return
// proposals only. It must never write storage or expose an API key in this client.
export interface AssistantService {
  interpret(text: string, context: InterpretationContext): Promise<Interpretation>;
}
