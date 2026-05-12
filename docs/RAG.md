# Neoverse RAG System PRD

## Problem Statement

The IT Helpdesk requires an intelligent, automated support system capable of
interpreting diverse user queries (including multi-lingual, misspelled, or
conversational inputs), retrieving highly relevant technical documentation
without hallucinating, and continuously learning from user interactions.

## Solution

An advanced 8-step Hybrid RAG System (`NeoversRAGSystem`) utilizing query
preprocessing, local intent classification (DistilBERT), LLM-based query
expansion (HyDE via LLaMA-3.3), hybrid retrieval (Supabase), CrossEncoder
ReRanking, C-RAG relevance grading, LLM answer generation, and a persistent
feedback loop.

---

## RAG Pipeline Workflow (Step-by-Step)

### Step 1 — Query Preprocessing

**Module:** `QueryPreprocessor`

**Purpose:** Clean and normalize the raw user query.

**Process:**

1. **Normalization:** Convert text to lowercase, strip whitespace, and collapse
   extra spaces.
2. **Spelling Correction:** Uses `pyspellchecker` to fix typos — applied only
   when text appears to be English (skipped if >40% of words are unknown,
   preventing corruption of non-English text).
3. **spaCy Tokenization:** Optionally tokenizes for downstream processing.

**Input:** `"Helo my passwrd is not wokring"` **Output:**
`"hello my password is not working"`

---

### Step 2 — Intent Classification

**Module:** `IntentClassifier`

**Purpose:** Identify what the user actually wants so the system can route
accordingly.

**Intents:** `FAQ`, `IT_Issue`, `Complaint`, `Small_Talk`

**Process:**

1. **DistilBERT Model:** Attempts to classify via fine-tuned custom model
   (`intent_model_v1`).
2. **Confidence Check:** If model confidence ≥ 0.6, use the prediction.
3. **Keyword Fallback:** If model fails or confidence is low:
   - `Small_Talk` — Short greetings only (`hello`, `hi`, `bye`, `thanks`).
   - `Complaint` — Keywords like `angry`, `frustrated`, `unacceptable`.
   - `FAQ` / `IT_Issue` — Everything else.

**Routing:**

- `Small_Talk` → Jump to Step 7A (Small Talk Response)
- `Complaint` → Jump to Step 7B (Complaint Handler)
- `FAQ` / `IT_Issue` → Continue to Step 3

---

### Step 3 — Query Rewrite & HyDE

**Module:** `QueryExpander`

**Purpose:** Translate non-English queries to English and expand technical terms
for better retrieval.

**Process:**

1. **LLM Query Rewrite:** Sends query to LLaMA-3.3-70B via Groq with
   `REWRITE_SYSTEM` prompt.
2. **Translation:** Non-English input is converted to English.
3. **Abbreviation Expansion:** `vpn` → `Virtual Private Network`.
4. **Keyword Enrichment:** Adds relevant technical terms.
5. **HyDE (Hypothetical Document Embedding):** Generates a short hypothetical
   answer, then embeds it to bridge the query-document vocabulary gap.

**Input:** `"mera wifi connect nahi ho rahi"` **Output:**
`"WiFi connection not working — wireless network adapter troubleshooting"`

---

### Step 4 — Hybrid Retrieval (Supabase)

**Module:** `hybrid_retrieve()`

**Purpose:** Retrieve the most relevant document chunks using both dense
semantic search and sparse keyword search.

**Process:**

1. **Embedding:** Query is converted to a vector via
   `paraphrase-multilingual-MiniLM-L12-v2`.
2. **Supabase RPC Call:** Calls `match_documents` with:
   - `query_embedding`: dense vector
   - `query_text`: original (for full-text search)
   - `match_count`: 10 candidates (configurable)
3. **pgvector Semantic Search:** Finds semantically similar chunks.
4. **Full-Text Search:** Finds keyword-matched chunks.
5. **Score Combination:** Both scores are merged in Supabase for hybrid ranking.

**Output:** Up to 10 candidate documents with similarity scores.

---

### Step 5 — CrossEncoder ReRanking

**Module:** `ReRanker`

**Model:** `ms-marco-MiniLM-L-6-v2`

**Purpose:** Re-rank retrieved candidates by computing pairwise query-document
relevance.

**Process:**

1. **Pair Creation:** Each document chunk is paired with the query.
2. **CrossEncoder Scoring:** Model outputs raw relevance scores.
3. **Sigmoid Normalization:** Converts raw scores to probabilities (0–1).
4. **Min-Max Normalization:** Scales scores so the best document = 1.0.
5. **Feedback Boost:** Thumbs-up documents receive a `1.3x` multiplier on their
   scores.
6. **Early Rejection:** If `max_raw_score < 1e-5`, all docs are rejected to
   prevent hallucinations.
7. **Top-N Selection:** Returns top 5 re-ranked documents (configurable).

---

### Step 6 — C-RAG Relevance Grade

**Module:** `crag_grade()`

**Purpose:** Filter out irrelevant documents using a score threshold before
sending context to LLM.

**Process:**

