-- =============================================================
-- NEOVERSE AI DESK — RAG Scalability Migration
-- =============================================================

-- 1. Add boost_score to documents table for cross-encoder reranking feedback
ALTER TABLE documents ADD COLUMN IF NOT EXISTS boost_score FLOAT DEFAULT 1.0;

-- 2. Create training_data table to replace training_data.jsonl
CREATE TABLE IF NOT EXISTS training_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query TEXT NOT NULL,
    intent TEXT NOT NULL,
    feedback TEXT CHECK (feedback IN ('up', 'down')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add index for faster querying during retrain
CREATE INDEX IF NOT EXISTS idx_training_data_feedback ON training_data(feedback);

-- 4. Enable RLS and add anon policy (since no auth is used currently)
ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON training_data FOR ALL USING (true) WITH CHECK (true);
