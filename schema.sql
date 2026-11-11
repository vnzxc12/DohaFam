-- ========================================================
-- DOHA FAM CHRISTMAS PARTY 2026 — SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/nkctcwwbgqrqmfcqfksa/sql
-- ========================================================

-- 1. Create table for family members and their wishes
CREATE TABLE IF NOT EXISTS public.wishlist_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🎁',
  locked BOOLEAN DEFAULT FALSE,
  wishes JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure locked column exists if table was already created
ALTER TABLE public.wishlist_members ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.wishlist_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.wishlist_members FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access"
  ON public.wishlist_members FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON public.wishlist_members FOR UPDATE
  USING (true);

-- 3. Seed Initial 14 Doha Fam Members with 3 blank wish slots each
INSERT INTO public.wishlist_members (id, name, avatar, wishes)
VALUES
  ('jon', 'Jon', '🎅', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('daniel', 'Daniel', '🎄', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('banjo', 'Banjo', '⭐', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('vonn', 'Vonn', '🎁', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('francis', 'Francis', '🦌', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('denzel', 'Denzel', '⛄', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('kevin', 'Kevin', '🔔', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('jopet', 'Jopet', '🍪', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('jen', 'Jen', '✨', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('mira', 'Mira', '🎀', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('zeus', 'Zeus', '⚡', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('maria', 'Maria', '🕯️', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('armi', 'Armi', '🧣', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('belle', 'Belle', '❄️', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb),
  ('aron', 'Aron', '🎉', '[{"id": 1, "title": "", "note": "", "link": "", "claimed": false}, {"id": 2, "title": "", "note": "", "link": "", "claimed": false}, {"id": 3, "title": "", "note": "", "link": "", "claimed": false}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  avatar = EXCLUDED.avatar;
