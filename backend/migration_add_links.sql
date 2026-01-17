-- Migration: Add links column to professor_cards table
-- Run this in the Supabase SQL Editor

ALTER TABLE public.professor_cards
ADD COLUMN IF NOT EXISTS links jsonb DEFAULT '[]'::jsonb;

-- Add a comment for clarity
COMMENT ON COLUMN public.professor_cards.links IS 'Array of {label, url} objects for specific links (Scholar, CV, Lab, etc.)';
