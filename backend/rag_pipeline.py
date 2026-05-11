"""
=============================================================
NEOVERSE AI DESK — ADVANCED RAG PIPELINE (Supabase)
=============================================================
Developer : Tehzeeb ul Hassan (AI Engineer)
Project   : Neoverse AI Desk Support System

PIPELINE FLOW:
  1. Query Preprocessing     — spaCy + pyspellchecker (English-only guard)
  2. Intent Classification   — DistilBERT fine-tuned + keyword fallback
  3. Query Rewrite           — LLaMA-3.3-70B translates/rewrites for retrieval
  4. Hybrid Retrieval        — Supabase pgvector + full-text search
  5. ReRanker                — ms-marco-MiniLM-L-6-v2 CrossEncoder
  6. Relevance Grade (C-RAG) — Score threshold + query rewrite retry
  7. LLM Generation          — Groq LLaMA-3.3-70B
  8. User Feedback            — thumbs up/down + doc boost
=============================================================
"""

import os
import re
import json
import logging
from pathlib import Path
from typing import List, Optional, Tuple, Dict

from dotenv import load_dotenv
from spellchecker import SpellChecker
from sentence_transformers import CrossEncoder
from scipy.special import expit
import spacy

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    TextLoader, PyPDFLoader, Docx2txtLoader,
)
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document

# ─── Setup ────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# Silence verbose library logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("huggingface_hub").setLevel(logging.WARNING)



# ─── Config ───────────────────────────────────────────────
BASE_DIR            = Path(__file__).parent
DATA_DIR            = BASE_DIR / "Data"
FEEDBACK_FILE       = BASE_DIR / "feedback_scores.json"
TRAINING_DATA_FILE  = BASE_DIR / "training_data.json"
EMBEDDING_MODEL     = "paraphrase-multilingual-MiniLM-L12-v2"
RERANKER_MODEL      = "cross-encoder/ms-marco-MiniLM-L-6-v2"
CHUNK_SIZE          = 800       # Larger chunks for IT support docs
CHUNK_OVERLAP       = 200
TOP_K_RETRIEVAL     = 10        # Candidates from hybrid retrieval
TOP_N_RERANK        = 5         # Top docs after reranking
RELEVANCE_THRESHOLD = 0.25      # C-RAG score threshold (CrossEncoder sigmoid)
BOOST_MULTIPLIER    = 1.3       # Feedback boost for thumbs-up documents
HISTORY_SIZE        = 5         # Last N conversation turns to keep
NO_INFO_RESPONSE    = ("I don't have information about this in my knowledge base. "
                       "Please contact support@neoverse.io for further assistance.")

# Supported languages (LLaMA-3.3-70B handles all these via prompt)
SUPPORTED_LANGUAGES = [
    "English", "Roman Urdu", "Urdu", "Hindi", "Arabic",
    "Spanish", "French", "German", "Portuguese", "Italian",
    "Turkish", "Chinese", "Japanese", "Korean", "Russian",
    "Dutch", "Polish", "Indonesian", "Thai", "Vietnamese",
    "Bengali", "Punjabi", "Tamil", "Persian", "Malay",
    "Swahili", "Czech", "Romanian", "Greek", "Swedish",
]

# Intent labels
INTENT_LABELS = ["FAQ", "IT_Issue", "Complaint", "Small_Talk"]

# ─── Prompts ──────────────────────────────────────────────

# ─── System Persona (sent as system message — LLM follows this more strictly) ───
SYSTEM_PERSONA = """You are **Neoverse AI Support Assistant** — a highly skilled IT helpdesk AI built by the Neoverse team.

IDENTITY:
    You are Neoverse AI Assistant, an IT support helpdesk assistant.

Rules:

1. Reply in the same language as the user's query.

2. Answer ONLY from the provided context.

3. Understand the context carefully and explain solutions with clarity and proper detail.

4. If information or context is unavailable, reply:
   "Sorry,I don't have this information right now.
   For further assistance,please contact support@neoverse.io."

5. For troubleshooting:
   - Use numbered steps
   - Keep instructions clear and structured
   - Explain what each step does when necessary

6. Use clean formatting:
   - Short paragraphs
   - Bullet points
   - Bold important terms

7. Do not make assumptions or invent information.

8. Respond in a natural, human-friendly, and professional way.
   Avoid robotic or overly generic replies.

9. Focus on helping the user clearly understand the issue and solution.
    """

