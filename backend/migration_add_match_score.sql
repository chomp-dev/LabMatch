-- Add match_score and match_reasoning columns to professor_cards table

ALTER TABLE professor_cards 
ADD COLUMN IF NOT EXISTS match_score float8 DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS match_reasoning text;
