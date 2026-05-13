import os
from typing import List
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document

import re
from rag.config import (
    logger,
    NO_INFO_RESPONSE_EN,
    NO_INFO_RESPONSE_UR,
    NO_INFO_RESPONSE_UR_ROMAN,
)
from rag.prompts import (
    REWRITE_SYSTEM, REWRITE_USER, RAG_USER_TEMPLATE, SYSTEM_PERSONA
)

class QueryExpander:
    """Rewrites/translates non-English queries to English for better retrieval."""

    def rewrite_query(self, llm: ChatGroq, query: str, history: str = "") -> str:
        """Rewrite/translate query to English for better retrieval."""
        try:
            messages = [
                SystemMessage(content=REWRITE_SYSTEM),
                HumanMessage(content=REWRITE_USER.format(question=query, history=history))
            ]
            result = llm.invoke(messages)
            rewritten = result.content.strip()

            logger.info(f"Rewritten query: {rewritten}")

            return rewritten

        except Exception as e:
            logger.warning(f"Query rewrite failed: {e}")
            return query


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
        if _is_urdu(query) or _is_urdu(history):
            if _is_roman_urdu(query) or _is_roman_urdu(history):
                return NO_INFO_RESPONSE_UR_ROMAN
            return NO_INFO_RESPONSE_UR
        return NO_INFO_RESPONSE_EN

    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    doc_titles = [doc.metadata.get("title", "Unknown") for doc in relevant_docs]
    logger.info(f"Context sources: {', '.join(doc_titles)}")
    
    user_msg = RAG_USER_TEMPLATE.format(context=context, question=query, history=history)

    messages = [
        SystemMessage(content=SYSTEM_PERSONA),
        HumanMessage(content=user_msg),
    ]
    result = llm.invoke(messages)
    answer = result.content.strip()

    logger.info(f"Answer generated ({len(answer)} chars)")
    return answer


def _is_urdu(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", text or ""))


def _is_roman_urdu(text: str) -> bool:
    if not text:
        return False
    roman_markers = {
        "kya", "nahi", "hain", "hai", "ka", "ki", "ke", "mein", "main",
        "kyun", "kaise", "kahan", "kab", "baat", "madad", "shukriya",
        "maaf", "barah", "kr", "karein", "kerain", "krdo", "krden",
    }
    words = re.findall(r"[a-z]+", text.lower())
    if not words:
        return False
    matches = sum(1 for w in words if w in roman_markers)
    return matches >= 2


def get_llm():
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise ValueError("GROQ_API_KEY not in .env")
    return ChatGroq(
        groq_api_key=key, 
        model_name="llama-3.3-70b-versatile",
        temperature=0.1, 
        max_tokens=1024
    )
