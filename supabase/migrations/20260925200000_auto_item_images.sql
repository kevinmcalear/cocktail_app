-- Automatic item images ("never an empty frame").
--
-- Every cocktail, ingredient, beer and wine gets a hero picture without anyone
-- pressing Generate:
--   * item_images records each picture's angle, whether it is a generated
--     sketch, and the spec fingerprint it was drawn from (or, for a photo, the
--     spec it was last known to match);
--   * saving an item, or changing its glass, ice, method, ingredients or
--     garnish, queues a job in private.item_image_jobs;
--   * pg_cron runs private.run_item_image_jobs() every 15 seconds. Pure SQL
--     settles each job (flags photos whose spec changed, drops jobs with
--     nothing to draw) and, when a sketch is needed, wakes the image-worker
--     edge function with pg_net;
--   * the worker draws with the service role, billed to the item's venue quota,
--     and attaches the sketch with attach_generated_item_image().
--
-- Photos are never replaced or removed here. When the spec changes, a photo is
-- only marked outdated_since for an editor to confirm.

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

CREATE TYPE "public"."image_angle" AS ENUM ('hero', 'side', 'top', 'garnish', 'handoff');

-- Where a file came from. Only the service role creates generated images, so
-- the Sketch tag can't be forged onto a photo or stripped from a sketch.
ALTER TABLE "public"."images"
    ADD COLUMN "is_generated" boolean DEFAULT false NOT NULL,
    ADD COLUMN "spec_fingerprint" "text";

ALTER TABLE "public"."item_images"
    ADD COLUMN "angle" "public"."image_angle" DEFAULT 'hero' NOT NULL,
    -- Copied from images by a trigger; clients can't set it.
    ADD COLUMN "is_generated" boolean DEFAULT false NOT NULL,
    -- Sketch: the spec it was drawn from. Photo: the spec it was last known to
    -- match (stamped by the first image job after it was added).
    ADD COLUMN "spec_fingerprint" "text",
    -- Set when the spec has changed since spec_fingerprint. For a photo this is
    -- "may be out of date"; an editor clears it with confirm_item_photos().
    ADD COLUMN "outdated_since" timestamp with time zone,
    ADD COLUMN "created_at" timestamp with time zone DEFAULT "now"() NOT NULL;

CREATE INDEX "item_images_item_id_angle_idx" ON "public"."item_images" ("item_id", "angle");

DROP POLICY "images_insert" ON "public"."images";
CREATE POLICY "images_insert" ON "public"."images" FOR INSERT TO "authenticated"
    WITH CHECK (NOT "is_generated" AND "spec_fingerprint" IS NULL);

-- Keeps item_images honest whoever writes it, including app versions that
-- re-link every photo on save: is_generated and a sketch's fingerprint always
-- come from the images row.
CREATE FUNCTION "private"."item_images_derive"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_generated boolean;
    v_fingerprint text;
BEGIN
    SELECT i.is_generated, i.spec_fingerprint INTO v_generated, v_fingerprint
    FROM public.images i WHERE i.id = NEW.image_id;

    NEW.is_generated := coalesce(v_generated, false);
    IF NEW.is_generated THEN
        NEW.spec_fingerprint := v_fingerprint;
    ELSIF TG_OP = 'INSERT' THEN
        -- The next image job stamps a new photo against the spec once the
        -- whole save has landed (the app writes recipes after images).
        NEW.spec_fingerprint := NULL;
        NEW.outdated_since := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "item_images_derive" BEFORE INSERT OR UPDATE ON "public"."item_images"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_images_derive"();

-- ---------------------------------------------------------------------------
-- Spec fingerprint
-- ---------------------------------------------------------------------------

-- Item types that get an automatic hero sketch. Glassware, methods, ice and
-- families use icons.
CREATE FUNCTION "private"."gets_auto_image"("p_type" "public"."entity_type") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p_type IN ('cocktail', 'ingredient', 'beer', 'wine');
$$;

