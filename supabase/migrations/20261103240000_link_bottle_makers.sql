-- Bottles whose maker is named in text get its maker page (database audit,
-- 22 Oct, 2.3).
--
-- items.brand_maker is the name on the label as a catalog load or a person
-- typed it ("Eagle Rare", "Bundaberg"); items.maker_profile_id is the maker's
-- page (Buffalo Trace Distillery). They are different facts more often than
-- not: a brand and the house that makes it. But 383 shared catalog bottles
-- name a maker in text, exactly as one maker page is called, and still had no
-- page. They now point at it, so they show on that maker's page. This is a
-- one-off: bottles added later are not linked by it.
--
--   * Exact names only (letter case aside), matched to exactly one maker page
--     that makes bottles; a near match ("Lark" and "Lark Distillery") waits
--     for a person, because names that differ are often brand and maker.
--   * Branded bottles only (ingredient_role 'product'): a style ("Peach
--     Bitters") or a house prep isn't one house's product, even when its
--     text names one. Shared catalog rows only: nothing a venue or a person
--     owns changes.
--   * brand_maker stays: it is the label's name, and the only home for a
--     beer's brewery or a wine's producer (only ingredients have maker pages,
--     private.guard_item_maker). docs/drink_data.md says which field holds what.
--
-- No RLS or grant changes. Running it again changes nothing.

UPDATE public.items i
   SET maker_profile_id = m.id
  FROM public.profiles m
 WHERE i.item_type = 'ingredient'
   AND i.ingredient_role = 'product'
   AND i.maker_profile_id IS NULL
   AND i.brand_maker IS NOT NULL
   AND i.bar_id IS NULL
   AND i.created_by IS NULL
   AND m.kind = 'maker'
   AND 'bottles' = ANY (m.makes)
   AND lower(m.display_name) = lower(btrim(i.brand_maker))
   AND (SELECT count(*) FROM public.profiles x WHERE x.kind = 'maker' AND lower(x.display_name) = lower(btrim(i.brand_maker))) = 1;
