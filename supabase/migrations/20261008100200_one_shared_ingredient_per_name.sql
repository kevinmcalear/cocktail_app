-- One of each ingredient, enforced: after the cleanup (20261008100100), a
-- shared ingredient's name key is unique. The guard in 20261008100000 already
-- explains a refusal in words; this index is the backstop for anything that
-- writes past it (SQL, the service role, a race between two saves).
--
-- Rows added between the cleanup's snapshot and this running fold in first,
-- into the core row, else the most used one.

SET "app.image_worker" = 'on';
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

DO $$
DECLARE
    r record;
    v_keep uuid;
    v_id uuid;
BEGIN
    FOR r IN
        SELECT public.ingredient_key(name) AS key FROM public.items
         WHERE item_type = 'ingredient' AND bar_id IS NULL AND public.ingredient_key(name) IS NOT NULL
         GROUP BY 1 HAVING count(*) > 1
    LOOP
        SELECT i.id INTO v_keep FROM public.items i
         WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND public.ingredient_key(i.name) = r.key
         ORDER BY i.is_core DESC,
                  (SELECT count(*) FROM public.recipes x WHERE x.ingredient_item_id = i.id) DESC,
                  i.created_at, i.id
         LIMIT 1;
        FOR v_id IN
            SELECT id FROM public.items
             WHERE item_type = 'ingredient' AND bar_id IS NULL AND public.ingredient_key(name) = r.key AND id <> v_keep
        LOOP
            PERFORM private.merge_ingredient(v_id, v_keep);
        END LOOP;
    END LOOP;
END;
$$;

-- No paid flavour jobs from these merges (see 20261008100100).
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;
DROP TABLE "flavor_jobs_before";
RESET "app.image_worker";

CREATE UNIQUE INDEX "items_shared_ingredient_key" ON "public"."items" ("public"."ingredient_key"("name"))
    WHERE "item_type" = 'ingredient' AND "bar_id" IS NULL;
