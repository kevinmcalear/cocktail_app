-- Flavor profiles, your taste and match (consumer discovery, "For you").
--
--   item_flavors             one row per cocktail: nine taste dimensions from
--                            0 to 1, how much of the spec was understood
--                            (coverage), where it came from (rules or ai) and
--                            the spec fingerprint it was computed from.
--                            Readable wherever the drink is readable. Numbers
--                            only: never ingredient names, so a profile can't
--                            reveal a brand the reader's role can't see.
--   private.ingredient_flavors  the AI fill's answer for an ingredient the
--                            rules don't know (a house cordial), cached so each
--                            ingredient is asked about once. Server only.
--   private.item_flavor_jobs a queue like private.item_image_jobs: editing a
--                            spec queues the drink; pg_cron wakes the
--                            flavor-worker edge function with pg_net; the
--                            worker computes with the rules, asks the AI fill
--                            about unknown ingredients (billed to the drink's
--                            venue quota, refunded on failure) and saves.
--   user_prefs.taste_answers the cold-start quick answers, owner only.
--   get_my_taste()           your taste from the drinks you ranked, weighted by
--                            your score for each. Runs as the caller, takes no
--                            user id, so it can only ever return your own.
--
-- The rules live in supabase/functions/_shared/flavor.ts. The AI fill is off
-- in production until FLAVOR_MODEL=live is set on the function.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE "public"."item_flavors" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "sweet" real NOT NULL CHECK ("sweet" BETWEEN 0 AND 1),
    "sour" real NOT NULL CHECK ("sour" BETWEEN 0 AND 1),
    "bitter" real NOT NULL CHECK ("bitter" BETWEEN 0 AND 1),
    "strong" real NOT NULL CHECK ("strong" BETWEEN 0 AND 1),
    "herbal" real NOT NULL CHECK ("herbal" BETWEEN 0 AND 1),
    "fruity" real NOT NULL CHECK ("fruity" BETWEEN 0 AND 1),
    "smoky" real NOT NULL CHECK ("smoky" BETWEEN 0 AND 1),
    "spicy" real NOT NULL CHECK ("spicy" BETWEEN 0 AND 1),
    "creamy" real NOT NULL CHECK ("creamy" BETWEEN 0 AND 1),
    -- Share of the spec (by taste weight) the rules or the AI fill understood.
    "coverage" real NOT NULL CHECK ("coverage" BETWEEN 0 AND 1),
    -- 'ai' when any AI answer went into it.
    "source" "text" NOT NULL CHECK ("source" IN ('rules', 'ai')),
    "spec_fingerprint" "text" NOT NULL,
    "rules_version" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."item_flavors" ENABLE ROW LEVEL SECURITY;

-- Wherever the drink is readable: the subquery runs under the items policy.
CREATE POLICY "item_flavors_select" ON "public"."item_flavors" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id"));

-- Only the worker (service role) writes profiles.
REVOKE ALL ON "public"."item_flavors" FROM PUBLIC, "anon";
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "public"."item_flavors" FROM "authenticated";

CREATE TABLE "private"."ingredient_flavors" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- The name it was asked about; a renamed ingredient is asked again.
    "name" "text" NOT NULL,
    -- {"taste": {"sweet": 0.7, ...}, "abv": 0.2}, numbers only (checked by the worker).
    "flavor" "jsonb" NOT NULL CHECK (jsonb_typeof("flavor") = 'object'),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "private"."ingredient_flavors" ENABLE ROW LEVEL SECURITY;

-- One row per drink with flavor work outstanding, coalesced like the image
-- queue. pending: waiting for run_after; running: claimed until lease_until;
-- failed: gave up after 5 attempts (the rules profile still stands; any later
-- edit re-queues it). No foreign key: this runs from cascades while an item is
-- being deleted, and a job for a missing drink settles to nothing.
CREATE TABLE "private"."item_flavor_jobs" (
    "item_id" "uuid" PRIMARY KEY,
    "status" "text" DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending', 'running', 'failed')),
    "revision" bigint DEFAULT 1 NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "run_after" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lease_until" timestamp with time zone,
    "last_error" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE INDEX "item_flavor_jobs_status_run_after_idx" ON "private"."item_flavor_jobs" ("status", "run_after");
ALTER TABLE "private"."item_flavor_jobs" ENABLE ROW LEVEL SECURITY;

-- The cold-start answers: dimension -> 0..1, e.g. {"bitter": 0.8}.
CREATE FUNCTION "private"."valid_taste_answers"("p" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_typeof(p) = 'object'
    AND NOT jsonb_path_exists(p, '$.* ? (@.type() != "number" || @ < 0 || @ > 1)')
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p) k
      WHERE k NOT IN ('sweet', 'sour', 'bitter', 'strong', 'herbal', 'fruity', 'smoky', 'spicy', 'creamy')
    );
