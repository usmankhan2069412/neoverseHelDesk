# Knowledge Gap Detection — PRD

> **Status**: `needs-triage`
> **Created**: 2026-05-11
> **Feature Owner**: Neoverse AI Desk Team

---

## Problem Statement

When the Neoverse AI Desk chatbot cannot answer a user's question (no relevant documents in the knowledge base), it returns a generic fallback message and the interaction ends there. The support team has **zero visibility** into what questions are going unanswered, how frequently they occur, or whether multiple users are experiencing the same knowledge gap.

This means:
- Recurring knowledge gaps go undetected for days or weeks.
- The support team cannot prioritize which documents to add to the knowledge base.
- Users repeatedly hit the same dead ends without the organization knowing.

## Solution

Automatically detect unanswered queries (where `docs_passed = 0` from the RAG pipeline), track them in a dedicated `knowledge_gaps` table, and surface them in the Control Center dashboard. When 3 or more distinct sessions encounter the same unanswered topic within 24 hours, the system escalates the gap with a visual alert, enabling the ops team to acknowledge or dismiss it.

The feature integrates directly into the existing Control Center via a tab toggle alongside the Recent Queries table — no new pages or navigation required.

## User Stories

1. As a support team lead, I want to see all unanswered queries in the Control Center, so that I know what knowledge gaps exist in our system.
2. As a support team lead, I want unanswered queries grouped by topic, so that I can see recurring patterns instead of individual raw queries.
3. As a support team lead, I want to see how many distinct users/sessions asked the same unanswered question, so that I can prioritize which gaps to fill first.
4. As a support team lead, I want an automatic alert when 3+ sessions hit the same knowledge gap, so that critical blind spots are surfaced without manual monitoring.
5. As a support team lead, I want to see the original query wordings alongside the normalized version, so that I understand the exact phrasing users are using.
6. As a support team lead, I want to acknowledge a knowledge gap, so that the alert clears and my team knows it's being worked on.
7. As a support team lead, I want to dismiss a knowledge gap, so that irrelevant or spam queries don't clutter the dashboard.
8. As a support team lead, I want to see first-seen and last-seen timestamps for each gap, so that I understand the timeline and urgency.
9. As a support team lead, I want the Knowledge Gaps tab to show a red indicator when escalated gaps exist, so that I notice new critical gaps at a glance.
10. As a support team lead, I want escalated gaps (3+ sessions) visually highlighted in the table, so that they stand out from single-occurrence gaps.
11. As a support agent, I want unanswered query detection to happen automatically when the chatbot responds, so that no manual tagging is required.
12. As a system admin, I want the knowledge gap count included in the dashboard stats, so that I can monitor the overall health of the knowledge base.
13. As a chatbot user, I want the system to learn from my unanswered question, so that the support team can eventually add the missing knowledge.

## Implementation Decisions

### Detection Mechanism

- An "unanswered query" is defined as any chat interaction where the RAG pipeline returns `docs_passed = 0`.
- This is deterministic and requires no user action (unlike thumbs-down voting).
- Detection happens inline in the chat endpoint, immediately after the AI message is saved.

### Query Grouping

- Queries are grouped using the existing `QueryPreprocessor` (normalize + spell-correct).
- The normalized query text serves as the grouping key in the `knowledge_gaps` table.
- This approach is simple and leverages existing infrastructure. A future upgrade path to semantic similarity clustering (cosine similarity > 0.85) is noted but out of scope.

### Storage — `knowledge_gaps` Table

New Supabase table with the following schema:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Auto-generated |
| `query_normalized` | TEXT (unique index) | Normalized query — grouping key |
| `sample_queries` | TEXT[] | Original user wordings |
| `session_ids` | TEXT[] | Distinct sessions that hit this gap |
| `hit_count` | INT | Total occurrences |
| `status` | TEXT | `open` / `acknowledged` / `dismissed` |
| `first_seen` | TIMESTAMPTZ | First occurrence |
| `last_seen` | TIMESTAMPTZ | Most recent occurrence |

- Upsert logic: if a matching `query_normalized` exists, append the new session ID (if distinct) and original query, increment `hit_count`, update `last_seen`.
- RLS enabled with `anon` access (consistent with existing tables).

### Escalation Threshold

