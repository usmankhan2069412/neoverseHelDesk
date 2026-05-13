import json
import re
from typing import List, Optional
from langchain_core.messages import SystemMessage, HumanMessage

from rag.config import (
    logger, HISTORY_SIZE, RELEVANCE_THRESHOLD
)
from rag.prompts import (
    SMALL_TALK_SYSTEM, SMALL_TALK_USER, COMPLAINT_SYSTEM, COMPLAINT_USER
)
from rag.preprocessor import QueryPreprocessor, IntentClassifier
from rag.llm import QueryExpander, generate_answer, get_llm
from rag.retrieval import get_embedding_model, ReRanker, hybrid_retrieve
from rag.feedback import FeedbackSystem
from services import supabase_client as db


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
        self.llm          = None
        self.embeddings   = None
        self.preprocessor = QueryPreprocessor()
        self.intent_clf   = IntentClassifier()
        self.expander     = QueryExpander()
        self.reranker     = None
        self.feedback_sys = FeedbackSystem()

    def initialize(self):
        logger.info("=== Initializing Neoverse RAG System (Supabase) ===")

        self.embeddings   = get_embedding_model()
        self.llm          = get_llm()
        self.reranker     = ReRanker()

        logger.info("=== RAG System Ready ===")

    @staticmethod
    def _format_history(conversation_history: List[dict]) -> str:
        """Format conversation history for prompt injection.

        Each turn is truncated to 500 chars to limit prompt injection surface.
        """
        if not conversation_history:
            return ""
        _STRIP = re.compile(
            r"(ignore (all )?(previous |prior )?instructions?|system:|<[^>]+>)",
            re.IGNORECASE,
        )
        lines = ["\nCONVERSATION HISTORY:"]
        for turn in conversation_history:
            u = _STRIP.sub("[removed]", turn['user'])[:500]
            a = turn['assistant'][:500]
            lines.append(f"User: {u}")
            lines.append(f"Assistant: {a}")
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
                    HumanMessage(content=SMALL_TALK_USER.format(question=clean_query, history=history_text))
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
                    HumanMessage(content=COMPLAINT_USER.format(question=clean_query, history=history_text))
                ]
                result = self.llm.invoke(messages)
                answer = result.content.strip()
            except Exception:
                answer = ("I'm sorry to hear about your frustration. I understand how inconvenient this must be. "
                          "I'd like to help resolve this — could you describe the specific issue? "
                          "Alternatively, I can escalate this to our support team at support@neoverse.io.")
            return {"answer": answer, "intent": intent, "query": question, "sources": [], "docs_passed": 0, "top_score": 0}

        # Step 3: Query rewrite
        # We now ALWAYS rewrite to fix typos and normalize for the strict CrossEncoder.
        # This fixes issues where "noverse" vs "neoverse" causes retrieval failure.
        rewritten_query = self.expander.rewrite_query(self.llm, clean_query, history_text)

        # Step 4: Hybrid retrieve via Supabase
        # Use rewritten query for vector search, original for full-text search
        retrieved_docs, retrieved_scores = hybrid_retrieve(
            rewritten_query, self.embeddings, query_text=clean_query
        )

        # Step 5: ReRank
        # CRITICAL: Use rewritten_query (English) for the ReRanker because ms-marco is an English model.
        boost_scores = self.feedback_sys.get_boost_scores()
        reranked_docs, reranked_scores = self.reranker.rerank(
            rewritten_query, retrieved_docs, boost_scores
        )

        # Step 6: Relevance grade — filter by raw sigmoid threshold
        logger.info("=== STEP 6: Relevance Grade ===")
        relevant_docs  = [d for d, s in zip(reranked_docs, reranked_scores) if s >= RELEVANCE_THRESHOLD]
        relevant_scores = [s for s in reranked_scores if s >= RELEVANCE_THRESHOLD]
        
        if not relevant_docs and reranked_docs:
            top_content = reranked_docs[0].page_content[:150]
            logger.warning(f"Relevance: Top doc FAILED (Score: {reranked_scores[0]:.3f}). Snippet: {top_content}...")
        
        logger.info(f"Relevance: {len(relevant_docs)}/{len(reranked_docs)} docs passed (>={RELEVANCE_THRESHOLD})")

        # Step 7: LLM Generate — use sanitized query
        answer = generate_answer(self.llm, clean_query, relevant_docs, history_text)

        # Extract sources (use document_id for Supabase docs, fall back to source)
        sources = list(set(
            doc.metadata.get("document_id", doc.metadata.get("source", "Unknown"))
            for doc in relevant_docs
        ))

        result = {
            "answer"      : answer,
            "sources"     : sources,
            "intent"      : intent,
            "query"       : question,
            "docs_passed" : len(relevant_docs),
            "top_score"   : round(relevant_scores[0], 3) if relevant_scores else 0,
        }
        return result

    def _save_training_data(self, query: str, intent: str, feedback: str):
        """Append one training example to Supabase database for scaling."""
        try:
            db.insert_training_data(query, intent, feedback)
            logger.info("Training data appended to Supabase database.")
        except Exception as e:
            logger.error(f"Failed to append training data: {e}")

    def feedback(self, vote: str, result: dict):
        """
        Record user feedback.
        vote = "up" (thumbs up) or "down" (thumbs down)
        result must be the dict returned by ask().
        """
        if not result:
            logger.warning("No result to give feedback on.")
            return

        self._save_training_data(result.get("query", ""), result.get("intent", ""), vote)

        if vote == "up":
            self.feedback_sys.thumbs_up(result["sources"])
        elif vote == "down":
            self.feedback_sys.thumbs_down(
                result.get("query", ""), result["answer"], result["sources"]
            )
