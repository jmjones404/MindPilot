import type { AppData, TaskDraft } from '../types';
export const MAX_INPUT_LENGTH = 20_000;
export interface InterpretationContext { data: AppData; now: Date }
export interface ParsedTask { draft: TaskDraft; explanations: string[]; workout: boolean; warnings: string[]; selected: boolean }
export interface Interpretation { provider: 'offline-rules' | 'local-semantic'; tasks: ParsedTask[]; notices: string[] }
// Interpretation always runs on-device and returns proposals, never saved records.
// Optional local models must fall back to the deterministic organizer.
export interface AssistantService {
  interpret(text: string, context: InterpretationContext): Promise<Interpretation>;
}
