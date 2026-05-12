-- =============================================================
-- NEOVERSE AI DESK — Knowledge Gaps Table
-- =============================================================
-- Tracks unanswered queries (docs_passed = 0) and groups them
-- by normalized query text for pattern detection.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================

CREATE TABLE IF NOT EXISTS knowledge_gaps (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_normalized  TEXT NOT NULL,
    sample_queries    TEXT[] DEFAULT '{}',
    session_ids       TEXT[] DEFAULT '{}',
    hit_count         INT DEFAULT 1,
    status            TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'dismissed')),
    first_seen        TIMESTAMPTZ DEFAULT now(),
    last_seen         TIMESTAMPTZ DEFAULT now()
);

-- Unique index on normalized query for upsert lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_gaps_query
    ON knowledge_gaps (query_normalized);

-- Index for filtering by status (Control Center queries)
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_status
    ON knowledge_gaps (status);

-- RLS (matches existing pattern — no auth)
ALTER TABLE knowledge_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON knowledge_gaps FOR ALL USING (true) WITH CHECK (true);
