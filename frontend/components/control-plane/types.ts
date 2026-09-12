import { API_URL } from "@/lib/api";

export type View = "workbench" | "overview" | "models" | "knowledge" | "trace" | "security";
export type Workspace = { id: string; name: string };
export type StoredFile = { id: string; display_name: string; size_bytes: number; status: string };
export type KnowledgeBase = { id: string; name: string; status: string; active_index_version: number | null };
export type Job = { id: string; status: string; completed_documents: number; total_documents: number; error_message: string | null };
export type Hit = { score: number; text: string; citation: { display_name: string; page_start: number; page_end: number } };
export type InferenceResult = { model_id: string; model_name: string; provider: "ollama"; content: string; duration_ms: number; local: true };

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  const body = await response.json().catch(() => null) as ({ error?: { message?: string } } & T) | null;
  if (!response.ok) throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
  return body as T;
}

export function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(value / 1024))} KB`;
}

export const traceSteps = [
  ["Task submitted", "LOCAL INFERENCE REQUEST", "0.1s"],
  ["Model routed", "CAPABILITY REGISTRY", "0.1s"],
  ["Workspace read", "LOCAL CONTEXT", "0.2s"],
  ["Inference executed", "OLLAMA PROVIDER", "—"],
  ["Response received", "LOCAL RESULT", "—"],
] as const;
