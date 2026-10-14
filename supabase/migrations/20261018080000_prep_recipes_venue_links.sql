-- Venue preps that share their name with a shared catalog prep become a
-- version of it (after 20261018070000). Stage 4H of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
-- Kevin reviewed the 44 venue preps listed here by id (no names: they're
-- venues' own) and chose to link them all. Each gets the catalog prep with
-- exactly its name as its "kind of" (generic_id), which is what the name
-- guard (20261008100000) asks of a venue's own version of a shared
-- ingredient. Nothing is copied either way: the venue prep keeps its name,
-- lines, steps and keep.
--
--   * Only where the venue prep has no kind yet, or its kind is a plain
--     shared style (Cordial, Milk): a kind that's another prep or one of the
--     venue's own is left alone.
--   * A row that's gone, renamed or now has no catalog match is skipped.
--   * A second run changes nothing: once linked, its kind is a prep.
--   * No flavour job is queued.

SET "app.image_worker" = 'on';
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

CREATE TEMP TABLE link_in (venue_id uuid PRIMARY KEY);
INSERT INTO link_in VALUES
('045faf51-a704-52e1-9042-3296a6b81838'),
('0cb4bf20-67b4-5ef8-b07b-221592b4794e'),
('101143de-e435-55f1-88dd-3c15e08e02d5'),
('1042080a-7928-55a3-a33a-7564aba96a10'),
('193d6646-df0b-5b6d-b064-206b48cad5ac'),
('19ed4b7e-7459-50da-8663-bfc9389ad15a'),
('30e6f024-ff74-5816-8482-ba7255a35e18'),
('33190c9a-7a3a-55b4-bcbf-c6d863816b6b'),
('33a7c1e7-5945-5493-8669-73aa1eb1f2e4'),
('3ab5efae-0be7-50af-830b-5ce2593cdbea'),
('3baad58a-7a50-53ef-9767-bbaa49e7480b'),
('43e41f93-5089-552c-a55c-73ad8953e732'),
('4619b651-9239-585d-8b75-5edf1112a3be'),
('47a16bda-96e4-5dac-ad61-b3f7f44016cc'),
('4c763e7b-be3c-5b96-8fae-e72849b5b87d'),
('568405a1-7d14-5a4e-9e09-e95ac62bc2e7'),
('5eb78243-3d9a-5155-8e42-d38f402b0840'),
('61f6d0b8-3a73-5dee-9dac-4d1914e0d7a3'),
('66c39c4f-001e-5583-9aa5-c09c444543e2'),
('6a28649e-82a7-5c22-b63f-6b859564ef62'),
('77a951c8-93b4-5340-8803-de7f28994819'),
('824a3849-edc7-586e-a6d4-1bba8edc79a0'),
('838e0838-3fdb-51be-a1a1-2dac0e5e3b00'),
('877afa89-23f3-5fc5-b3ee-4e525558b0a5'),
('8914e9db-1e11-52af-bb9d-2a4e03e0521f'),
('98523621-75d2-577c-8db9-74cb03f033ef'),
('9a7f736e-e289-57ce-bac3-918ad262e55e'),
('bb5d49f5-83d8-5e09-b6d1-8b7a28db2ea3'),
('c48a5eb1-128a-587e-b356-56893f7aa75c'),
('c51115a9-4098-52a7-a8f0-515c9c2fb9ab'),
('cb606568-8fe4-5b66-944c-bd0a7b23c53d'),
('cb8f63b4-46ed-53da-90eb-b73342a8993f'),
('cd3837d6-3113-5aa1-9d10-e75529719561'),
('d25172bf-edc1-5e2f-9b10-9464b7012618'),
('db49824e-6f8d-536a-948a-66adbc65e24e'),
('df96775e-1b20-58b5-a2f2-3e56ec8fbe20'),
('e5af1d0d-eccc-5cc1-b0ed-58290ff19285'),
('e82da9dc-6b5a-5acc-b6ec-38ec8a070c7b'),
('eb9d1ad4-60ae-51a6-a603-3b34d6bf3ddc'),
('f2558d2f-8a9e-55f7-82ef-af56106ef41d'),
('f6222d10-f905-59b4-afe1-eea10a16291a'),
('f6f24b94-a173-5a99-8c74-268498d16e93'),
('faff897b-5c6b-5285-92ea-fe9cdc5c9c7c'),
('fea22bdf-64b0-511c-ac18-620ad64710b9');

-- The catalog prep with exactly each listed venue prep's name.
CREATE TEMP TABLE link_row AS
SELECT v.id, (
       SELECT c.id FROM public.items c
        WHERE c.item_type = 'ingredient' AND c.bar_id IS NULL AND c.created_by IS NULL
          AND c.ingredient_role = 'prep'
          AND public.ingredient_key(c.name) = public.ingredient_key(v.name)
        ORDER BY c.created_at LIMIT 1) AS catalog_id
  FROM link_in l
  JOIN public.items v ON v.id = l.venue_id
 WHERE v.item_type = 'ingredient' AND v.bar_id IS NOT NULL
   AND COALESCE(v.ingredient_role, 'prep') = 'prep';

UPDATE public.items v SET generic_id = r.catalog_id
  FROM link_row r
 WHERE v.id = r.id AND r.catalog_id IS NOT NULL
   AND v.generic_id IS DISTINCT FROM r.catalog_id
   AND (v.generic_id IS NULL OR EXISTS (
        SELECT 1 FROM public.items g
         WHERE g.id = v.generic_id AND g.bar_id IS NULL AND g.ingredient_role = 'generic'));

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;

DROP TABLE "flavor_jobs_before", "link_in", "link_row";
RESET "app.image_worker";
