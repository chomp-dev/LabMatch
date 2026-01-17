-- Run this in your Supabase SQL Editor

ALTER TABLE public.scrape_sessions 
ADD COLUMN IF NOT EXISTS major text;

ALTER TABLE public.scrape_sessions 
ADD COLUMN IF NOT EXISTS custom_prompt text;