- **3 distinct sessions** asking the same normalized query → escalated.
- Time window: 24 hours (not enforced at DB level for MVP — all-time count used, can add windowing later).

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/knowledge-gaps` | List all gaps where `status != 'dismissed'`, ordered by `last_seen` desc |
| `PATCH` | `/api/knowledge-gaps/{gap_id}` | Update status to `acknowledged` or `dismissed` |

Stats endpoint (`GET /api/stats`) extended with:
- `open_gaps: int` — count of gaps with status `open`
- `escalated_gaps: int` — count of gaps with `hit_count >= 3` AND status `open`

### Admin Actions

| Action | Effect |
|--------|--------|
| **Acknowledge** | `open` → `acknowledged`. Clears alert badge. Gap remains visible in list. |
| **Dismiss** | `open`/`acknowledged` → `dismissed`. Hidden from default view. |

No manual "Resolve" action — gaps resolve naturally when relevant documents are uploaded to the Archive and subsequent queries get `docs_passed > 0`.

### Control Center UI

- New tab toggle in the existing table section: `[ Recent Queries (N) ] [ Knowledge Gaps (N) 🔴 ]`
- Red dot indicator appears only when `escalated_gaps > 0`.
- Knowledge Gaps table columns: **Query** | **Times Asked** | **Sessions** | **Status** | **Last Seen** | **Actions**
- Rows with `hit_count >= 3` get an orange/red left border to visually distinguish escalated gaps.
- Action buttons rendered inline: ✓ (Acknowledge) and ✕ (Dismiss) with optimistic UI updates.
- Existing pagination component reused.

### Modules Modified

| Module | Changes |
|--------|---------|
| Supabase DB | New `knowledge_gaps` table + unique index |
| `backend/services/supabase_client.py` | `upsert_knowledge_gap()`, `list_knowledge_gaps()`, `update_knowledge_gap_status()` |
| `backend/main.py` | Chat endpoint: gap recording. New endpoints: GET/PATCH knowledge-gaps |
| `backend/models/schemas.py` | `KnowledgeGapOut`, `KnowledgeGapUpdateRequest`, extended `StatsResponse` |
| `src/services/api.ts` | `getKnowledgeGaps()`, `updateKnowledgeGap()` |
| `src/views/ControlCenter.tsx` | Tab toggle, Knowledge Gaps table, action buttons |

## Testing Decisions

- **Good tests verify external behavior through public interfaces.** A test should describe _what_ the system does ("unanswered query creates a knowledge gap"), not _how_ it does it (internal DB calls).
- No test script exists in `package.json` currently. Frontend verification via `npm run build`.
- Backend testing: manual verification via API calls to `/api/chat` with queries that will return `docs_passed = 0`, then checking `/api/knowledge-gaps` for the recorded gap.
- Key behaviors to verify:
  1. Chat with `docs_passed = 0` → gap row created
  2. Same normalized query from different session → `hit_count` increments, `session_ids` grows
  3. `GET /api/knowledge-gaps` returns gaps sorted by `last_seen`
  4. `PATCH` with `acknowledged` → status changes, gap still visible
  5. `PATCH` with `dismissed` → gap hidden from default list
  6. Stats endpoint returns correct `open_gaps` and `escalated_gaps` counts

## Out of Scope

- **Email notifications** — requires external email service (Resend/SendGrid). Can be added later as a hook on the `knowledge_gaps` table.
- **Semantic similarity clustering** — more accurate grouping via embeddings. Current normalized-text approach is MVP; upgrade path documented.
- **Auto-resolve** — automatically marking gaps as resolved when matching docs are uploaded to Archive.
- **Time-windowed escalation** — current threshold is all-time count. 24h sliding window can be added later via `last_seen` filtering.
- **Multi-tenancy** — single-tenant system, no per-org gap tracking.

## Further Notes

- The `QueryPreprocessor.normalize()` + `fix_spelling()` pipeline already exists in `rag_pipeline.py`. The chat endpoint will call it to get the normalized key before upserting.
- The feature is additive — no existing behavior changes. If the backend is offline, the Control Center gracefully shows empty gaps (existing error handling).
- Future enhancement: when a gap reaches escalation threshold, a Supabase Edge Function could send a webhook or email notification. The `knowledge_gaps` table design supports this without schema changes.
