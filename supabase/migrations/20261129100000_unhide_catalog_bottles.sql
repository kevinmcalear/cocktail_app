-- Catalog bottles back in ingredient search.
--
-- The early drink seeds (30 Sep to 8 Oct) hid every bar's named bottle from
-- search, to keep one-off menu names out. The bottle catalog later filed most
-- of them under a kind (generic_id) as real products, but never cleared the
-- flag, so about 2,000 bottles (Fords Gin, Four Pillars Gin, Wild Turkey)
-- only showed when typed in full. A shared product with a kind is a catalog
-- bottle: it shows in search. Unfiled ones stay hidden.
UPDATE public.items
   SET hide_from_search = false
 WHERE item_type = 'ingredient'
   AND bar_id IS NULL
   AND ingredient_role = 'product'
   AND generic_id IS NOT NULL
   AND hide_from_search;
