-- Gives every bottle a venue made before PR #1181 the back_bar_items row a
-- new one gets. Since #1181, saving a new bottle for a bar (sendBottle in
-- hooks/barWrites.ts) also puts it on that bar's stock list. Bottles made
-- before that have no stock row, so Name taken reads "On the back bar." with
-- no month, and anything that reads back_bar_items misses them.
--
--   * Inserts one row per bottle that lacks one. Nothing is updated or
--     deleted, and no table, column, policy or function changes.
--   * Running it again adds nothing (NOT EXISTS, and ON CONFLICT DO NOTHING
--     on the bar_id, item_id key).
--
-- Which items: an ingredient the bar owns (items.bar_id) whose role is
-- 'product', the role sendBottle writes and the one the app reads as a
-- bought bottle. Left out: house-mades ('prep'), kinds ('generic'), bar
-- items with no role (lines typed into a spec, garnishes, older house-mades:
-- the role is what says they're a bottle, and their names don't say it
-- reliably), cocktails, beers and wines (their own item types), and merged
-- items (private.item_merges; the merge already deleted those rows).
--
-- Each row is shaped as sendBottle writes it: source 'back_bar', no
-- from_name, added by whoever made the bottle (null when unknown), and dated
-- the day the bottle was made, so "On the back bar since <month>" is true.

insert into public.back_bar_items (bar_id, item_id, source, added_by, added_at)
select i.bar_id, i.id, 'back_bar', i.created_by, i.created_at
from public.items i
where i.item_type = 'ingredient'
  and i.ingredient_role = 'product'
  and i.bar_id is not null
  and not exists (select 1 from public.back_bar_items b where b.bar_id = i.bar_id and b.item_id = i.id)
  and not exists (select 1 from private.item_merges m where m.from_id = i.id)
on conflict (bar_id, item_id) do nothing;