# User message template (paired with SYSTEM_PERSONA above)
RAG_USER_TEMPLATE = """{history}
CONTEXT:
{context}

QUERY: {question}"""

# Query rewrite — translate + expand + preserve intent
REWRITE_SYSTEM = """You are a search query optimizer for an IT support knowledge base.

TASK: Rewrite the user's support query to maximize retrieval from a technical document store.

RULES:
1. If the query is NOT in English, translate it to English first.
2. Expand abbreviations (e.g., "pwd" → "password", "vpn" → "Virtual Private Network").
3. Add likely relevant technical keywords (e.g., "wifi not working" → "WiFi connection troubleshooting network adapter").
4. Preserve the original intent — do NOT change what the user is asking.
5. Output ONLY the rewritten English query. No explanations, no quotes, no prefixes."""

REWRITE_USER = """Original query: {question}
Rewritten query:"""

# HyDE — generate hypothetical answer for embedding
HYDE_SYSTEM = """You are an IT support specialist. Write a SHORT, factual answer to this question as if you were reading from an official IT support document.

RULES:
1. If question is not in English, understand it and write the answer in English.
2. Use technical terms that would appear in IT documentation (e.g., "Active Directory", "SMTP", "Group Policy").
3. Keep it 2-3 sentences, factual and specific.
4. Do NOT add disclaimers or hedging — write as if this IS the official answer."""

HYDE_USER = """Question: {question}
Answer:"""

# Small Talk — warm personality + gentle redirect
SMALL_TALK_SYSTEM = """You are Neoverse AI Support Assistant — friendly, warm, and professional.

LANGUAGE RULE: Reply in the EXACT SAME language the user is using.

PERSONALITY:
- Be genuinely warm and personable (not robotic)
- Use a light, conversational tone
- You can use emojis sparingly (1 max per message)
- Show you care about the user's day

RULES:
1. Reply in 1-2 short sentences maximum.
2. After responding, gently offer to help with IT support (e.g., "Need any tech help today?" or equivalent in user's language).
3. Do NOT answer technical questions here — just be conversational.
4. If the user says goodbye, wish them well warmly."""

SMALL_TALK_USER = """{history}
User: {question}
Assistant:"""

# Complaint — empathetic de-escalation + structured resolution
COMPLAINT_SYSTEM = """You are Neoverse AI Support Assistant handling a frustrated user. Your goal is to de-escalate and resolve.

LANGUAGE RULE: Reply in the EXACT SAME language the user is using.

RESPONSE STRUCTURE (follow this order):
1. **Empathize** — Acknowledge their frustration genuinely. Use phrases like "I completely understand" / "That sounds really frustrating".
2. **Apologize** — Take ownership: "I'm sorry you're experiencing this" (not "I'm sorry you feel that way").
3. **Offer action** — Either:
   a. If the complaint has a solvable IT issue → say "Let me help fix this — could you describe the specific problem?"
   b. If it's general dissatisfaction → offer escalation: "I can escalate this to our support team at support@neoverse.io"
4. Keep it 2-4 sentences. Do NOT be defensive or dismissive."""

COMPLAINT_USER = """{history}
User: {question}
Assistant:"""


# =====================================================
# STEP 1 — QUERY PREPROCESSING
# spaCy: normalize, clean
# pyspellchecker: spelling correction (English only)
# =====================================================

class QueryPreprocessor:
    """
    Cleans the user query.
    - spaCy: text normalization
    - pyspellchecker: spelling correction (skipped for non-English text)
    """
    def __init__(self):
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model not found. Run: python -m spacy download en_core_web_sm")
            self.nlp = None
        self.spell = SpellChecker()

    def fix_spelling(self, text: str) -> str:
        """Spelling correction — only applied if text appears to be English."""
        words = text.split()
        if not words:
            return text

        # Heuristic: if >40% of words are unknown to the English dictionary,
        # the text is probably not English — skip to avoid corrupting it.
        unknown = self.spell.unknown(words)
        unknown_ratio = len(unknown) / len(words)
        if unknown_ratio > 0.4:
            logger.info(f"Spell check skipped (non-English detected, {unknown_ratio:.0%} unknown)")
            return text

        corrected = []
        for word in words:
            if word.lower() in unknown:
                fixed = self.spell.correction(word)
                corrected.append(fixed if fixed else word)
            else:
                corrected.append(word)
        return " ".join(corrected)

    def normalize(self, text: str) -> str:
        """Normalize the text — convert to lowercase and remove extra spaces."""
        text = text.strip().lower()
        text = re.sub(r'\s+', ' ', text)
        return text


    def process(self, query: str) -> str:
        """Complete preprocessing pipeline."""
        logger.info("=== STEP 1: Query Preprocessing ===")
        query = self.normalize(query)
        query = self.fix_spelling(query)
        logger.info(f"Preprocessed query: {query}")
        return query


