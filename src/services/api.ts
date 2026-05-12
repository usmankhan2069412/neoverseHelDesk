/**
 * Neoverse API Client
 * Thin wrapper around fetch() for all backend endpoints.
 */

const API_BASE = "http://localhost:8000/api";

// ─── Helpers ─────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ─── Chat ────────────────────────────────────────────────

export interface ChatResult {
  answer: string;
  intent: string;
  sources: string[];
  docs_passed: number;
  top_score: number;
  session_id: string;
  message_id: string;
}

export async function sendMessage(
  query: string,
  sessionId?: string
): Promise<ChatResult> {
  return request<ChatResult>("/chat", {
    method: "POST",
    body: JSON.stringify({ query, session_id: sessionId }),
  });
}

// ─── Feedback ────────────────────────────────────────────

export async function submitFeedback(
  messageId: string,
  vote: "up" | "down"
): Promise<{ success: boolean }> {
  return request("/feedback", {
    method: "POST",
    body: JSON.stringify({ message_id: messageId, vote }),
  });
}

// ─── Sessions ────────────────────────────────────────────

export interface Session {
  id: string;
  title: string | null;
  created_at: string;
  message_count: number;
}

export interface ApiMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  intent?: string;
  sources?: string[];
  docs_passed?: number;
  top_score?: number;
  created_at: string;
}

export async function getSessions(): Promise<Session[]> {
  return request<Session[]>("/sessions");
}

export async function createSession(
  title?: string
): Promise<Session> {
  return request<Session>("/sessions", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function getSessionMessages(
  sessionId: string
): Promise<ApiMessage[]> {
  return request<ApiMessage[]>(`/sessions/${sessionId}/messages`);
}

export async function deleteSession(
  sessionId: string
): Promise<void> {
  await request(`/sessions/${sessionId}`, { method: "DELETE" });
}

// ─── Documents ───────────────────────────────────────────

export interface ApiDocument {
  id: string;
  title: string;
  author: string;
  category: string;
  tags: string[];
  status: "indexed" | "processing" | "failed";
  file_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

export async function getDocuments(): Promise<ApiDocument[]> {
  return request<ApiDocument[]>("/documents");
}

export async function uploadDocument(
  file: File,
  title: string,
  category: string,
  tags: string
): Promise<ApiDocument> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("category", category);
  form.append("tags", tags);

  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    body: form,
    // Don't set Content-Type — browser sets multipart boundary automatically
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed ${res.status}: ${body}`);
  }

  return res.json() as Promise<ApiDocument>;
}

export async function deleteDocument(
  docId: string
): Promise<void> {
  await request(`/documents/${docId}`, { method: "DELETE" });
}

// ─── Stats ───────────────────────────────────────────────

export interface DashboardStats {
  total_queries: number;
  total_sessions: number;
  resolution_rate: number;
  thumbs_up_count: number;
  thumbs_down_count: number;
  intents: Record<string, number>;
  recent_queries: Array<{
    id: string;
    text: string;
    intent: string;
    sources: string[];
    created_at: string;
    session_id: string;
    is_unanswered?: boolean;
  }>;
  open_gaps: number;
  escalated_gaps: number;
}

export async function getStats(): Promise<DashboardStats> {
  return request<DashboardStats>("/stats");
}

// ─── Knowledge Gaps ──────────────────────────────────────

export interface KnowledgeGap {
  id: string;
  query_normalized: string;
  sample_queries: string[];
  session_ids: string[];
  hit_count: number;
  status: "open" | "acknowledged" | "dismissed";
  first_seen: string;
  last_seen: string;
}

export async function getKnowledgeGaps(): Promise<KnowledgeGap[]> {
  return request<KnowledgeGap[]>("/knowledge-gaps");
}

export async function updateKnowledgeGap(
  gapId: string,
  status: "acknowledged" | "dismissed"
): Promise<KnowledgeGap> {
  return request<KnowledgeGap>(`/knowledge-gaps/${gapId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ─── Health ──────────────────────────────────────────────

export async function checkHealth(): Promise<{ status: string; rag_ready: boolean }> {
  return request("/health");
}
