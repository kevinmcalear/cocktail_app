-- Small Hand Foods Orgeat files under Almond liqueur, not the Orgeat syrup
-- style (Kevin's call; 20261011166000 kept it in syrups). The producer's FAQ
-- says it's made with "a bit of brandy", so it isn't a syrup, and its ABV of 0
-- (from 20261001190000) was wrong. The producer gives no ABV, so it's left
-- unknown. Filed the way the liqueur load files bottles (20261011163000):
-- a product under its style, the same as Nardini Acqua di Mandorla. Bottles
-- carry no categories of their own; Almond liqueur's is Nut/Seed Liqueur.
-- Safe to run twice, and does nothing when either row is missing.

SET "app.image_worker" = 'on';
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

CREATE TEMP TABLE "orgeat_move" AS
SELECT b.id, s.id AS style_id
  FROM public.items b
 CROSS JOIN LATERAL (
       SELECT i.id FROM public.items i
        WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role = 'generic'
          AND public.ingredient_key(i.name) = public.ingredient_key('Almond liqueur')
        ORDER BY i.is_core DESC, i.created_at LIMIT 1) s
 WHERE b.item_type = 'ingredient' AND b.bar_id IS NULL AND b.ingredient_role = 'product'
   AND public.ingredient_key(b.name) = public.ingredient_key('Small Hand Foods Orgeat');

UPDATE public.items i SET
    generic_id = m.style_id,
    made_from_id = NULL,
    abv = CASE WHEN i.abv = 0 THEN NULL ELSE i.abv END
  FROM "orgeat_move" m
 WHERE i.id = m.id
   AND (i.generic_id IS DISTINCT FROM m.style_id OR i.made_from_id IS NOT NULL OR i.abv = 0);

-- The syrups page was the source for its old style; the FAQ is the source now.
DELETE FROM public.item_sources s USING "orgeat_move" m
 WHERE s.item_id = m.id AND s.field = 'style' AND s.url = 'https://smallhandfoods.com/syrups';
INSERT INTO public.item_sources (item_id, field, url, kind, checked_on, note)
SELECT m.id, 'style', 'https://smallhandfoods.com/faq/', 'producer', DATE '2026-10-13',
       'Made with sweet and bitter almonds, orange flower water and a bit of brandy.'
  FROM "orgeat_move" m
ON CONFLICT ON CONSTRAINT "item_sources_one_per_page" DO NOTHING;

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;
DROP TABLE "flavor_jobs_before", "orgeat_move";
RESET "app.image_worker";
