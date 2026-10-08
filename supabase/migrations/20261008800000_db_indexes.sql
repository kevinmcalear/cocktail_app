-- Ingredient lookups, bar-drink search and quieter job crons.
-- Local stack only until Kevin's OK.
--
--   * recipes had no index on ingredient_item_id or parent_ingredient_id, so
--     "which drinks use this ingredient" (ingredient pages, the abv fan-out
--     trigger, flavor jobs, ingredient merges, deleting an item) read every
--     recipe line. Production showed ~107k sequential scans of recipes.
--   * search_bar_drinks matched ingredients with an EXISTS over recipes for
--     every credited drink, and recipes_select runs the SECURITY DEFINER
--     can_edit_item() on every line it reads, so each search paid for
--     thousands of definer calls (1 to 2 s locally). Only a drink's editors can
--     read its lines, and for a shared drink that is its maker or an app admin,
--     so that is checked first and the EXISTS only runs for those drinks. Same
--     rows, same order.
--   * No trigram indexes: every "%term%" search in the app (search_bar_drinks,
--     the bar and people pickers' ILIKE) reads tables under RLS, and Postgres
--     won't use a non-leakproof operator like LIKE as an index condition ahead
--     of the policy, so the planner can't use them there (checked: a seq scan
--     as authenticated even with enable_seqscan off; the index only as owner).
--   * The item-image-jobs (every 15 s) and item-flavor-jobs (every 30 s) crons
--     took about a third of production's database time while their queues sat
--     empty. They now return at once when there is nothing to do. The image
--     queue still gets work (ingredient, beer and wine sketches, and photo
--     fingerprints for drinks), so its cron stays.

-- --- recipes ---

CREATE INDEX IF NOT EXISTS "recipes_ingredient_item_id_idx" ON "public"."recipes" ("ingredient_item_id");
CREATE INDEX IF NOT EXISTS "recipes_parent_ingredient_id_idx" ON "public"."recipes" ("parent_ingredient_id") WHERE "parent_ingredient_id" IS NOT NULL;

-- --- bar-drink search ---

-- As 20261007153000_menu_edition_dates.sql, with the editor check in front of
-- the ingredient match. recipes_select is can_edit_item(recipe_item_id), which
-- for a shared drink (bar_id IS NULL here) is can_write(NULL, created_by): its
-- maker or an app admin. For anyone else the EXISTS found no lines anyway.
CREATE OR REPLACE FUNCTION "public"."search_bar_drinks"("p_query" "text", "p_limit" integer DEFAULT 48)
RETURNS TABLE("item_id" "uuid", "credit" "text", "edition_id" "uuid", "edition_name" "text", "start_year" smallint, "start_month" smallint, "end_year" smallint, "end_month" smallint, "is_current" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    WITH q AS (
        SELECT lower(btrim(p_query)) AS text,
               replace(replace(replace(lower(btrim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') AS pat
    )
    SELECT i.id, coalesce(b.display_name, c.display_name),
           r.edition_id, r.edition_name, r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
    FROM public.items i
    CROSS JOIN q
    LEFT JOIN public.profiles b ON b.id = i.origin_bar_profile_id
    LEFT JOIN public.profiles c ON c.id = i.creator_profile_id
    LEFT JOIN public.menu_drink_runs r ON r.item_id = i.id
    WHERE i.item_type = 'cocktail'
      AND i.bar_id IS NULL
      AND i.moderated_at IS NULL
      -- Credited to a bar or bartender the reader can see (a hidden profile's
      -- drinks stay out, as on Discover).
      AND (b.id IS NOT NULL OR c.id IS NOT NULL)
      AND q.text <> ''
      AND (
          lower(i.name) LIKE '%' || q.pat || '%'
          OR lower(i.description) LIKE '%' || q.pat || '%'
          OR lower(b.display_name) LIKE '%' || q.pat || '%'
          OR lower(c.display_name) LIKE '%' || q.pat || '%'
          OR (
              -- Only the drink's editors can read its lines (see above).
              (coalesce(i.created_by = auth.uid(), false) OR (SELECT private.is_app_admin()))
              AND EXISTS (
                  SELECT 1 FROM public.recipes rc
                  JOIN public.items ing ON ing.id = rc.ingredient_item_id
                  WHERE rc.recipe_item_id = i.id AND lower(ing.name) LIKE '%' || q.pat || '%'
              )
          )
      )
    ORDER BY
        CASE WHEN r.is_current THEN 0 WHEN r.item_id IS NULL THEN 1 WHEN r.end_year IS NULL THEN 2 ELSE 3 END,
        lower(i.name) LIKE q.pat || '%' DESC,
        i.name, i.id
    LIMIT least(greatest(coalesce(p_limit, 48), 1), 100);
$$;

-- --- job crons ---

-- As 20260925200000_auto_item_images.sql, returning at once when no job is
-- waiting, ready or running (a queue of only failed jobs did nothing before
-- either).
CREATE OR REPLACE FUNCTION "private"."run_item_image_jobs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_job record;
    v_ready int;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM private.item_image_jobs WHERE status IN ('pending', 'ready', 'running')) THEN
        RETURN 0;
    END IF;

    -- A worker that died mid-job: hand the job back, or give up after 5 tries.
    UPDATE private.item_image_jobs
    SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'ready' END,
        lease_until = NULL,
        last_error = coalesce(last_error, 'The worker stopped before finishing.'),
        updated_at = now()
    WHERE status = 'running' AND lease_until < now();

    FOR v_job IN
        SELECT item_id FROM private.item_image_jobs
        WHERE status = 'pending' AND run_after <= now()
        ORDER BY run_after
        LIMIT 200
        FOR UPDATE SKIP LOCKED
    LOOP
        IF private.reconcile_item_images(v_job.item_id) THEN
            UPDATE private.item_image_jobs SET status = 'ready', updated_at = now() WHERE item_id = v_job.item_id;
        ELSE
            DELETE FROM private.item_image_jobs WHERE item_id = v_job.item_id;
        END IF;
    END LOOP;

    SELECT count(*) INTO v_ready FROM private.item_image_jobs WHERE status = 'ready';
    -- One worker at a time: it keeps claiming until the queue is empty.
    IF v_ready > 0 AND NOT EXISTS (
        SELECT 1 FROM private.item_image_jobs WHERE status = 'running' AND lease_until > now()
    ) THEN
        PERFORM private.wake_image_worker();
    END IF;
    RETURN v_ready;
END;
$$;

-- As 20260928300000_flavor_profiles.sql, returning at once when no job is
-- waiting or running.
CREATE OR REPLACE FUNCTION "private"."run_item_flavor_jobs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_due int;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM private.item_flavor_jobs WHERE status IN ('pending', 'running')) THEN
        RETURN 0;
    END IF;

    UPDATE private.item_flavor_jobs
    SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
        lease_until = NULL,
        last_error = coalesce(last_error, 'The worker stopped before finishing.'),
        updated_at = now()
    WHERE status = 'running' AND lease_until < now();

    SELECT count(*) INTO v_due FROM private.item_flavor_jobs WHERE status = 'pending' AND run_after <= now();
    IF v_due > 0 AND NOT EXISTS (
        SELECT 1 FROM private.item_flavor_jobs WHERE status = 'running' AND lease_until > now()
    ) THEN
        PERFORM private.wake_flavor_worker();
    END IF;
    RETURN v_due;
END;
$$;