# =====================================================
# STEP 2 — INTENT CLASSIFICATION
# DistilBERT fine-tuned model + keyword fallback
# FAQ / IT_Issue / Complaint / Small_Talk
# =====================================================

from transformers import pipeline

class IntentClassifier:
    def __init__(self):
        try:
            MODEL_PATH = str(BASE_DIR / "intent_model_v1")

            self.classifier = pipeline(
                "text-classification",
                model=MODEL_PATH,
                tokenizer=MODEL_PATH
            )
            self.model_loaded = True
            logger.info("Custom Intent model loaded.")
        except Exception as e:
            logger.warning(f"Model load failed: {e}")
            self.model_loaded = False

    # Minimum confidence to trust the model prediction
    CONFIDENCE_THRESHOLD = 0.6

    def classify(self, query: str) -> str:
        logger.info("=== STEP 2: Intent Classification ===")

        q = query.lower()

        # Try model first, but only trust high-confidence predictions
        if self.model_loaded:
            result = self.classifier(query)[0]
            logger.info(f"Model prediction: {result['label']} ({result['score']:.3f})")
            if result["score"] >= self.CONFIDENCE_THRESHOLD:
                intent = result["label"]
                logger.info(f"Intent: {intent} (model, high confidence)")
                return intent

        # Keyword-based fallback (more reliable than low-confidence model)
        # Small Talk and Complaint keywords are filtered here;
        # everything else goes to the RAG pipeline (FAQ/IT_Issue same treatment)

        # Small Talk — ONLY greetings/casual (very specific)
        words = set(q.split())
        greeting_words = {"hello", "hi", "hey", "bye", "thanks"}
        greeting_phrases = ["thank you", "good morning", "good night", "how are you",
                            "what's up", "see you", "take care", "good evening"]
        is_greeting = (words & greeting_words) or any(p in q for p in greeting_phrases)
        if is_greeting and len(words) <= 6:
            # Short casual messages only — "hi my printer is not working" should NOT be Small_Talk
            intent = "Small_Talk"
        # Complaint — angry/frustrated users
        elif any(w in q for w in ["complain", "complaint", "angry", "worst",
                                   "terrible", "unacceptable", "frustrated", "disappointed"]):
            intent = "Complaint"
        else:
            # Everything else goes to RAG pipeline (FAQ + IT_Issue same treatment)
            intent = "FAQ"

        logger.info(f"Intent: {intent} (keyword fallback)")
        return intent



# =====================================================
# STEP 3 — QUERY REWRITE + EXPANDER
# LLaMA-3-8B: query rewrite
# HyDE: hypothetical document embedding
# =====================================================

class QueryExpander:
    """
    Improves the query using two methods:
    1. Rewrite using LLM (translates non-English, makes query more specific)
    2. HyDE — generate a hypothetical answer and embed it
    """

    def rewrite_query(self, llm: ChatGroq, query: str) -> str:
        """Rewrite/translate query to English for better retrieval."""

        try:
            messages = [
                SystemMessage(content=REWRITE_SYSTEM),
                HumanMessage(content=REWRITE_USER.format(question=query))
            ]
            result = llm.invoke(messages)
            rewritten = result.content.strip()

            logger.info(f"Rewritten query: {rewritten}")

            return rewritten

        except Exception as e:
            logger.warning(f"Query rewrite failed: {e}")
            return query

    def hyde_embedding(
        self,
        llm: ChatGroq,
        query: str,
        embeddings
    ) -> Optional[List[float]]:
        """
        HyDE — Hypothetical Document Embedding.

        1. Generate a hypothetical answer from the LLM
        2. Embed it as a vector
        3. Use this vector for retrieval (bridges query-document vocabulary gap)
        """

        try:
            messages = [
                SystemMessage(content=HYDE_SYSTEM),
                HumanMessage(content=HYDE_USER.format(question=query))
            ]
            result = llm.invoke(messages)
            hypothetical_doc = result.content.strip()

            logger.info(
                f"HyDE document generated: {hypothetical_doc[:80]}..."
            )

            hyde_vector = embeddings.embed_query(hypothetical_doc)

            return hyde_vector

        except Exception as e:
            logger.warning(f"HyDE failed: {e}")
            return None