$$;

ALTER TABLE "public"."user_prefs"
    ADD COLUMN "taste_answers" "jsonb" CHECK ("taste_answers" IS NULL OR "private"."valid_taste_answers"("taste_answers"));

-- ---------------------------------------------------------------------------
-- Spec fingerprint and queue
-- ---------------------------------------------------------------------------

-- What a cocktail's profile is computed from: each line's ingredients (and
-- their names, which the rules read), amount and unit. NULL for anything that
-- isn't a cocktail.
CREATE FUNCTION "private"."item_flavor_fingerprint"("p_item_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT md5(jsonb_build_object(
    'v', 1,
    'parts', (
      SELECT jsonb_agg(jsonb_build_array(r.ingredient_item_id, r.parent_ingredient_id, r.amount, r.unit, s.name, g.name)
                       ORDER BY r.sort_order, r.id)
      FROM public.recipes r
      LEFT JOIN public.items s ON s.id = r.ingredient_item_id
      LEFT JOIN public.items g ON g.id = r.parent_ingredient_id
      WHERE r.recipe_item_id = i.id
    )
  )::text)
  FROM public.items i
  WHERE i.id = p_item_id AND i.item_type = 'cocktail';
$$;

-- Queues (or re-queues) a cocktail, 20 seconds out so the rest of the save
-- lands first.
CREATE FUNCTION "private"."enqueue_item_flavor_job"("p_item_id" "uuid", "p_delay" interval DEFAULT '20 seconds') RETURNS void
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  INSERT INTO private.item_flavor_jobs AS j (item_id, run_after)
  SELECT p_item_id, now() + p_delay
  WHERE p_item_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.items i WHERE i.id = p_item_id AND i.item_type = 'cocktail')
  ON CONFLICT (item_id) DO UPDATE
    SET revision = j.revision + 1,
        run_after = excluded.run_after,
        status = CASE WHEN j.status = 'running' THEN 'running' ELSE 'pending' END,
        attempts = CASE WHEN j.status = 'failed' THEN 0 ELSE j.attempts END,
        updated_at = now();
$$;

-- Every drink that uses an ingredient, when the ingredient's name or
-- categories change (the rules read both).
CREATE FUNCTION "private"."enqueue_flavor_jobs_using"("p_ingredient_id" "uuid") RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_item uuid;
BEGIN
    FOR v_item IN
        SELECT DISTINCT r.recipe_item_id FROM public.recipes r
        WHERE r.ingredient_item_id = p_ingredient_id OR r.parent_ingredient_id = p_ingredient_id
    LOOP
        PERFORM private.enqueue_item_flavor_job(v_item);
    END LOOP;
END;
$$;

CREATE FUNCTION "private"."queue_item_flavor_job"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'recipes' THEN
        IF TG_OP <> 'DELETE' THEN PERFORM private.enqueue_item_flavor_job(NEW.recipe_item_id); END IF;
        IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.recipe_item_id IS DISTINCT FROM NEW.recipe_item_id) THEN
            PERFORM private.enqueue_item_flavor_job(OLD.recipe_item_id);
        END IF;
    ELSIF TG_TABLE_NAME = 'items' THEN
        PERFORM private.enqueue_item_flavor_job(NEW.id);
        IF TG_OP = 'UPDATE' THEN PERFORM private.enqueue_flavor_jobs_using(NEW.id); END IF;
    ELSE
        -- item_categories
        IF TG_OP <> 'DELETE' THEN PERFORM private.enqueue_flavor_jobs_using(NEW.item_id); END IF;
        IF TG_OP <> 'INSERT' THEN PERFORM private.enqueue_flavor_jobs_using(OLD.item_id); END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "queue_item_flavor_job_insert" AFTER INSERT ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_flavor_job"();
