-- Who sees your page gains Private (Kevin, 15 Oct 2026): the bar's facts,
-- hours, people and awards only. Its own migration because a new enum value
-- can't be used in the transaction that adds it; the rules that use it come
-- next (20261024200000). Placed first so the enum reads as the ladder:
-- private < locked (Names) < description (Menu) < open.
ALTER TYPE public.bar_page_visibility ADD VALUE IF NOT EXISTS 'private' BEFORE 'locked';
