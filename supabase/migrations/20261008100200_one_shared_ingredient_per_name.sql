-- One of each ingredient, enforced: after the cleanup (20261008100100), a
-- shared ingredient's name key is unique. The guard in 20261008100000 already
-- explains a refusal in words; this index is the backstop for anything that
-- writes past it (SQL, the service role, a race between two saves).
--
-- Rows added between the cleanup's snapshot and this running fold in first,
-- into the core row, else the most used one.

SET "app.image_worker" = 'on';

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

RESET "app.image_worker";

CREATE UNIQUE INDEX "items_shared_ingredient_key" ON "public"."items" ("public"."ingredient_key"("name"))
    WHERE "item_type" = 'ingredient' AND "bar_id" IS NULL;
