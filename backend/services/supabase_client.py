"""
Supabase client — thin wrapper around the supabase-py SDK.
Handles all database CRUD for sessions, messages, feedback, and documents.
"""

import os
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_client: Client | None = None


def get_client() -> Client:
    """Lazy-initialise and return the Supabase client singleton."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        _client = create_client(url, key)
        logger.info("Supabase client initialised")
    return _client


# ──────────────────────────────────────────────────────────
# Sessions
# ──────────────────────────────────────────────────────────

def create_session(title: str | None = None) -> dict:
    """Create a new conversation session."""
    data = {}
    if title:
        data["title"] = title
    res = get_client().table("sessions").insert(data).execute()
    return res.data[0]


def list_sessions() -> list[dict]:
    """Return all sessions ordered by most recent, with message counts."""
    res = (
        get_client()
        .table("sessions")
        .select("*, messages(count)")
        .order("created_at", desc=True)
        .execute()
    )
    rows = []
    for s in res.data:
        msg_count = 0
        if s.get("messages"):
            msg_count = s["messages"][0].get("count", 0)
        rows.append({
            "id": s["id"],
            "title": s.get("title"),
            "created_at": s["created_at"],
            "message_count": msg_count,
        })
    return rows


def get_session(session_id: str) -> dict | None:
    res = (
        get_client()
        .table("sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )
    return res.data


def delete_session(session_id: str) -> bool:
    get_client().table("sessions").delete().eq("id", session_id).execute()
    return True


def update_session_title(session_id: str, title: str):
    get_client().table("sessions").update({"title": title}).eq("id", session_id).execute()


# ──────────────────────────────────────────────────────────
# Messages
# ──────────────────────────────────────────────────────────

def insert_message(
    session_id: str,
    sender: str,
    text: str,
    intent: str | None = None,
    sources: list[str] | None = None,
    docs_passed: int | None = None,
    top_score: float | None = None,
) -> dict:
    """Insert a single chat message and return the inserted row."""
    data = {
        "session_id": session_id,
        "sender": sender,
        "text": text,
    }
    if intent is not None:
        data["intent"] = intent
    if sources is not None:
        data["sources"] = sources
    if docs_passed is not None:
        data["docs_passed"] = docs_passed
    if top_score is not None:
        data["top_score"] = top_score

    res = get_client().table("messages").insert(data).execute()
    return res.data[0]


def update_user_message(message_id: str, is_unanswered: bool, intent: str | None = None, sources: list[str] | None = None):
    """Update a user message with pipeline results."""
    data = {"is_unanswered": is_unanswered}
    if intent is not None:
        data["intent"] = intent
    if sources is not None:
        data["sources"] = sources
    get_client().table("messages").update(data).eq("id", message_id).execute()


def get_messages(session_id: str) -> list[dict]:
    """Return all messages in a session, oldest first."""
    res = (
        get_client()
        .table("messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    return res.data


# ──────────────────────────────────────────────────────────
# Feedback
# ──────────────────────────────────────────────────────────

def insert_feedback(message_id: str, vote: str) -> dict:
    """Record a thumbs-up / thumbs-down vote on a message."""
    res = (
        get_client()
        .table("feedback")
        .insert({"message_id": message_id, "vote": vote})
        .execute()
    )
    return res.data[0]


def get_feedback_stats() -> dict:
    """Return aggregate counts of up/down votes."""
    up_res = (
        get_client()
        .table("feedback")
        .select("id", count="exact")
        .eq("vote", "up")
        .execute()
    )
    down_res = (
        get_client()
        .table("feedback")
        .select("id", count="exact")
        .eq("vote", "down")
        .execute()
    )
    return {
        "thumbs_up": up_res.count or 0,
        "thumbs_down": down_res.count or 0,
    }


# ──────────────────────────────────────────────────────────
# Documents (knowledge base)
# ──────────────────────────────────────────────────────────

def insert_document(
    title: str,
    author: str = "System",
    category: str = "Uncategorized",
    tags: list[str] | None = None,
    file_name: str | None = None,
    file_path: str | None = None,
    status: str = "processing",
) -> dict:
    data = {
        "title": title,
        "author": author,
        "category": category,
        "tags": tags or [],
        "file_name": file_name,
        "file_path": file_path,
        "status": status,
    }
    res = get_client().table("documents").insert(data).execute()
    return res.data[0]


def list_documents() -> list[dict]:
    res = (
        get_client()
        .table("documents")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


def update_document_status(doc_id: str, status: str):
    get_client().table("documents").update({"status": status}).eq("id", doc_id).execute()


def update_document_last_used(doc_id: str):
    from datetime import datetime, timezone
    get_client().table("documents").update(
        {"last_used_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", doc_id).execute()


def delete_document(doc_id: str) -> bool:
    # Chunks will be deleted automatically due to ON DELETE CASCADE
    get_client().table("documents").delete().eq("id", doc_id).execute()
    return True


# ──────────────────────────────────────────────────────────
# Vector & Hybrid Search (RAG)
# ──────────────────────────────────────────────────────────

def insert_document_chunk(
    doc_id: str,
    content: str,
    embedding: list[float],
    metadata: dict | None = None,
) -> dict:
    """Insert a text chunk with its embedding into Supabase."""
    data = {
        "document_id": doc_id,
        "content": content,
        "embedding": embedding,
        "metadata": metadata or {},
    }
    res = get_client().table("document_chunks").insert(data).execute()
    return res.data[0]


def match_documents(
    query_embedding: list[float],
    query_text: str,
    match_threshold: float = 0.5,
    match_count: int = 10,
) -> list[dict]:
    """
    Call the Postgres RPC function for hybrid search.
    Combines vector similarity and full-text search.
    """
    res = get_client().rpc(
        "match_documents",
        {
            "query_embedding": query_embedding,
            "query_text": query_text,
            "match_threshold": match_threshold,
            "match_count": match_count,
        }
    ).execute()
    return res.data


def delete_document_chunks(doc_id: str):
    """Explicitly delete chunks (though CASCADE should handle it)."""
    get_client().table("document_chunks").delete().eq("document_id", doc_id).execute()


# ──────────────────────────────────────────────────────────
# Stats (aggregated)
# ──────────────────────────────────────────────────────────

def get_stats() -> dict:
    """Build dashboard stats from the database."""
    # Total AI messages (= total queries answered)
    ai_msgs = (
        get_client()
        .table("messages")
        .select("id", count="exact")
        .eq("sender", "ai")
        .execute()
    )
    total_queries = ai_msgs.count or 0

    # Total sessions
    sessions = (
        get_client()
        .table("sessions")
        .select("id", count="exact")
        .execute()
    )
    total_sessions = sessions.count or 0

    # Feedback
    fb = get_feedback_stats()

    # Intent breakdown
    intent_msgs = (
        get_client()
        .table("messages")
        .select("intent")
        .eq("sender", "ai")
        .not_.is_("intent", "null")
        .execute()
    )
    intents: dict[str, int] = {}
    for m in intent_msgs.data:
        label = m.get("intent", "Unknown")
        intents[label] = intents.get(label, 0) + 1

    # Recent queries (last 20)
    recent = (
        get_client()
        .table("messages")
        .select("id, text, intent, sources, created_at, session_id, is_unanswered")
        .eq("sender", "user")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    total_feedback = fb["thumbs_up"] + fb["thumbs_down"]
    resolution_rate = (fb["thumbs_up"] / total_feedback * 100) if total_feedback > 0 else 0.0

    return {
        "total_queries": total_queries,
        "total_sessions": total_sessions,
        "resolution_rate": round(resolution_rate, 1),
        "thumbs_up_count": fb["thumbs_up"],
        "thumbs_down_count": fb["thumbs_down"],
        "intents": intents,
        "recent_queries": recent.data,
        "open_gaps": _count_gaps("open"),
        "escalated_gaps": _count_escalated_gaps(),
    }


def _count_gaps(status: str) -> int:
    """Count knowledge gaps with a given status."""
    res = (
        get_client()
        .table("knowledge_gaps")
        .select("id", count="exact")
        .eq("status", status)
        .execute()
    )
    return res.count or 0


def _count_escalated_gaps() -> int:
    """Count open gaps with hit_count >= 3 (escalation threshold)."""
    res = (
        get_client()
        .table("knowledge_gaps")
        .select("id", count="exact")
        .eq("status", "open")
        .gte("hit_count", 3)
        .execute()
    )
    return res.count or 0


# ──────────────────────────────────────────────────────────
# Knowledge Gaps
# ──────────────────────────────────────────────────────────

def upsert_knowledge_gap(
    normalized_query: str,
    original_query: str,
    session_id: str,
) -> dict:
    """
    Record an unanswered query.
    If a gap with the same normalized query exists → update it.
    Otherwise → insert a new row.
    """
    existing = (
        get_client()
        .table("knowledge_gaps")
        .select("*")
        .eq("query_normalized", normalized_query)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        sample_queries = row.get("sample_queries", [])
        session_ids = row.get("session_ids", [])

        # Append original query if not already stored (keep max 10 samples)
        if original_query not in sample_queries and len(sample_queries) < 10:
            sample_queries.append(original_query)

        # Append session_id if distinct
        if session_id not in session_ids:
            session_ids.append(session_id)

        update_data = {
            "sample_queries": sample_queries,
            "session_ids": session_ids,
            "hit_count": row["hit_count"] + 1,
            "last_seen": "now()",
        }
        # Re-open dismissed/acknowledged gaps if new sessions hit them
        if row["status"] != "open" and session_id not in row.get("session_ids", []):
            update_data["status"] = "open"

        res = (
            get_client()
            .table("knowledge_gaps")
            .update(update_data)
            .eq("id", row["id"])
            .execute()
        )
        return res.data[0]
    else:
        data = {
            "query_normalized": normalized_query,
            "sample_queries": [original_query],
            "session_ids": [session_id],
            "hit_count": 1,
            "status": "open",
        }
        res = get_client().table("knowledge_gaps").insert(data).execute()
        return res.data[0]


def list_knowledge_gaps(include_dismissed: bool = False) -> list[dict]:
    """Return knowledge gaps, ordered by last_seen desc."""
    query = (
        get_client()
        .table("knowledge_gaps")
        .select("*")
        .order("last_seen", desc=True)
    )
    if not include_dismissed:
        query = query.neq("status", "dismissed")
    res = query.execute()
    return res.data


def update_knowledge_gap_status(gap_id: str, status: str) -> dict:
    """Update a knowledge gap's status (acknowledge / dismiss)."""
    res = (
        get_client()
        .table("knowledge_gaps")
        .update({"status": status})
        .eq("id", gap_id)
        .execute()
    )
    return res.data[0]