# =====================================================
# STEP 4 — HYBRID RETRIEVAL (Supabase)
# pgvector: dense semantic search
# Full-text search: sparse keyword search
# Combined via Postgres RPC
# =====================================================

def hybrid_retrieve(
    query: str,
    embeddings,
    query_text: str,
    top_k: int = TOP_K_RETRIEVAL,
    threshold: float = RELEVANCE_THRESHOLD
) -> Tuple[List[Document], List[float]]:
    """
    Hybrid Retrieval via Supabase:
    1. Embed the query.
    2. Call 'match_documents' RPC in Supabase (Vector + Full-Text).
    """
    logger.info("=== STEP 4: Hybrid Retrieval (Supabase) ===")

    # 1. Embed query
    query_vector = embeddings.embed_query(query)

    # 2. Call Supabase RPC
    from services import supabase_client as db
    try:
        results = db.match_documents(
            query_embedding=query_vector,
            query_text=query_text,
            match_threshold=0.0,  # Fetch all top_k candidates; ReRanker will filter
            match_count=top_k
        )
    except Exception as e:
        logger.error(f"Supabase retrieval failed: {e}")
        return [], []

    docs = []
    scores = []
    for r in results:
        docs.append(Document(
            page_content=r["content"],
            metadata={**(r["metadata"] or {}), "id": r["id"], "document_id": r["document_id"]}
        ))
        scores.append(r["similarity"])

    logger.info(f"Supabase retrieval: {len(docs)} docs found")
    return docs, scores


# =====================================================
# STEP 5 — RERANKER
# cross-encoder ms-marco-MiniLM-L-6-v2
# Pairs query with each chunk
# Produces more accurate relevance scores
# =====================================================
class ReRanker:
    """
    CrossEncoder reranker.
    Creates query + chunk pairs.
    Produces accurate relevance scores.
    Keeps top-N results.
    """
    def __init__(self):
        logger.info(f"Loading reranker: {RERANKER_MODEL}")
        self.model = CrossEncoder(RERANKER_MODEL)
        logger.info("Reranker loaded.")

    def rerank(
        self,
        query: str,
        docs: List[Document],
        boost_scores: Dict[str, float],
        top_n: int = TOP_N_RERANK
    ) -> Tuple[List[Document], List[float]]:
        """
        Rerank documents using CrossEncoder.
        boost_scores: documents with thumbs-up get higher scores.
        """
        if not docs:
            return [], []

        # Create query-document pairs
        pairs = [[query, doc.page_content] for doc in docs]
        scores = self.model.predict(pairs)
        # Apply sigmoid to get probabilities (0 to 1)
        scores = expit(scores)

        max_raw_score = max(scores) if len(scores) > 0 else 0
        
        # RAW SIMILARITY CHECK: 
        # If even the best document has an extremely low raw probability (< 0.00001),
        # it means the entire retrieved batch is completely irrelevant garbage.
        # We reject the context early to save LLM tokens and prevent hallucination.
        if max_raw_score < 1e-5:
            logger.info(f"ReRanker: ALL docs rejected! max_raw_score {max_raw_score:.6f} < 1e-5")
            return [], []

        # Min-Max Normalization (scales scores so the top document is always 1.0)
        if len(scores) > 1:
            min_s = min(scores)
            if max_raw_score - min_s > 1e-6:
                scores = [(s - min_s) / (max_raw_score - min_s) for s in scores]
            elif max_raw_score > 0:
                # If all scores are identical, set them to 1.0
                scores = [1.0 for _ in scores]

        # Apply boost (increase score for thumbs-up documents)
        boosted_scores = []
        for doc, score in zip(docs, scores):
            # Use document_id as the boost key (matches Supabase metadata)
            key = doc.metadata.get("document_id", doc.metadata.get("source", ""))
            boost = boost_scores.get(key, 1.0)
            boosted_scores.append(float(score) * boost)

        # Sort by score descending
        ranked = sorted(zip(docs, boosted_scores), key=lambda x: x[1], reverse=True)
        top_docs   = [r[0] for r in ranked[:top_n]]
        top_scores = [r[1] for r in ranked[:top_n]]

        logger.info(f"ReRanker: {len(docs)} -> {len(top_docs)} docs | top score: {top_scores[0]:.3f}")
        return top_docs, top_scores


