-- Notion-style cover focal point (0 = top, 100 = bottom)
ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS cover_position real DEFAULT 50;
