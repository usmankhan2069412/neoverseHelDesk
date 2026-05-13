from typing import Tuple, List, Dict
from sentence_transformers import CrossEncoder
from scipy.special import expit
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings

from rag.config import (
    logger, TOP_K_RETRIEVAL, RELEVANCE_THRESHOLD, RERANKER_MODEL,
    TOP_N_RERANK, CHUNK_SIZE, CHUNK_OVERLAP, EMBEDDING_MODEL
)
# Supabase client is imported directly where needed, or at module level
from services import supabase_client as db

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
        
        # RAW SIMILARITY CHECK
        if max_raw_score < 1e-5:
            logger.info(f"ReRanker: ALL docs rejected! max_raw_score {max_raw_score:.6f} < 1e-5")
            return [], []

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