-- A hash of what a sketch of the item shows. Cocktails: glass, ice, methods and
-- each ingredient with its unit when the unit is a garnish or count (twist vs
-- wheel), but not amounts or the name, so a rename or a 22.5 to 25 ml tweak
-- doesn't redraw. Beer, wine and ingredients are drawn from their name, maker
-- or origin, and sub-ingredients. NULL for items that don't get sketches.
CREATE FUNCTION "private"."item_spec_fingerprint"("p_item_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT md5(jsonb_build_object(
    'v', 1,
    'type', i.item_type,
    'glass', i.glassware_id,
    'ice', i.ice_id,
    'name', CASE WHEN i.item_type <> 'cocktail' THEN lower(btrim(i.name)) END,
    'maker', CASE WHEN i.item_type = 'beer' THEN lower(btrim(i.brand_maker)) END,
    'origin', CASE WHEN i.item_type = 'wine' THEN lower(btrim(i.origin)) END,
    'methods', (
      SELECT jsonb_agg(DISTINCT m.method_item_id)
      FROM public.item_methods m WHERE m.item_id = i.id
    ),
    'parts', (
      SELECT jsonb_agg(DISTINCT jsonb_build_array(
        r.ingredient_item_id,
        CASE WHEN r.unit IS NULL OR r.unit IN ('ml', 'cl', 'oz') THEN NULL ELSE r.unit END
      ))
      FROM public.recipes r
      WHERE r.recipe_item_id = i.id AND r.ingredient_item_id IS NOT NULL
    )
  )::text)
  FROM public.items i
  WHERE i.id = p_item_id AND private.gets_auto_image(i.item_type);
$$;

-- ---------------------------------------------------------------------------
-- Venue AI quota
-- ---------------------------------------------------------------------------

-- ai_usage rows are now billed to a user or to a venue.
ALTER TABLE "private"."ai_usage" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "private"."ai_usage"
    ADD COLUMN "bar_id" "uuid" REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "ai_usage_payer_check" CHECK ("user_id" IS NOT NULL OR "bar_id" IS NOT NULL);
CREATE INDEX "ai_usage_bar_id_created_at_idx" ON "private"."ai_usage" ("bar_id", "created_at" DESC)
    WHERE "bar_id" IS NOT NULL;

-- Records one automatic image for an item, billed to its venue, or to its
-- creator when it has no venue (personal items). Returns 'ok', 'limit' when
-- the payer has used today's allowance, or 'no_payer' for legacy catalog rows
-- with neither. Service role only.
CREATE FUNCTION "public"."consume_item_ai_quota"("p_item_id" "uuid", "p_fn" "text", "p_venue_daily_limit" integer, "p_user_daily_limit" integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar_id uuid;
    v_user_id uuid;
    v_count int;
BEGIN
    SELECT bar_id, created_by INTO v_bar_id, v_user_id FROM public.items WHERE id = p_item_id;

    IF v_bar_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(v_bar_id::text, 0));
        SELECT count(*) INTO v_count FROM private.ai_usage
        WHERE bar_id = v_bar_id AND created_at > now() - interval '24 hours';
        IF v_count >= p_venue_daily_limit THEN
            RETURN 'limit';
        END IF;
        INSERT INTO private.ai_usage (bar_id, fn) VALUES (v_bar_id, p_fn);
        RETURN 'ok';
    END IF;

    IF v_user_id IS NOT NULL THEN
        RETURN CASE WHEN public.consume_ai_quota(v_user_id, p_fn, p_user_daily_limit) THEN 'ok' ELSE 'limit' END;
    END IF;

    RETURN 'no_payer';
END;
$$;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