CREATE TRIGGER "queue_item_flavor_job_update" AFTER UPDATE OF "name", "item_type" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_flavor_job"();
CREATE TRIGGER "queue_item_flavor_job" AFTER INSERT OR DELETE OR UPDATE OF "recipe_item_id", "ingredient_item_id", "parent_ingredient_id", "amount", "unit" ON "public"."recipes"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_flavor_job"();
CREATE TRIGGER "queue_item_flavor_job" AFTER INSERT OR DELETE OR UPDATE ON "public"."item_categories"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_flavor_job"();

-- Queues every cocktail, optionally for one venue: after the rules change
-- (RULES_VERSION) or once the AI fill is switched on. Rules cost nothing; with
-- FLAVOR_MODEL=live, drinks with unknown ingredients spend their venue's AI
-- quota once per new ingredient.
CREATE FUNCTION "private"."enqueue_item_flavors"("p_bar_id" "uuid" DEFAULT NULL) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_count int := 0;
    v_item uuid;
BEGIN
    FOR v_item IN
        SELECT i.id FROM public.items i
        WHERE i.item_type = 'cocktail' AND (p_bar_id IS NULL OR i.bar_id = p_bar_id)
    LOOP
        PERFORM private.enqueue_item_flavor_job(v_item, interval '0 seconds');
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

-- Pokes the flavor-worker edge function. Needs two Vault secrets; until they
-- exist, jobs wait.
CREATE FUNCTION "private"."wake_flavor_worker"() RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_url text;
    v_secret text;
BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'flavor_worker_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'flavor_worker_secret';
    IF v_url IS NULL OR v_secret IS NULL THEN
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := v_url,
        body := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-flavor-worker-secret', v_secret),
        timeout_milliseconds := 5000
    );
END;
$$;

-- The cron tick: hands back jobs from a worker that died, then wakes one
-- worker if anything is due. Returns how many jobs are due.
CREATE FUNCTION "private"."run_item_flavor_jobs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_due int;
BEGIN
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

-- ---------------------------------------------------------------------------
-- Worker RPCs (service role only)
-- ---------------------------------------------------------------------------

-- Takes the oldest due job for three minutes, with the fingerprint to compute from.
CREATE FUNCTION "public"."claim_item_flavor_job"() RETURNS TABLE("item_id" "uuid", "revision" bigint, "spec_fingerprint" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  UPDATE private.item_flavor_jobs j
  SET status = 'running', attempts = j.attempts + 1, lease_until = now() + interval '3 minutes', updated_at = now()
  WHERE j.item_id = (
    SELECT q.item_id FROM private.item_flavor_jobs q
    WHERE q.status = 'pending' AND q.run_after <= now()
    ORDER BY q.run_after
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.item_id, j.revision, private.item_flavor_fingerprint(j.item_id);
$$;

-- A cocktail's spec lines as the rules read them: names, the generic
-- ingredient, category names (with their parents), amounts, and any cached AI
-- answer for the ingredient under its current name. Raw names: this is for the
-- worker only and never reaches the app.
CREATE FUNCTION "public"."get_item_flavor_spec"("p_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', r.ingredient_item_id,
    'name', coalesce(s.name, g.name, ''),
    'genericName', g.name,
    'categories', (
      WITH RECURSIVE up AS (
        SELECT c.id, c.name, c.parent_id, 0 AS depth FROM public.item_categories ic
        JOIN public.categories c ON c.id = ic.category_id
        WHERE ic.item_id IN (r.ingredient_item_id, r.parent_ingredient_id)
        UNION
        SELECT p.id, p.name, p.parent_id, up.depth + 1 FROM up JOIN public.categories p ON p.id = up.parent_id
        WHERE up.depth < 4
      )
      SELECT coalesce(jsonb_agg(up.name ORDER BY up.depth, up.name), '[]'::jsonb) FROM up
    ),
    'amount', r.amount,
    'unit', r.unit,
    'ai', f.flavor
  ) ORDER BY r.sort_order, r.id), '[]'::jsonb)
  FROM public.items i
  JOIN public.recipes r ON r.recipe_item_id = i.id
  LEFT JOIN public.items s ON s.id = r.ingredient_item_id
  LEFT JOIN public.items g ON g.id = r.parent_ingredient_id
  LEFT JOIN private.ingredient_flavors f ON f.item_id = r.ingredient_item_id AND f.name = s.name
  WHERE i.id = p_item_id AND i.item_type = 'cocktail';