# =====================================================
# STEP 6 — RELEVANCE GRADE (C-RAG)
# Score >= threshold → relevant → proceed
# Score < threshold  → rewrite query + re-retrieve + re-rerank
# =====================================================

def crag_grade(
    query: str,
    docs: List[Document],
    scores: List[float],
    llm: ChatGroq,
    expander: QueryExpander,
    reranker: ReRanker,
    embeddings,
    boost_scores: Dict[str, float],
    threshold: float = RELEVANCE_THRESHOLD
) -> Tuple[List[Document], List[float]]:
    """
    C-RAG Grader — score-based relevance check.
    If no docs pass threshold: rewrite query → re-retrieve → re-rerank → return.
    """
    logger.info("=== STEP 6: C-RAG Relevance Grade ===")

    relevant_docs   = []
    relevant_scores = []

    for doc, score in zip(docs, scores):
        logger.info(f"Score: {score:.3f} | {'PASS' if score >= threshold else 'FAIL'}")
        if score >= threshold:
            relevant_docs.append(doc)
            relevant_scores.append(score)

    # If nothing passed, we rely on the LLM's hallucination guard instead of an expensive redundant retry.
    if not relevant_docs:
        logger.info("C-RAG: All documents failed threshold. Proceeding with empty context to trigger LLM fallback.")
    else:
        logger.info(f"C-RAG: {len(relevant_docs)} relevant docs passed threshold")

    return relevant_docs, relevant_scores


# =====================================================
# STEP 7 — LLM GENERATION
# LLaMA-3.3-70B generates the answer
# Returns fallback if no relevant context found
# =====================================================

def generate_answer(
    llm: ChatGroq,
    query: str,
    relevant_docs: List[Document],
    history: str = "",
) -> str:
    """
    Generate the answer using LLM with proper system/human message separation.
    System message = persona + rules (followed more strictly by LLM).
    Human message = context + query.
    """
    logger.info("=== STEP 7: LLM Generation ===")

    # Guard: no context → don't call LLM (prevents hallucination)
    if not relevant_docs:
        logger.info("No relevant documents — returning fallback response")
        return NO_INFO_RESPONSE

    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    user_msg = RAG_USER_TEMPLATE.format(context=context, question=query, history=history)

    messages = [
        SystemMessage(content=SYSTEM_PERSONA),
        HumanMessage(content=user_msg),
    ]
    result = llm.invoke(messages)
    answer = result.content.strip()

    logger.info(f"Answer generated ({len(answer)} chars)")
    return answer


# =====================================================
# STEP 8 — USER FEEDBACK + BOOST DOC WEIGHT
# thumbs up → score multiplier increase
# thumbs down → flag for human review
# =====================================================

class FeedbackSystem:
    """
    Manages user feedback.
    Thumbs up → increases document boost score
    Thumbs down → flags for human review
    """

    def __init__(self):
        self.scores: Dict[str, float] = {}
        self.flagged: List[dict] = []
        self._load()

    def _load(self):
        """Load previously saved feedback."""
        if FEEDBACK_FILE.exists():
            with open(FEEDBACK_FILE, "r") as f:
                data = json.load(f) 
                self.scores = data.get("scores", {})
                self.flagged = data.get("flagged", [])

    def _save(self):
        """Save feedback to disk."""
        with open(FEEDBACK_FILE, "w") as f:
            json.dump(
                {"scores": self.scores, "flagged": self.flagged},
                f,
                indent=2
            )

    def thumbs_up(self, sources: List[str]):
        """Thumbs up — increase boost score of source documents."""
        logger.info("Feedback: 👍 Thumbs Up")

        for source in sources:
            self.scores[source] = self.scores.get(source, 1.0) * BOOST_MULTIPLIER
            logger.info(f"Boosted: {source} -> {self.scores[source]:.2f}")

        self._save()

    def thumbs_down(self, query: str, answer: str, sources: List[str]):
        """Thumbs down — flag for human review."""
        logger.info("Feedback: 👎 Thumbs Down — flagged for review")

        self.flagged.append({
            "query": query,
            "answer": answer,
            "sources": sources
        })

        self._save()

    def get_boost_scores(self) -> Dict[str, float]:
        """Return current boost scores."""
        return self.scores

