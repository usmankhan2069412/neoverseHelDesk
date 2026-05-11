# Neoverse AI Desk — Project Overview

> **Developer:** Tehzeeb ul Hassan (AI Engineer)  
> **Project:** Neoverse AI Desk Support System  
> **Last Updated:** May 11, 2026

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Directory Structure](#3-directory-structure)
4. [Complete Pipeline — 10 Steps](#4-complete-pipeline--10-steps)
5. [Models & Embeddings](#5-models--embeddings)
6. [Knowledge Base & Data](#6-knowledge-base--data)
7. [Configuration & Constants](#7-configuration--constants)
8. [Prompt Templates](#8-prompt-templates)
9. [Key Classes & Functions](#9-key-classes--functions)
10. [Dependencies](#10-dependencies)
11. [Environment Variables](#11-environment-variables)
12. [How to Run](#12-how-to-run)
13. [API Server Support](#13-api-server-support)
14. [Feedback System](#14-feedback-system)
15. [Self-Learning System](#15-self-learning-system)
16. [Multilingual Support](#16-multilingual-support)
17. [Conversation Memory](#17-conversation-memory)
18. [Optimization Changes Log](#18-optimization-changes-log)
19. [Limitations & Notes](#19-limitations--notes)

---

## 1. Project Summary

**Neoverse AI Desk** is an advanced **Retrieval-Augmented Generation (RAG)** system built as an intelligent IT helpdesk assistant. It answers IT support queries by retrieving relevant information from a cloud-native Supabase knowledge base and generating accurate, context-grounded responses using a large language model.

The system implements a **10-step pipeline** that covers everything from query preprocessing to user feedback integration, making it a production-grade RAG solution with:

- **Cloud-Native Hybrid Retrieval** (Supabase `pgvector` dense + Postgres full-text sparse search via RPC)
- **Cross-Encoder Reranking** for precision
- **C-RAG Relevance Grading** with automatic query retry and re-reranking
- **System & Human Message Separation** to enforce strict LLM persona adherence
- **User Feedback Loop** that boosts document scores over time
- **Thread-Safe Multi-Turn Conversation Memory**
- **Multilingual Support** (30+ languages natively via multilingual embeddings and prompt engineering)
- **Empty Context Guards** to prevent LLM hallucination
- **Optimized Latency**: reduced from 4–8 LLM calls → 1–2 calls per query

---

## 2. Architecture Overview

```text
User Query
    │
    ▼
┌──────────────────────────────────────────┐
│  STEP 1: Query Preprocessing              │  spaCy + pyspellchecker
│  - Normalize (lowercase, spaces)          │  (Only corrects English queries)
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  STEP 2: Intent Classification            │  DistilBERT + keyword fallback
│  - Confidence threshold: 0.6              │
│  - Small_Talk → LLM casual reply          │
│  - FAQ / IT_Issue / Complaint → RAG       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  STEP 3: Query Rewrite (C-RAG retry only) │  LLaMA-3.3-70B via Groq
│  - Translates and expands keywords        │
│  - HyDE only on retry, not every query    │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  STEP 4: Hybrid Retrieval                 │  Supabase (match_documents RPC)
│  - Dense semantic search (pgvector)       │
│  - Sparse keyword search (to_tsvector)    │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  STEP 5: ReRanker                         │  ms-marco-MiniLM-L-6-v2
│  - Cross-encoder scoring                  │
│  - Feedback boost applied                 │
│  - Top-N selection                        │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  STEP 6: C-RAG Relevance Grade            │  Score threshold = 0.25 ↓
│  - Pass: score >= 0.25                    │
│  - Fail: rewrite query + HyDE + retry     │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  STEP 7+8: LLM Generation + Self-RAG     │  1 LLM call via SystemMessage
│  - Empty context guard (no hallucination) │
│  - Multilingual reply (detects language)  │
│  - Thread-safe history injected           │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  STEP 9: User Feedback                    │  Thumbs up / Thumbs down
│  STEP 10: Boost Doc Weight + Save Data    │  Multiplier 1.3x + training_data.json
└──────────────────────────────────────────┘
               │
               ▼
         Final Answer
```

---

## 3. Directory Structure

```text
backend/
│
├── .env                          # Environment variables (GROQ_API_KEY, SUPABASE_*)
├── main.py                       # FastAPI server entry point
├── rag_pipeline.py               # Main pipeline — all 10 steps
├── requirements.txt              # Python dependencies
├── feedback_scores.json          # Generated at runtime — stores user feedback
├── training_data.json            # Self-learning data
│
├── services/
│   └── supabase_client.py        # Supabase connection & RPC wrappers
│
├── migrations/
│   ├── 001_create_tables.sql     # Base table creation
│   └── 002_create_document_chunks.sql # pgvector & match_documents RPC setup
│
├── intent_model_v1/              # Fine-tuned DistilBERT intent classifier
│   ├── config.json               # Model config
│   ├── model.safetensors         # Model weights (~267 MB)
│   ├── tokenizer.json            # Tokenizer vocabulary
│   └── tokenizer_config.json     # Tokenizer settings
│
└── venv/                         # Python virtual environment
```

---

## 4. Complete Pipeline — 10 Steps

### Step 1: Query Preprocessing (`QueryPreprocessor`)
- **Normalization:** Converts to lowercase, strips whitespace, collapses multiple spaces.
- **Spell Correction:** Uses `pyspellchecker`. Includes an English-only guard so non-English queries (like Roman Urdu) aren't corrupted by the spell checker.

### Step 2: Intent Classification (`IntentClassifier`)
- **Model:** Fine-tuned DistilBERT (`intent_model_v1/`).
- **Inverted Fallback Logic:** Small_Talk and Complaint are handled distinctly (Complaints trigger empathetic responses). Everything else defaults to `FAQ` and goes through the RAG pipeline.

### Step 3: Query Rewrite + Expansion (`QueryExpander`)
- **Query Rewrite (LLaMA-3.3-70B):** Uses isolated `SystemMessage` to prevent prompt leaking. Rewrites query to English for better retrieval.
- **HyDE:** Generates a short hypothetical English answer using the LLM. *Triggered only on C-RAG retry.*

### Step 4: Hybrid Retrieval (Supabase)
Combines dense and sparse retrieval natively in Postgres via RPC:
- **Dense:** Semantic vector similarity via `pgvector` (`<=>` cosine distance operator).
- **Sparse:** Full-text keyword search via `tsvector` and `tsquery`.
- Replaced local FAISS and BM25 dependencies for a cloud-native, scalable architecture.

### Step 5: ReRanking (`ReRanker`)
- **Model:** `cross-encoder/ms-marco-MiniLM-L-6-v2`.
- Applies sigmoid to raw scores.
- Incorporates feedback boosts from `feedback_scores.json`.

### Step 6: C-RAG Relevance Grading
- **Threshold:** `0.25`.
- Documents with reranker score ≥ 0.25 pass.
- **If all documents fail:** The pipeline triggers a retry flow utilizing Query Expansion and HyDE, followed by a re-retrieval and re-reranking pass.

### Step 7+8: LLM Answer Generation (System/Human Separation)
- **Model:** `llama-3.3-70b-versatile` via Groq.
- **Empty Context Guard:** If retrieval yields 0 documents, the LLM is explicitly instructed *not* to hallucinate and instead return a standard support escalation message.
- Uses strict **LangChain SystemMessage & HumanMessage** separation to firmly anchor the assistant's persona.

### Step 9 & 10: User Feedback & Boosting
- **Thumbs Up/Down** drives a continuous reinforcement loop, multiplying source document weights by `1.3x` for upvotes.

---

## 5. Models & Embeddings

| Component | Model | Source | Description |
|-----------|-------|--------|-------------|
| **Embedding** | `paraphrase-multilingual-MiniLM-L12-v2` | HuggingFace | 384-dims. Multilingual (50+ languages). Drop-in replacement for the older English-only model. |
| **Intent Classifier** | `DistilBertForSequenceClassification` | Local | 4 Labels. |
| **ReRanker** | `cross-encoder/ms-marco-MiniLM-L-6-v2` | HuggingFace | High-precision cross-attention scoring. |
| **LLM** | `llama-3.3-70b-versatile` | Groq Cloud API | Generation & Rewrites. |

---

## 6. Knowledge Base & Data

All documents and chunks are stored in **Supabase**.
- `documents` table stores file metadata.
- `document_chunks` table stores text chunks, `metadata`, `fts` (tsvector), and `embedding` (vector(384)).

### Chunking Strategy
- **Splitter:** `RecursiveCharacterTextSplitter`
- **Chunk Size:** 800 characters (Expanded from 512 for better IT troubleshooting context).
- **Chunk Overlap:** 200 characters.

---

## 7. Configuration & Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `EMBEDDING_MODEL` | `paraphrase-multilingual-MiniLM-L12-v2` | Supports 50+ languages. |
| `RERANKER_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Cross-encoder reranker. |
| `CHUNK_SIZE` | 800 | Characters per chunk. |
| `CHUNK_OVERLAP` | 200 | Overlap between chunks. |
| `RELEVANCE_THRESHOLD`| 0.25 | C-RAG pass/fail threshold. |
| `BOOST_MULTIPLIER` | 1.3 | Feedback boost factor. |
| `HISTORY_SIZE` | 5 | Conversation turns to remember per session. |

---

## 8. Prompt Templates

To prevent prompt injection and guarantee persona consistency, all prompts now use `SystemMessage` and `HumanMessage` structures.

### RAG System Message Example:
```python
SystemMessage(content=(
    "You are Neoverse AI Support Assistant — an expert IT helpdesk AI.\n\n"
    "CRITICAL RULES:\n"
    "1. Answer ONLY using the provided context.\n"
    "2. If the context does not contain the answer, say: 'I don't have information about this. Please contact support@neoverse.io.' DO NOT hallucinate.\n"
    "3. Reply in the EXACT same language as the user's query.\n"
    "4. Format troubleshooting steps as numbered lists.\n"
    "5. Be concise and professional."
))
```
*The context, conversation history, and query are injected cleanly as a separate `HumanMessage`.*

---

## 9. Key Classes & Functions

| Class | Purpose |
|-------|---------|
| `QueryPreprocessor` | Normalize + spell-correct queries safely. |
| `IntentClassifier` | Classify user intent (FAQ, IT_Issue, Complaint, Small_Talk). |
| `QueryExpander` | LLM rewrite + HyDE using System/Human split prompts. |
| `ReRanker` | Cross-encoder reranking with boost. |
| `FeedbackSystem` | Persist thumbs up/down feedback. |
| `NeoversRAGSystem` | Main orchestrator — thread-safe injection of `session_histories`. |

---

## 10. Dependencies

| Package | Purpose |
|---------|---------|
| `fastapi` & `uvicorn` | API Server |
| `supabase` | Database client |
| `langchain`, `langchain-groq`, `langchain-huggingface` | AI Framework and integrations |
| `sentence-transformers` | Embeddings and ReRanking |
| `spacy`, `pyspellchecker` | NLP and preprocessing |
| `transformers`, `torch` | Local Intent Model execution |
*(Note: `faiss-cpu` and `rank-bm25` have been safely removed.)*

---

## 11. Environment Variables

```env
GROQ_API_KEY="your_groq_key"
SUPABASE_URL="your_supabase_project_url"
SUPABASE_KEY="your_supabase_service_role_key"
```

---

## 12. How to Run

### Prerequisites

```bash
# 1. Activate virtual environment
venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Download spaCy model
python -m spacy download en_core_web_sm
```

### Run API Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The server will expose endpoints such as `/chat` and `/upload` used directly by the React frontend.

---

## 13. API Server Support

The pipeline is fully integrated with a **FastAPI** backend (`main.py`).
- Handles CORS for the frontend.
- `session_histories` dictionary securely isolates conversation contexts per `session_id`, making the backend completely thread-safe.
- Interacts with Supabase directly for authentication, RPC calls, and metadata management.

---

## 14. Feedback System

Feedback natively boosts document relevance by appending a multiplier (`1.3x`) per positive vote inside the local `feedback_scores.json`.

---

## 15. Self-Learning System

Queries and feedback are saved in `training_data.json` to enable future offline fine-tuning of the local DistilBERT intent model.

---

## 16. Multilingual Support

The system natively supports **30+ languages** due to two critical upgrades:
1. **Multilingual Embeddings:** `paraphrase-multilingual-MiniLM-L12-v2` ensures vector representations align across languages.
2. **LLM Translation/Generation:** Query Expander can rewrite non-English queries to English for hybrid search, and the `RAG_PROMPT` enforces the LLM to reply back in the user's native tongue.

---

## 17. Conversation Memory

Thread-safety was heavily improved. Instead of `rag_system.conversation_history` being a shared, mutated list (which causes race conditions), history is passed down dynamically from `main.py` per request via the `session_id`.

---

## 18. Optimization Changes Log

Summary of recent production-readiness improvements:

| # | Component | Enhancement | Impact |
|---|-----------|-------------|--------|
| 1 | **Database** | Migrated to Supabase pgvector | Removed FAISS bottlenecks, cloud-ready |
| 2 | **Embeddings** | Upgraded to Multilingual MiniLM | Massive non-English query improvement |
| 3 | **Prompts** | SystemMessage / HumanMessage | Stopped prompt bleed and hallucination |
| 4 | **Thread Safety** | Parameterized history | Fixed API crash on concurrent user load |
| 5 | **Guardrails** | Empty Context Check | Returns standard escalation on 0 docs |
| 6 | **Preprocessing** | English language guard | Stopped spellchecker corrupting Urdu |

---

## 19. Limitations & Notes

1. **Re-Indexing Requirement:** To fully utilize the new `paraphrase-multilingual-MiniLM-L12-v2` embedding model, any previously indexed documents in the `document_chunks` table must be deleted and re-uploaded.
2. **Supabase RPC:** The backend explicitly requires the `match_documents` Postgres RPC function to exist on Supabase. Without this migration applied, Hybrid Search will crash.
3. **Intent Model Under-trained:** DistilBERT still relies heavily on the keyword fallback for Small_Talk/Complaint until retrained.
4. **CPU Processing:** Embedding vectors locally uses CPU. Though lightweight, high concurrency may increase latency.