$$;

-- Saves a drink's profile, and the AI answers it used ([{"id", "name",
-- "flavor"}]). With the job revision the worker claimed, it also completes the
-- job; without one it's an interim save (the rules profile while the AI fill
-- runs). If the drink was edited while computing, the job runs again.
CREATE FUNCTION "public"."save_item_flavor"(
    "p_item_id" "uuid",
    "p_profile" "jsonb",
    "p_coverage" real,
    "p_source" "text",
    "p_spec_fingerprint" "text",
    "p_rules_version" integer,
    "p_ingredients" "jsonb" DEFAULT NULL,
    "p_job_revision" bigint DEFAULT NULL
) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    INSERT INTO private.ingredient_flavors (item_id, name, flavor)
    SELECT (x ->> 'id')::uuid, x ->> 'name', x -> 'flavor'
    FROM jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) x
    WHERE EXISTS (SELECT 1 FROM public.items i WHERE i.id = (x ->> 'id')::uuid)
    ON CONFLICT (item_id) DO UPDATE SET name = excluded.name, flavor = excluded.flavor, created_at = now();

    IF EXISTS (SELECT 1 FROM public.items WHERE id = p_item_id AND item_type = 'cocktail') THEN
        INSERT INTO public.item_flavors AS f (item_id, sweet, sour, bitter, strong, herbal, fruity, smoky, spicy, creamy,
                                             coverage, source, spec_fingerprint, rules_version, updated_at)
        VALUES (p_item_id,
                (p_profile ->> 'sweet')::real, (p_profile ->> 'sour')::real, (p_profile ->> 'bitter')::real,
                (p_profile ->> 'strong')::real, (p_profile ->> 'herbal')::real, (p_profile ->> 'fruity')::real,
                (p_profile ->> 'smoky')::real, (p_profile ->> 'spicy')::real, (p_profile ->> 'creamy')::real,
                p_coverage, p_source, p_spec_fingerprint, p_rules_version, now())
        ON CONFLICT (item_id) DO UPDATE SET
            sweet = excluded.sweet, sour = excluded.sour, bitter = excluded.bitter, strong = excluded.strong,
            herbal = excluded.herbal, fruity = excluded.fruity, smoky = excluded.smoky, spicy = excluded.spicy,
            creamy = excluded.creamy, coverage = excluded.coverage, source = excluded.source,
            spec_fingerprint = excluded.spec_fingerprint, rules_version = excluded.rules_version, updated_at = now();
    END IF;

    IF p_job_revision IS NOT NULL THEN
        DELETE FROM private.item_flavor_jobs WHERE item_id = p_item_id AND revision = p_job_revision;
        UPDATE private.item_flavor_jobs
        SET status = 'pending', attempts = 0, lease_until = NULL, run_after = greatest(run_after, now()), updated_at = now()
        WHERE item_id = p_item_id AND status = 'running';
    END IF;
END;
$$;

-- Hands a claimed job back without finishing it:
--   'failed'     retry with backoff (1, 4, 9, 16 min), then give up;
--   'over_quota' the venue's AI allowance is used up: try again in an hour,
--                without counting an attempt;
--   'gone'       nothing to compute (deleted, or no longer a cocktail).
CREATE FUNCTION "public"."release_item_flavor_job"("p_item_id" "uuid", "p_revision" bigint, "p_outcome" "text", "p_error" "text" DEFAULT NULL) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF p_outcome NOT IN ('failed', 'over_quota', 'gone') THEN
        RAISE EXCEPTION 'Unknown outcome %', p_outcome;
    END IF;

    IF p_outcome = 'gone' THEN
        DELETE FROM private.item_flavor_jobs WHERE item_id = p_item_id AND revision = p_revision;
    END IF;

    UPDATE private.item_flavor_jobs SET
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