# =====================================================
# DOCUMENT LOADING
# =====================================================

def load_documents(data_dir: Path) -> List[Document]:
    """Load documents from the data/ folder."""
    documents = []
    loaders_map = {"*.txt": TextLoader, "*.pdf": PyPDFLoader, "*.docx": Docx2txtLoader}
    for pattern, Loader in loaders_map.items():
        for fp in data_dir.glob(pattern):
            try:
                docs = Loader(str(fp)).load()
                for doc in docs:
                    doc.metadata["source"] = fp.name
                documents.extend(docs)
                logger.info(f"Loaded: {fp.name} ({len(docs)} docs)")
            except Exception as e:
                logger.error(f"Failed {fp.name}: {e}")
    if not documents:
        raise ValueError(f"No documents in {data_dir}")
    return documents


def split_documents(documents: List[Document]) -> List[Document]:
    """Split documents into chunks."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " "], length_function=len,
    )
    chunks = splitter.split_documents(documents)
    logger.info(f"Split: {len(chunks)} chunks")
    return chunks


def get_embedding_model():
    logger.info(f"Loading embeddings: {EMBEDDING_MODEL}")
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def get_llm():
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise ValueError("GROQ_API_KEY not in .env")
    return ChatGroq(groq_api_key=key, model_name="llama-3.3-70b-versatile",
                    temperature=0.1, max_tokens=1024)


# =====================================================
# MAIN CLASS
# =====================================================

class NeoversRAGSystem:
    """
    Complete Neoverse RAG System.
    Manages the full pipeline from query to answer.

    Usage:
        rag = NeoversRAGSystem()
        rag.initialize()
        result = rag.ask("How do I reset my password?")
        print(result["answer"])
        rag.feedback("up", result)   # thumbs up
    """

    def __init__(self):
        self.llm            = None
        self.embeddings     = None
        self.preprocessor   = QueryPreprocessor()
        self.intent_clf     = IntentClassifier()
        self.expander       = QueryExpander()
        self.reranker       = None
        self.feedback_sys   = FeedbackSystem()
        self._last_result   = None

    def initialize(self):
        logger.info("=== Initializing Neoverse RAG System (Supabase) ===")

        self.embeddings   = get_embedding_model()
        self.llm          = get_llm()
        self.reranker     = ReRanker()

        logger.info("=== RAG System Ready ===")

    @staticmethod
    def _format_history(conversation_history: List[dict]) -> str:
        """Format conversation history for prompt injection."""
        if not conversation_history:
            return ""
        lines = ["\nCONVERSATION HISTORY:"]
        for turn in conversation_history:
            lines.append(f"User: {turn['user']}")
            lines.append(f"Assistant: {turn['assistant']}")
        return "\n".join(lines) + "\n"

    def ask(self, question: str, conversation_history: Optional[List[dict]] = None) -> dict:
        """
        Run the complete RAG pipeline.

        Args:
            question: The user's original question.
            conversation_history: List of {"user": ..., "assistant": ...} dicts.
                Passed in from the server to avoid shared mutable state (thread safety).
        """
        if not self.llm:
            raise RuntimeError("Call initialize() first.")

        history = conversation_history or []
        history_text = self._format_history(history)

        # Step 1: Preprocess
        clean_query = self.preprocessor.process(question)

        # Step 2: Intent classify
        intent = self.intent_clf.classify(clean_query)

        if intent == "Small_Talk":
            try:
                messages = [
                    SystemMessage(content=SMALL_TALK_SYSTEM),
                    HumanMessage(content=SMALL_TALK_USER.format(question=question, history=history_text))
                ]
                result = self.llm.invoke(messages)
                answer = result.content.strip()
            except Exception:
                answer = "Hello! I'm Neoverse AI Support Assistant. How can I help you today?"
            return {"answer": answer, "intent": intent, "query": question, "sources": [], "docs_passed": 0, "top_score": 0}

        if intent == "Complaint":
            try:
                messages = [
                    SystemMessage(content=COMPLAINT_SYSTEM),
                    HumanMessage(content=COMPLAINT_USER.format(question=question, history=history_text))
                ]
                result = self.llm.invoke(messages)
                answer = result.content.strip()
            except Exception:
                answer = ("I'm sorry to hear about your frustration. I understand how inconvenient this must be. "
                          "I'd like to help resolve this — could you describe the specific issue? "
                          "Alternatively, I can escalate this to our support team at support@neoverse.io.")
            return {"answer": answer, "intent": intent, "query": question, "sources": [], "docs_passed": 0, "top_score": 0}

        # Step 3: Query rewrite (translates non-English, improves specificity)
        rewritten_query = self.expander.rewrite_query(self.llm, clean_query)

        # Step 4: Hybrid retrieve via Supabase
        # Use rewritten query for vector search, original for full-text search
        retrieved_docs, retrieved_scores = hybrid_retrieve(
            rewritten_query, self.embeddings, query_text=clean_query
        )

        # Step 5: ReRank
        boost_scores = self.feedback_sys.get_boost_scores()
        reranked_docs, reranked_scores = self.reranker.rerank(
            clean_query, retrieved_docs, boost_scores
        )

        # Step 6: C-RAG relevance grade
        relevant_docs, relevant_scores = crag_grade(
            clean_query, reranked_docs, reranked_scores,
            self.llm, self.expander, self.reranker, self.embeddings, boost_scores
        )

        # Step 7: LLM Generate — use original question for language detection
        answer = generate_answer(self.llm, question, relevant_docs, history_text)

        # Extract sources (use document_id for Supabase docs, fall back to source)
        sources = list(set(
            doc.metadata.get("document_id", doc.metadata.get("source", "Unknown"))
            for doc in relevant_docs
        ))

        result = {
            "answer"        : answer,
            "sources"       : sources,
            "intent"        : intent,
            "query"         : question,
            "docs_passed"   : len(relevant_docs),
            "top_score"     : round(relevant_scores[0], 3) if relevant_scores else 0,
        }
        self._last_result = result
        return result

    def _save_training_data(self, query: str, intent: str, feedback: str):
        """Save query + intent + feedback for model retraining."""
        data = []
        if TRAINING_DATA_FILE.exists():
            with open(TRAINING_DATA_FILE, "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    data = []

        from datetime import datetime
        data.append({
            "query": query,
            "intent": intent,
            "feedback": feedback,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M")
        })

        with open(TRAINING_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Training data saved: {len(data)} examples total")

    def feedback(self, vote: str, result: dict = None):
        """
        User feedback.
        vote = "up" (thumbs up) or "down" (thumbs down)
        Also saves training data for model retraining.
        """
        r = result or self._last_result
        if not r:
            logger.warning("No result to give feedback on.")
            return

        # Save training data for self-learning
        self._save_training_data(r.get("query", ""), r.get("intent", ""), vote)

        if vote == "up":
            self.feedback_sys.thumbs_up(r["sources"])
        elif vote == "down":
            self.feedback_sys.thumbs_down(
                r.get("query", ""), r["answer"], r["sources"]
            )


# ─── CLI Test ─────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("NEOVERSE AI DESK — RAG SYSTEM")
    print("=" * 60)

    rag = NeoversRAGSystem()
    rag.initialize()

    cli_history: List[dict] = []

    print("\nReady! Type question. 'exit' to quit. 'clear' to reset conversation.\n")

    while True:
        print("─" * 60)
        question = input("You: ").strip()

        if question.lower() == "exit":
            print("Goodbye!")
            break
        if question.lower() == "clear":
            cli_history.clear()
            print("Conversation history cleared! Starting fresh.")
            continue
        if not question:
            continue

        result = rag.ask(question, conversation_history=cli_history)
        print(f"\nIntent     : {result['intent']}")
        print(f"Answer     : {result['answer']}")
        print(f"Sources    : {result['sources']}")
        print(f"Docs passed: {result['docs_passed']}")
        print(f"Top score  : {result['top_score']}")

        # Store turn in CLI history
        cli_history.append({"user": question, "assistant": result["answer"]})
        if len(cli_history) > HISTORY_SIZE:
            cli_history = cli_history[-HISTORY_SIZE:]

        # Feedback
        fb = input("\nFeedback? (up/down/skip): ").strip().lower()
        if fb in ["up", "down"]:
            rag.feedback(fb, result)
            print("Feedback saved!")