-- One row per item with image work outstanding. A table rather than a pgmq
-- queue because it coalesces: a save touches the item, then each recipe row,
-- and all of that must become one job that waits for the save to finish.
--   pending: waiting for run_after (debounce, retry backoff or quota reset)
--   ready:   settled in SQL and needs a sketch; waiting for the worker
--   running: claimed by a worker until lease_until
--   failed:  gave up after 5 attempts; any later edit re-queues it
CREATE TABLE "private"."item_image_jobs" (
    "item_id" "uuid" PRIMARY KEY,
    "status" "text" DEFAULT 'pending' NOT NULL
        CHECK ("status" IN ('pending', 'ready', 'running', 'failed')),
    -- Bumped by every edit, so a worker finishing an older revision knows to
    -- look again rather than drop the job.
    "revision" bigint DEFAULT 1 NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "run_after" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lease_until" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE INDEX "item_image_jobs_status_run_after_idx" ON "private"."item_image_jobs" ("status", "run_after");
ALTER TABLE "private"."item_image_jobs" ENABLE ROW LEVEL SECURITY;

-- Queues (or re-queues) an item, 20 seconds out so the rest of the save lands
-- first. No foreign key on purpose: this runs from cascades while an item is
-- being deleted, and a job for a missing item simply settles to nothing.
CREATE FUNCTION "private"."enqueue_item_image_job"("p_item_id" "uuid", "p_delay" interval DEFAULT '20 seconds') RETURNS void
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  INSERT INTO private.item_image_jobs AS j (item_id, run_after)
  SELECT p_item_id, now() + p_delay
  WHERE p_item_id IS NOT NULL
    -- The worker's own writes don't re-queue the item.
    AND current_setting('app.image_worker', true) IS DISTINCT FROM 'on'
    AND EXISTS (
      SELECT 1 FROM public.items i
      WHERE i.id = p_item_id AND private.gets_auto_image(i.item_type)
    )
  ON CONFLICT (item_id) DO UPDATE
    SET revision = j.revision + 1,
        run_after = excluded.run_after,
        status = CASE WHEN j.status = 'running' THEN 'running' ELSE 'pending' END,
        attempts = CASE WHEN j.status = 'failed' THEN 0 ELSE j.attempts END,
        updated_at = now();
$$;

CREATE FUNCTION "private"."queue_item_image_job"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_new uuid;
    v_old uuid;
BEGIN
    IF TG_TABLE_NAME = 'items' THEN
        v_new := NEW.id;
    ELSIF TG_TABLE_NAME = 'recipes' THEN
        IF TG_OP <> 'DELETE' THEN v_new := NEW.recipe_item_id; END IF;
        IF TG_OP <> 'INSERT' THEN v_old := OLD.recipe_item_id; END IF;
    ELSE
        -- item_methods and item_images
        IF TG_OP <> 'DELETE' THEN v_new := NEW.item_id; END IF;
        IF TG_OP <> 'INSERT' THEN v_old := OLD.item_id; END IF;
    END IF;

    PERFORM private.enqueue_item_image_job(v_new);
    IF v_old IS DISTINCT FROM v_new THEN
        PERFORM private.enqueue_item_image_job(v_old);
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "queue_item_image_job_insert" AFTER INSERT ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_image_job"();
CREATE TRIGGER "queue_item_image_job_update" AFTER UPDATE OF "glassware_id", "ice_id", "name", "brand_maker", "origin", "item_type" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_image_job"();
CREATE TRIGGER "queue_item_image_job" AFTER INSERT OR DELETE OR UPDATE OF "recipe_item_id", "ingredient_item_id", "unit" ON "public"."recipes"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_image_job"();
CREATE TRIGGER "queue_item_image_job" AFTER INSERT OR DELETE OR UPDATE OF "item_id", "method_item_id" ON "public"."item_methods"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_image_job"();
-- A new photo gets stamped against the spec; removing the last picture means
-- the frame needs a sketch again.
CREATE TRIGGER "queue_item_image_job" AFTER INSERT OR DELETE OR UPDATE OF "item_id", "image_id", "angle" ON "public"."item_images"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_image_job"();

-- Brings an item's pictures in line with its spec, in SQL only, and says
-- whether it still needs a hero sketch drawn:
--   * a photo added since the last run is stamped with the current spec;
--   * any picture whose spec no longer matches gets outdated_since (a photo is
--     never removed or replaced, only flagged), and loses it if the spec
--     changes back;
--   * a sketch is needed when there is no hero photo and no hero sketch drawn
--     from the current spec.
CREATE FUNCTION "private"."reconcile_item_images"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_fingerprint text := private.item_spec_fingerprint(p_item_id);
BEGIN
    IF v_fingerprint IS NULL THEN
        RETURN false;
    END IF;

    UPDATE public.item_images SET spec_fingerprint = v_fingerprint
    WHERE item_id = p_item_id AND NOT is_generated AND spec_fingerprint IS NULL;

    UPDATE public.item_images SET outdated_since = now()
    WHERE item_id = p_item_id AND spec_fingerprint <> v_fingerprint AND outdated_since IS NULL;

    UPDATE public.item_images SET outdated_since = NULL
    WHERE item_id = p_item_id AND spec_fingerprint = v_fingerprint AND outdated_since IS NOT NULL;

    RETURN NOT EXISTS (
        SELECT 1 FROM public.item_images
        WHERE item_id = p_item_id AND angle = 'hero'
          AND (NOT is_generated OR spec_fingerprint = v_fingerprint)
    );
END;
$$;

-- Pokes the image-worker edge function. Needs two Vault secrets; until they
-- exist, jobs still settle in SQL and sketches wait in 'ready'.
CREATE FUNCTION "private"."wake_image_worker"() RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_url text;
    v_secret text;
BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'image_worker_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'image_worker_secret';
    IF v_url IS NULL OR v_secret IS NULL THEN
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := v_url,
        body := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-image-worker-secret', v_secret),
        timeout_milliseconds := 5000
    );
END;
$$;

