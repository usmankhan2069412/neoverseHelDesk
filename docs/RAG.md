# Neoverse RAG System Architecture (Enterprise Grade)

## Executive Summary
Neoverse RAG is a production-ready, modular retrieval system designed for high-performance IT support. It transitions from simple vector search to a sophisticated **7-Step Hybrid Pipeline** that prioritizes security, scalability, and multilingual accuracy.

## Core Architectural Shift
The system has been refactored from a monolithic "God file" into a distributed Python package under `backend/rag/`. This ensures high maintainability, testability, and clear separation of concerns.

---

## 🚀 The 7-Step Pipeline

### Step 1: Security & Preprocessing
**Module:** `rag/preprocessor.py`
*   **Sanitization:** Hard caps queries at 500 characters and uses RegEx to strip prompt injection patterns (e.g., "ignore previous instructions") and XML/HTML tags.
*   **Normalization:** Collapses whitespace and lowercases text for consistent indexing.

### Step 2: Intent Classification
**Module:** `rag/preprocessor.py`
*   **Custom Model:** Uses a fine-tuned DistilBERT classifier (`intent_model_v1`).
*   **Dynamic Routing:**
    *   **Small Talk:** Friendly, conversational responses with empathetic tone.
    *   **Complaint:** Immediate de-escalation with support escalation paths.
    *   **FAQ/IT Support:** Standard RAG flow.

### Step 3: Optimized Query Rewrite
**Module:** `rag/llm.py`
*   **Conditional Execution:** Skips rewriting for well-formed English queries (>=4 words) to save ~500ms of latency.
*   **Multilingual Support:** Translates non-English queries to English to maximize match accuracy against English-dominant document stores.
*   **Expansion:** Normalizes technical jargon (e.g., "pwd" → "password").

### Step 4: Hybrid Retrieval (Supabase)
**Module:** `rag/retrieval.py`
*   **Dense Search:** `pgvector` similarity search using `paraphrase-multilingual-MiniLM-L12-v2` embeddings.
*   **Sparse Search:** Postgres Full-Text Search (FTS) for exact keyword matches.
*   **Hybrid Rank:** Merges semantic meaning with keyword precision at the database level.

### Step 5: Neural ReRanking
**Module:** `rag/retrieval.py`
*   **Model:** `cross-encoder/ms-marco-MiniLM-L-6-v2`.
*   **Feedback Integration:** Documents that have received "Thumbs Up" votes receive a `1.3x` multiplier (Capped at `3.0x`) on their final relevance score.

### Step 6: Relevance Gating (C-RAG)
**Module:** `rag/core.py`
*   **Thresholding:** Filters out any documents with a raw sigmoid score below **0.35**.
*   **Hallucination Guard:** If no documents pass the gate, the system returns a standard "No Info" response instead of guessing.

### Step 7: LLM Generation
**Module:** `rag/llm.py`
*   **Engine:** LLaMA-3.3-70B via Groq.
*   **Context Aware:** Injects the last 5 conversation turns (sanitized) to handle follow-up questions.
*   **Strict Persona:** Enforces the "Neoverse Support" identity and prevents talking about topics outside the provided context.

---

## 📈 Scalability & State Management
Unlike prototype RAG systems, Neoverse does not store state on the local disk.
*   **Database Feedback:** Feedback votes and document boosts are stored in the Supabase `documents` table.
*   **Distributed Training:** Training data for intent retraining is saved in a Supabase `training_data` table, allowing multiple backend workers to contribute to the global dataset simultaneously.

## 🛡️ Security Features
1.  **Prompt Injection Guard:** RegEx filters on both current input and conversation history.
2.  **Length Limiting:** Strict character counts on all user-facing inputs.
3.  **Sanitization:** Neutralizes malicious instructions before they reach the LLM.

## 🛠️ Technical Stack
*   **Orchestration:** FastAPI / Python 3.14+
*   **LLM Interface:** LangChain / Groq
*   **Vector DB:** Supabase (Postgres + pgvector)
*   **Local Models:** SentenceTransformers (MiniLM)
*   **Deployment:** Docker-ready, stateless architecture.

---

## Maintainer Instructions
To retrain the intent classifier with the latest user feedback:
1. Ensure the `training_data` table in Supabase has >= 20 new examples.
2. Run `python backend/retrain_model.py`.
3. The script will fetch data from Supabase, fine-tune the model, and save a backup of the old weights.
