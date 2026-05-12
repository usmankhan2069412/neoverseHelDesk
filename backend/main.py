"""
=============================================================
NEOVERSE AI DESK — FastAPI Server
=============================================================
Entry point for the backend API.
Wraps the RAG pipeline and exposes REST endpoints.

Run:  uvicorn main:app --reload --host 0.0.0.0 --port 8000
=============================================================
"""

import os
import shutil
import logging
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from dotenv import load_dotenv

from models.schemas import (
    ChatRequest, ChatResponse,
    FeedbackRequest, FeedbackResponse,
    SessionOut, SessionCreateRequest, MessageOut,
    DocumentOut, DocumentCreateRequest,
    StatsResponse,
    KnowledgeGapOut, KnowledgeGapUpdateRequest,
)
from services import supabase_client as db
from rag_pipeline import NeoversRAGSystem, DATA_DIR, load_documents, split_documents

# ─── Setup ────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Silence verbose library logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("huggingface_hub").setLevel(logging.WARNING)

# ─── RAG system (module-level, initialised on startup) ────
rag_system: NeoversRAGSystem | None = None

# Per-session conversation history stored in memory
# Maps session_id -> list of {"user": ..., "assistant": ...}
session_histories: dict[str, list[dict]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise the heavy RAG system once at startup."""
    global rag_system
    logger.info("Starting RAG system initialisation (this may take 15-30s)...")
    loop = asyncio.get_event_loop()
    rag_system = NeoversRAGSystem()
    await loop.run_in_executor(None, rag_system.initialize)
    logger.info("RAG system ready.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Neoverse AI Desk API",
    description="RAG-powered IT helpdesk backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Error Handlers ───────────────────────────────────────

@app.exception_handler(httpx.ConnectError)
async def supabase_connect_error_handler(request: Request, exc: httpx.ConnectError):
    """Handle cases where the server cannot reach Supabase."""
    logger.error(f"Supabase connection error: {exc}")
    return JSONResponse(
        status_code=503,
        content={"detail": "Database connection failed. Please check your internet or SUPABASE_URL in .env"},
    )

@app.exception_handler(httpx.HTTPStatusError)
async def supabase_http_error_handler(request: Request, exc: httpx.HTTPStatusError):
    """Handle cases where Supabase returns an error code."""
    logger.error(f"Supabase HTTP error: {exc.response.status_code} - {exc.response.text}")
    return JSONResponse(
        status_code=exc.response.status_code,
        content={"detail": f"Database error: {exc.response.text}"},
    )


# ─── Health ───────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "rag_ready": rag_system is not None}


# ═════════════════════════════════════════════════════════
# CHAT
# ═════════════════════════════════════════════════════════

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Send a query to the RAG pipeline and persist the exchange."""
    if rag_system is None:
        raise HTTPException(status_code=503, detail="RAG system not ready")

    try:
        # 1. Resolve or create session
        session_id = req.session_id
        if not session_id:
            session = db.create_session(title=req.query[:60])
            session_id = session["id"]

        # 2. Save user message to Supabase
        user_msg = db.insert_message(session_id=session_id, sender="user", text=req.query)

        # 3. Load session history (passed as parameter for thread safety)
        history = session_histories.get(session_id, [])

        # 4. Run the RAG pipeline (blocking — run in executor)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, rag_system.ask, req.query, history)

        # 5. Update session history cache
        updated_history = list(history)  # copy to avoid mutation
        updated_history.append({"user": req.query, "assistant": result["answer"]})
        if len(updated_history) > 5:
            updated_history = updated_history[-5:]
        session_histories[session_id] = updated_history

        # 6. Save AI response to Supabase
        ai_msg = db.insert_message(
            session_id=session_id,
            sender="ai",
            text=result["answer"],
            intent=result.get("intent"),
            sources=result.get("sources", []),
            docs_passed=result.get("docs_passed"),
            top_score=result.get("top_score"),
        )

        # 7. Record knowledge gap if unanswered
        # Unanswered means either no docs found, OR the LLM determined docs don't contain the answer
        # and returned the strict fallback string defined in its prompt.
        is_unanswered = (
            result.get("docs_passed", 0) == 0 or
            "I don't have this information right now" in result["answer"]
        )
        
        if is_unanswered and result.get("intent") not in ("Small_Talk", "Complaint"):
            try:
                normalized = rag_system.preprocessor.process(req.query)
                db.upsert_knowledge_gap(normalized, req.query, session_id)
                logger.info(f"Knowledge gap recorded: {normalized[:60]}")
            except Exception as e:
                logger.warning(f"Failed to record knowledge gap: {e}")

        # 8. Update user message with intent, sources, and unanswered flag
        try:
            db.update_user_message(
                message_id=user_msg["id"],
                is_unanswered=is_unanswered,
                intent=result.get("intent"),
                sources=result.get("sources", [])
            )
        except Exception as e:
            logger.warning(f"Failed to update user message: {e}")

        return ChatResponse(
            answer=result["answer"],
            intent=result.get("intent", ""),
            sources=result.get("sources", []),
            docs_passed=result.get("docs_passed", 0),
            top_score=result.get("top_score", 0),
            session_id=session_id,
            message_id=ai_msg["id"],
        )
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        # If it's already an HTTPException, re-raise it
        if isinstance(e, HTTPException):
            raise e
        # Otherwise, wrap it
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


# ═════════════════════════════════════════════════════════
# FEEDBACK
# ═════════════════════════════════════════════════════════

@app.post("/api/feedback", response_model=FeedbackResponse)
def feedback(req: FeedbackRequest):
    """Record thumbs-up / thumbs-down on an AI message and propagate to RAG feedback system."""
    db.insert_feedback(message_id=req.message_id, vote=req.vote)

    # Also propagate to the in-memory RAG feedback system
    if rag_system is not None:
        # Fetch the message to get sources for the RAG feedback loop
        try:
            msg = (
                db.get_client()
                .table("messages")
                .select("text, intent, sources")
                .eq("id", req.message_id)
                .single()
                .execute()
            )
            if msg.data:
                result = {
                    "answer": msg.data.get("text", ""),
                    "intent": msg.data.get("intent", ""),
                    "sources": msg.data.get("sources", []),
                    "query": "",
                }
                rag_system.feedback(req.vote, result)
        except Exception as e:
            logger.warning(f"RAG feedback propagation failed: {e}")

    return FeedbackResponse(success=True)


# ═════════════════════════════════════════════════════════
# SESSIONS
# ═════════════════════════════════════════════════════════

@app.get("/api/sessions", response_model=list[SessionOut])
def list_sessions():
    rows = db.list_sessions()
    return [SessionOut(**r) for r in rows]


@app.post("/api/sessions", response_model=SessionOut)
def create_session(req: SessionCreateRequest):
    session = db.create_session(title=req.title)
    return SessionOut(
        id=session["id"],
        title=session.get("title"),
        created_at=session["created_at"],
        message_count=0,
    )


@app.get("/api/sessions/{session_id}/messages", response_model=list[MessageOut])
def get_session_messages(session_id: str):
    msgs = db.get_messages(session_id)
    return [MessageOut(**m) for m in msgs]


@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    # Clear in-memory history too
    session_histories.pop(session_id, None)
    db.delete_session(session_id)
    return {"success": True}


# ═════════════════════════════════════════════════════════
# DOCUMENTS (Knowledge Base)
# ═════════════════════════════════════════════════════════

@app.get("/api/documents", response_model=list[DocumentOut])
def list_documents():
    return db.list_documents()


@app.post("/api/documents", response_model=DocumentOut)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(""),
    category: str = Form("Uncategorized"),
    tags: str = Form(""),
):
    """
    Upload a document file to the knowledge base.
    1. Save file to backend/Data/
    2. Insert metadata to Supabase
    3. Re-index the vector store in background
    """
    # Validate file type
    allowed_extensions = {".txt", ".pdf", ".docx"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {allowed_extensions}")

    # Save file to Data/ directory
    file_name = file.filename
    file_path = DATA_DIR / file_name
    
    # Ensure the Data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    logger.info(f"File saved: {file_path}")

    # Insert metadata to Supabase
    doc_title = title or Path(file_name).stem
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    doc = db.insert_document(
        title=doc_title,
        category=category,
        tags=tag_list,
        file_name=file_name,
        file_path=str(file_path),
        status="processing",
    )

    # Re-index the document in Supabase (background)
    async def process_document(doc_id: str, f_path: Path):
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, _index_to_supabase, doc_id, f_path)
            db.update_document_status(doc_id, "indexed")
            logger.info(f"Document {doc_id} indexed to Supabase successfully")
        except Exception as e:
            logger.error(f"Indexing failed for {doc_id}: {e}")
            db.update_document_status(doc_id, "failed")

    asyncio.create_task(process_document(doc["id"], file_path))

    return DocumentOut(
        id=doc["id"],
        title=doc["title"],
        author=doc.get("author", "System"),
        category=doc["category"],
        tags=doc["tags"],
        status=doc["status"],
        file_name=doc.get("file_name"),
        created_at=doc["created_at"],
        last_used_at=doc.get("last_used_at"),
    )


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document from Supabase and optionally from disk, then re-index."""
    # Get file info before deleting
    docs = db.list_documents()
    target = next((d for d in docs if d["id"] == doc_id), None)

    db.delete_document(doc_id)

    # Remove file from disk if it exists
    if target and target.get("file_name"):
        file_path = DATA_DIR / target["file_name"]
        if file_path.exists():
            file_path.unlink()
            logger.info(f"File deleted: {file_path}")

    return {"success": True}


def _index_to_supabase(doc_id: str, file_path: Path):
    """Chunk a document and push embeddings to Supabase."""
    if rag_system is None:
        return

    # 1. Load and Chunk
    from rag_pipeline import split_documents
    # We load only the specific file to be efficient
    from langchain_community.document_loaders import TextLoader, PyPDFLoader, Docx2txtLoader
    ext = file_path.suffix.lower()
    if ext == ".txt": loader = TextLoader(str(file_path))
    elif ext == ".pdf": loader = PyPDFLoader(str(file_path))
    elif ext == ".docx": loader = Docx2txtLoader(str(file_path))
    else: return

    docs = loader.load()
    chunks = split_documents(docs)

    # 2. Embed and Push in Bulk
    if chunks:
        texts = [chunk.page_content for chunk in chunks]
        embeddings = rag_system.embeddings.embed_documents(texts)
        
        chunk_data = []
        for chunk, emb in zip(chunks, embeddings):
            chunk_data.append({
                "document_id": doc_id,
                "content": chunk.page_content,
                "embedding": emb,
                "metadata": chunk.metadata or {}
            })
            
        # Bulk insert to Supabase
        if chunk_data:
            from services import supabase_client as db
            db.get_client().table("document_chunks").insert(chunk_data).execute()


# ═════════════════════════════════════════════════════════
# STATS (Dashboard)
# ═════════════════════════════════════════════════════════

@app.get("/api/stats", response_model=StatsResponse)
def get_stats():
    return db.get_stats()


# ═════════════════════════════════════════════════════════
# KNOWLEDGE GAPS
# ═════════════════════════════════════════════════════════

@app.get("/api/knowledge-gaps", response_model=list[KnowledgeGapOut])
def list_knowledge_gaps():
    """Return all non-dismissed knowledge gaps."""
    rows = db.list_knowledge_gaps()
    return [KnowledgeGapOut(**r) for r in rows]


@app.patch("/api/knowledge-gaps/{gap_id}", response_model=KnowledgeGapOut)
def update_knowledge_gap(gap_id: str, req: KnowledgeGapUpdateRequest):
    """Acknowledge or dismiss a knowledge gap."""
    row = db.update_knowledge_gap_status(gap_id, req.status)
    return KnowledgeGapOut(**row)
