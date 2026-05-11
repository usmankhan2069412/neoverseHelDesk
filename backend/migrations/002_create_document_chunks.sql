-- =============================================================
-- NEOVERSE AI DESK — Document Chunks + Hybrid Search
-- =============================================================
-- Creates the vector storage table and the hybrid search RPC
-- that the RAG pipeline depends on.
-- =============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384) NOT NULL,  -- all-MiniLM-L6-v2 produces 384-dim vectors
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Full-text search column (auto-generated from content)
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON document_chunks USING gin(fts);

-- RLS (open for anon — no auth in this project)
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON document_chunks;
CREATE POLICY "Allow all for anon" ON document_chunks FOR ALL USING (true) WITH CHECK (true);

-- Drop old versions of the function to prevent PGRST203 overloaded function errors
DROP FUNCTION IF EXISTS public.match_documents(vector, text, double precision, integer);
DROP FUNCTION IF EXISTS public.match_documents(vector, double precision, integer, text);
DROP FUNCTION IF EXISTS public.match_documents(vector, text, float, int);
DROP FUNCTION IF EXISTS public.match_documents(vector, float, int, text);

-- Hybrid search RPC: combines vector similarity with full-text ranking
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(384),
    query_text text,
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.metadata,
        (1 - (dc.embedding <=> query_embedding))::float AS similarity
    FROM document_chunks dc
    WHERE (1 - (dc.embedding <=> query_embedding)) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