-- ---------------------------------------------------------------------------
-- Your taste
-- ---------------------------------------------------------------------------

-- Your taste: each dimension averaged over the drinks you ranked (your best
-- score per drink), weighted by (score / 10)^2, so a 10 counts four times a 5
-- and a drink you didn't like barely counts. Only profiles that understood at
-- least half their spec, and only drinks you can still see. `drinks` is how
-- many went in. SECURITY INVOKER and no user argument: it can only read the
-- caller's own rankings.
CREATE FUNCTION "public"."get_my_taste"()
    RETURNS TABLE("sweet" real, "sour" real, "bitter" real, "strong" real, "herbal" real,
                  "fruity" real, "smoky" real, "spicy" real, "creamy" real, "drinks" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  WITH mine AS (
    SELECT s.item_id, max(s.score) AS score
    FROM public.rank_entry_scores s
    WHERE s.user_id = (SELECT auth.uid())
    GROUP BY s.item_id
  ), weighted AS (
    SELECT f.*, power(m.score / 10.0, 2) AS weight
    FROM mine m JOIN public.item_flavors f ON f.item_id = m.item_id
    WHERE f."coverage" >= 0.5
  )
  SELECT (sum(weight * sweet) / nullif(sum(weight), 0))::real, (sum(weight * sour) / nullif(sum(weight), 0))::real,
         (sum(weight * bitter) / nullif(sum(weight), 0))::real, (sum(weight * strong) / nullif(sum(weight), 0))::real,
         (sum(weight * herbal) / nullif(sum(weight), 0))::real, (sum(weight * fruity) / nullif(sum(weight), 0))::real,
         (sum(weight * smoky) / nullif(sum(weight), 0))::real, (sum(weight * spicy) / nullif(sum(weight), 0))::real,
         (sum(weight * creamy) / nullif(sum(weight), 0))::real, count(*)::integer
  FROM weighted;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION "private"."valid_taste_answers"("p" "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."valid_taste_answers"("p" "jsonb") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."item_flavor_fingerprint"("p_item_id" "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."enqueue_item_flavor_job"("p_item_id" "uuid", "p_delay" interval) FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."enqueue_flavor_jobs_using"("p_ingredient_id" "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."queue_item_flavor_job"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."enqueue_item_flavors"("p_bar_id" "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."wake_flavor_worker"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."run_item_flavor_jobs"() FROM PUBLIC, "anon", "authenticated";

REVOKE EXECUTE ON FUNCTION "public"."claim_item_flavor_job"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."get_item_flavor_spec"("p_item_id" "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."save_item_flavor"("p_item_id" "uuid", "p_profile" "jsonb", "p_coverage" real, "p_source" "text", "p_spec_fingerprint" "text", "p_rules_version" integer, "p_ingredients" "jsonb", "p_job_revision" bigint) FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."release_item_flavor_job"("p_item_id" "uuid", "p_revision" bigint, "p_outcome" "text", "p_error" "text") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."claim_item_flavor_job"() TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_item_flavor_spec"("p_item_id" "uuid") TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."save_item_flavor"("p_item_id" "uuid", "p_profile" "jsonb", "p_coverage" real, "p_source" "text", "p_spec_fingerprint" "text", "p_rules_version" integer, "p_ingredients" "jsonb", "p_job_revision" bigint) TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."release_item_flavor_job"("p_item_id" "uuid", "p_revision" bigint, "p_outcome" "text", "p_error" "text") TO "service_role";

REVOKE EXECUTE ON FUNCTION "public"."get_my_taste"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_my_taste"() TO "authenticated";

-- ---------------------------------------------------------------------------
-- Schedule and backfill
-- ---------------------------------------------------------------------------

SELECT cron.schedule('item-flavor-jobs', '30 seconds', 'SELECT private.run_item_flavor_jobs()');

-- Every existing cocktail gets a profile once the worker is reachable. Rules
-- only until FLAVOR_MODEL=live is set, so this spends nothing on its own.
SELECT private.enqueue_item_flavors();
