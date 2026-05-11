-- =============================================================
-- NEOVERSE AI DESK — Supabase Database Schema
-- =============================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================

-- Conversation sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    title TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Chat messages within a session
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
    sender TEXT CHECK (sender IN ('user', 'ai')) NOT NULL,
    text TEXT NOT NULL,
    intent TEXT,
    sources TEXT[],
    docs_passed INT,
    top_score FLOAT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- User feedback on AI messages
CREATE TABLE IF NOT EXISTS feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
    vote TEXT CHECK (vote IN ('up', 'down')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Knowledge base documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'System',
    category TEXT DEFAULT 'Uncategorized',
    tags TEXT[] DEFAULT '{}',
    status TEXT CHECK (status IN ('indexed', 'processing', 'failed')) DEFAULT 'processing',
    file_path TEXT,
    file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
CREATE INDEX IF NOT EXISTS idx_feedback_message ON feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- =============================================================
-- RLS POLICIES (disabled — no auth in this project)
-- =============================================================
-- Since there is no authentication, disable RLS on all tables
-- so the anon key can read/write freely.

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users (no auth)
CREATE POLICY "Allow all for anon" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON documents FOR ALL USING (true) WITH CHECK (true);