1. **Threshold Check:** Documents with score < 0.25 are rejected.
2. **Pass/Fail Logging:** Each document is logged as `PASS` or `FAIL`.
3. **Empty Context Handling:** If all docs fail threshold, the system proceeds
   with empty context to trigger LLM's `NO_INFO_RESPONSE` (instead of a costly
   redundant retrieval).
4. **Return:** Passes only the relevant documents forward.

---

### Step 7 — LLM Answer Generation

**Module:** `generate_answer()`

**Purpose:** Generate a human-friendly, context-grounded answer.

**Process:**

1. **Context Assembly:** Relevant document chunks are joined together.
2. **System Persona:** `SYSTEM_PERSONA` is injected (IT support assistant
   rules).
3. **History Injection:** Last 5 conversation turns are prepended.
4. **LLM Generation:** LLaMA-3.3-70B generates answer following system rules.
5. **Fallback Trigger:** If no relevant docs, returns `NO_INFO_RESPONSE`.
6. **Source Tracking:** Document IDs are extracted for feedback tracking.

**Special Routes:**

- **7A — Small Talk:** Uses `SMALL_TALK_SYSTEM` for friendly, conversational
  response.
- **7B — Complaint:** Uses `COMPLAINT_SYSTEM` for empathetic de-escalation and
  escalation options.

---

### Step 8 — User Feedback Loop

**Module:** `FeedbackSystem`

**Purpose:** Self-learning mechanism to improve future retrieval.

**Process:**

1. **Thumbs Up:**
   - Source document boost score is multiplied by `1.3x`.
   - Stored in `feedback_scores.json`.
2. **Thumbs Down:**
   - Query, answer, and sources are flagged for human review.
   - Saved in `feedback_scores.json` under `flagged` list.
3. **Training Data:** Query + intent + feedback is saved to `training_data.json`
   for future model retraining.

**Effect:** Documents with high positive feedback will be ranked higher in
future retrievals.

---

## Pipeline Architecture Diagram

```
USER QUERY
    │
    ▼
[Step 1] QueryPreprocessor ── normalize + spellcheck
    │
    ▼
[Step 2] IntentClassifier ── classify: FAQ / IT_Issue / Complaint / Small_Talk
    │
    ├─ Small_Talk ──────────► [Step 7A] Small Talk Response ──► END
    │
    ├─ Complaint ───────────► [Step 7B] Complaint Handler ──────► END
    │
    └─ FAQ/IT_Issue ────────► [Step 3] QueryExpander ── rewrite + HyDE
                                │
                                ▼
                          [Step 4] Hybrid Retrieval (Supabase pgvector + FTS)
                                │
                                ▼
                          [Step 5] ReRanker (CrossEncoder ms-marco-MiniLM)
                                │
                                ▼
                          [Step 6] C-RAG Grading (threshold = 0.25)
                                │
                                ▼
                          [Step 7] LLM Generation (LLaMA-3.3-70B)
                                │
                                ▼
                          [Step 8] Feedback System ── thumbs up/down boost
                                │
                                ▼
                              ANSWER
```

---

## User Stories

1. As an IT support user, I want to submit technical questions in multiple
   languages (and with typos), so that I can receive accurate support natively.
2. As a frustrated user, I want the system to detect my complaint intent, so
   that it can provide an empathetic response and escalation path instead of
   robotic troubleshooting.
3. As a system administrator, I want the system to filter out completely
   irrelevant documents via C-RAG grading, so that LLM hallucinations are
   minimized.
4. As a user, I want to provide thumbs up/down feedback on answers, so that the
   AI boosts the relevance of helpful documents and improves future retrieval
   accuracy.

## Implementation Decisions

- **Pipeline Architecture:** Encapsulated in `backend/rag_pipeline.py`.
- **Core Modules Built:** `QueryPreprocessor` (spaCy), `IntentClassifier`
  (DistilBERT fallback), `QueryExpander` (ChatGroq), `ReRanker`
  (ms-marco-MiniLM), and `FeedbackSystem`.
- **Database:** Supabase for Hybrid Retrieval (dense `pgvector` + sparse
  full-text search).
- **LLM Engine:** ChatGroq (`llama-3.3-70b-versatile`) handling query rewrites,
  HyDE, and generation.
- **Safeguards:** CrossEncoder minimum threshold checking and C-RAG gating to
  reject low-confidence context early.

## Testing Decisions

- **E2E Pipeline Tests:** Validate that the system correctly routes through all
  8 steps given a standard query.
- **Intent Routing Tests:** Verify keyword fallbacks and DistilBERT model
  correctly identify `Small_Talk`, `Complaint`, and `IT_Issue`.
- **Hallucination Guards:** Test that the system returns the standard
  `NO_INFO_RESPONSE` when queried for data outside the knowledge base.
- **Feedback State:** Ensure `feedback_scores.json` and `training_data.json`
  successfully record user votes and adjust score multipliers.

## Out of Scope

- Frontend user interface modifications.
- Direct vector database infrastructure deployment (managed via Supabase).

## Further Notes

- System requires `en_core_web_sm` (spaCy) and `ms-marco-MiniLM-L-6-v2` locally
  installed.
- Supports 30+ languages via LLaMA-3.3-70B prompt handling.
- Conversation history (last 5 turns) is injected into prompts for context-aware
  responses.
