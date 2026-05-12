-- =============================================================
-- NEOVERSE AI DESK — Add is_unanswered to messages
-- =============================================================
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_unanswered BOOLEAN DEFAULT FALSE;
