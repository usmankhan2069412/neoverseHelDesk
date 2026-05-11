"""
Pydantic request/response models for the Neoverse API.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ─── Chat ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User's question")
    session_id: Optional[str] = Field(None, description="Existing session UUID; omit to create a new session")


class ChatResponse(BaseModel):
    answer: str
    intent: str
    sources: list[str]
    docs_passed: int
    top_score: float
    session_id: str
    message_id: str


# ─── Feedback ─────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    message_id: str
    vote: str = Field(..., pattern="^(up|down)$")


class FeedbackResponse(BaseModel):
    success: bool


# ─── Sessions ─────────────────────────────────────────────

class SessionOut(BaseModel):
    id: str
    title: Optional[str] = None
    created_at: str
    message_count: int = 0


class SessionCreateRequest(BaseModel):
    title: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    sender: str
    text: str
    intent: Optional[str] = None
    sources: Optional[list[str]] = None
    docs_passed: Optional[int] = None
    top_score: Optional[float] = None
    created_at: str


# ─── Documents ────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: str
    title: str
    author: str
    category: str
    tags: list[str]
    status: str
    file_name: Optional[str] = None
    created_at: str
    last_used_at: Optional[str] = None


class DocumentCreateRequest(BaseModel):
    title: str
    category: str = "Uncategorized"
    tags: str = ""  # comma-separated


# ─── Stats ────────────────────────────────────────────────

class StatsResponse(BaseModel):
    total_queries: int
    total_sessions: int
    resolution_rate: float
    thumbs_up_count: int
    thumbs_down_count: int
    intents: dict[str, int]
    recent_queries: list[dict]