-- The cron tick. Returns how many jobs are waiting for the worker.
CREATE FUNCTION "private"."run_item_image_jobs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_job record;
    v_ready int;
BEGIN
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

-- ---------------------------------------------------------------------------
-- Worker RPCs (service role only)
-- ---------------------------------------------------------------------------

-- Takes the oldest ready job for three minutes, with the fingerprint the sketch
-- should be drawn from.
CREATE FUNCTION "public"."claim_item_image_job"() RETURNS TABLE("item_id" "uuid", "revision" bigint, "spec_fingerprint" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  UPDATE private.item_image_jobs j
  SET status = 'running', attempts = j.attempts + 1, lease_until = now() + interval '3 minutes', updated_at = now()
  WHERE j.item_id = (
    SELECT q.item_id FROM private.item_image_jobs q
    WHERE q.status = 'ready'
    ORDER BY q.run_after
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.item_id, j.revision, private.item_spec_fingerprint(j.item_id);
$$;

-- Hands a claimed job back without a sketch:
--   'failed'     retry with backoff (1, 4, 9, 16 min), then give up;
--   'over_quota' try again in an hour, without counting an attempt;
--   'no_payer'   drop it (legacy catalog rows with no venue or creator).
-- If the item was edited since the claim, the job simply runs again soon.
CREATE FUNCTION "public"."release_item_image_job"("p_item_id" "uuid", "p_revision" bigint, "p_outcome" "text", "p_error" "text" DEFAULT NULL) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF p_outcome NOT IN ('failed', 'over_quota', 'no_payer') THEN
        RAISE EXCEPTION 'Unknown outcome %', p_outcome;
    END IF;

    IF p_outcome = 'no_payer' THEN
        DELETE FROM private.item_image_jobs WHERE item_id = p_item_id AND revision = p_revision;
    END IF;

    UPDATE private.item_image_jobs SET
        status = CASE
            WHEN revision <> p_revision THEN 'pending'
            WHEN p_outcome = 'failed' AND attempts >= 5 THEN 'failed'
            ELSE 'pending'
        END,
        run_after = CASE
            WHEN revision <> p_revision THEN greatest(run_after, now())
            WHEN p_outcome = 'over_quota' THEN now() + interval '1 hour'
            ELSE now() + make_interval(mins => attempts * attempts)
        END,
        attempts = CASE
            WHEN revision <> p_revision THEN 0
            WHEN p_outcome = 'over_quota' THEN greatest(attempts - 1, 0)
            ELSE attempts
        END,
        lease_until = NULL,
        last_error = left(coalesce(p_error, p_outcome), 500),
        updated_at = now()
    WHERE item_id = p_item_id;
END;
$$;

-- Saves a generated sketch as the item's hero, after any photos, and unlinks
-- hero sketches drawn from an older spec. Used by the worker (with the job
-- revision it claimed, which completes the job) and by the Generate button
-- (no revision; the fingerprint defaults to the current spec).
CREATE FUNCTION "public"."attach_generated_item_image"("p_item_id" "uuid", "p_url" "text", "p_spec_fingerprint" "text" DEFAULT NULL, "p_job_revision" bigint DEFAULT NULL) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_fingerprint text := coalesce(p_spec_fingerprint, private.item_spec_fingerprint(p_item_id));
    v_image_id uuid;
BEGIN
    PERFORM set_config('app.image_worker', 'on', true);

    INSERT INTO public.images (url, is_generated, spec_fingerprint)
    VALUES (p_url, true, v_fingerprint)
    RETURNING id INTO v_image_id;

    DELETE FROM public.item_images
    WHERE item_id = p_item_id AND angle = 'hero' AND is_generated
      AND spec_fingerprint IS DISTINCT FROM v_fingerprint;

    INSERT INTO public.item_images (item_id, image_id, angle, sort_order)
    SELECT p_item_id, v_image_id, 'hero', coalesce(max(sort_order) + 1, 0)
    FROM public.item_images WHERE item_id = p_item_id;

    PERFORM set_config('app.image_worker', 'off', true);

    IF p_job_revision IS NOT NULL THEN
        DELETE FROM private.item_image_jobs WHERE item_id = p_item_id AND revision = p_job_revision;
        -- Edited while drawing: settle it again.
        UPDATE private.item_image_jobs
        SET status = 'pending', attempts = 0, lease_until = NULL, updated_at = now()
        WHERE item_id = p_item_id AND status = 'running';
    END IF;

    RETURN v_image_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- App RPCs
-- ---------------------------------------------------------------------------

-- An editor confirms the item's photos still show the drink as specified.
CREATE FUNCTION "public"."confirm_item_photos"("p_item_id" "uuid") RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT private.can_edit_item(p_item_id) THEN
        RAISE EXCEPTION 'You don''t have permission to change this item.';
    END IF;

    UPDATE public.item_images
    SET spec_fingerprint = private.item_spec_fingerprint(p_item_id), outdated_since = NULL
    WHERE item_id = p_item_id AND NOT is_generated;
END;
$$;

-- Queues every item that has no picture at all, optionally for one venue.
-- Not run by this migration: it spends each venue's AI quota, so it's run by
-- hand. Jobs past a venue's daily allowance wait and retry hourly.
CREATE FUNCTION "private"."enqueue_missing_item_images"("p_bar_id" "uuid" DEFAULT NULL) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_count int := 0;
    v_item uuid;
BEGIN
    FOR v_item IN
        SELECT i.id FROM public.items i
        WHERE private.gets_auto_image(i.item_type)
          AND (p_bar_id IS NULL OR i.bar_id = p_bar_id)
          AND NOT EXISTS (SELECT 1 FROM public.item_images ii WHERE ii.item_id = i.id)
    LOOP
        PERFORM private.enqueue_item_image_job(v_item, interval '0 seconds');
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Existing pictures
-- ---------------------------------------------------------------------------

-- Sketches drawn before this migration: the current generators save to
-- <kind>/<item id>/<timestamp>.png, and the February bulk run saved to
-- placeholders/ and <kind>_images/. Uploads always carry a random suffix.
-- They're taken to match their item's current spec, so nothing is redrawn
-- until the spec actually changes.
UPDATE "public"."images" i
SET "is_generated" = true,
    "spec_fingerprint" = (
        SELECT private.item_spec_fingerprint(ii."item_id")
        FROM "public"."item_images" ii WHERE ii."image_id" = i."id"
        ORDER BY ii."item_id" LIMIT 1
    )
WHERE substring(i."url" FROM '/object/public/drinks/(.*)$') ~ '^(cocktails|ingredients|beers|wines)/[0-9a-f-]{36}/[0-9]+\.png$'
   OR substring(i."url" FROM '/object/public/drinks/(.*)$') ~ '^(placeholders|ingredient_images|beer_images|wine_images)/';

-- item_images_derive copies both columns from images. Photos keep a NULL
-- fingerprint until their item's first job stamps it.
UPDATE "public"."item_images" ii
SET "is_generated" = true
FROM "public"."images" i
WHERE i."id" = ii."image_id" AND i."is_generated";

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION "private"."item_images_derive"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."gets_auto_image"("p_type" "public"."entity_type") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."item_spec_fingerprint"("p_item_id" "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."enqueue_item_image_job"("p_item_id" "uuid", "p_delay" interval) FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."queue_item_image_job"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."reconcile_item_images"("p_item_id" "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."wake_image_worker"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."run_item_image_jobs"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."enqueue_missing_item_images"("p_bar_id" "uuid") FROM PUBLIC, "anon", "authenticated";

REVOKE EXECUTE ON FUNCTION "public"."consume_item_ai_quota"("p_item_id" "uuid", "p_fn" "text", "p_venue_daily_limit" integer, "p_user_daily_limit" integer) FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."claim_item_image_job"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."release_item_image_job"("p_item_id" "uuid", "p_revision" bigint, "p_outcome" "text", "p_error" "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."attach_generated_item_image"("p_item_id" "uuid", "p_url" "text", "p_spec_fingerprint" "text", "p_job_revision" bigint) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."consume_item_ai_quota"("p_item_id" "uuid", "p_fn" "text", "p_venue_daily_limit" integer, "p_user_daily_limit" integer) TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."claim_item_image_job"() TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."release_item_image_job"("p_item_id" "uuid", "p_revision" bigint, "p_outcome" "text", "p_error" "text") TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."attach_generated_item_image"("p_item_id" "uuid", "p_url" "text", "p_spec_fingerprint" "text", "p_job_revision" bigint) TO "service_role";

REVOKE EXECUTE ON FUNCTION "public"."confirm_item_photos"("p_item_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."confirm_item_photos"("p_item_id" "uuid") TO "authenticated", "service_role";

-- ---------------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------------

SELECT cron.schedule('item-image-jobs', '15 seconds', 'SELECT private.run_item_image_jobs()');
-- The 15-second tick logs ~5,800 runs a day; keep three days of history.
SELECT cron.schedule('purge-cron-history', '17 3 * * *', $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '3 days'$$);
