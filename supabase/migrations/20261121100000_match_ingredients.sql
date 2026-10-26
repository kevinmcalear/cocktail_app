-- Snap a bottle matches on the server (wave 3, Q9b).
--
-- A first snap used to download the whole shared ingredient list (~20,500
-- rows, ~2.7 MB) before it could say what the bottles were. Now the phone
-- sends what it read and match_ingredients() hands back a shortlist: the
-- catalog rows the phone's matcher (lib/match.ts) would land on for those
-- readings, with a score. The phone runs the same matcher on the shortlist,
-- so a bottle matches exactly as it did against the whole list.
--
--   public.match_fold(name)    lib/ingredientNames.ts ingredientKey(): lower
--                              case, accents off (NFD), no punctuation, "&"
--                              as "and". Wider than public.ingredient_key(),
--                              which only knows a list of accents.
--   public.match_key(name)     lib/match.ts matchKey(): the fold plus label
--                              spellings ("Nº Ten" is "no ten", "8 Years
--                              Old" is "8yo").
--   public.match_words(name)   the key's words without "the", "and", "de"...
--   indexes                    the key (same name) and its words (a brand
--                              on the label, a kind inside a name), for
--                              ingredients, shared and venues' own.
--   match_ingredients()        the shortlist, read as the caller: shared
--                              rows plus the venue's own when the caller
--                              works there, through RLS.
--
-- Names are already trigram-indexed for search (items_ingredient_name_trgm_idx,
-- 20261109200000). The matcher's rules are whole keys and whole words, so
-- this indexes those; pg_trgm scores the shortlist.

-- ---------------------------------------------------------------------------
-- The key, as the phone makes it
-- ---------------------------------------------------------------------------

-- No SET search_path on these three, so Postgres inlines them into the
-- indexes and queries (a SET costs a function call per row, ~20 us, which
-- was most of a match). They only call pg_catalog, which is searched first.
-- In public, executable by everyone (pure text functions): every role that
-- reads or writes items plans or computes these indexes, and inlining
-- parses the bodies as that role, which needs the schema (anon has no
-- private) and EXECUTE. Without them a signed-out drink page fails, or the
-- indexes go unused for whoever planned on items first.
CREATE FUNCTION "public"."match_fold"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT NULLIF(pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.replace(
        pg_catalog.translate(pg_catalog.regexp_replace(pg_catalog.normalize(pg_catalog.lower(COALESCE(p_name, '')), 'NFD'), '[̀-ͯ]', '', 'g'), 'øœæ''’‘`´', 'o'),
        '&', ' and '),
        '[^a-z0-9:]+', ' ', 'g')), '');
$$;

CREATE FUNCTION "public"."match_key"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT public.match_fold(pg_catalog.regexp_replace(pg_catalog.regexp_replace(COALESCE(p_name, ''),
        'n[º°]', 'no ', 'gi'),
        '(\d+)[\s-]*(years?|yrs?|yo)([\s-]*old)?', '\1yo', 'gi'));
$$;

CREATE FUNCTION "public"."match_words"("p_name" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT pg_catalog.string_to_array(pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(
        ' ' || COALESCE(public.match_key(p_name), '') || ' ',
        ' (the|and|de|di|del|la|le|of|aged)(?= )', ' ', 'g'),
        ' +', ' ', 'g')), ' ');
$$;

GRANT EXECUTE ON FUNCTION "public"."match_fold"("text") TO PUBLIC, "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."match_key"("text") TO PUBLIC, "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."match_words"("text") TO PUBLIC, "anon", "authenticated", "service_role";

CREATE INDEX "items_ingredient_match_key_idx" ON "public"."items" ("public"."match_key"("name"))
    WHERE "item_type" = 'ingredient';
CREATE INDEX "items_ingredient_match_words_idx" ON "public"."items" USING "gin" ("public"."match_words"("name"))
    WHERE "item_type" = 'ingredient';

-- ---------------------------------------------------------------------------
-- The shortlist
-- ---------------------------------------------------------------------------

-- Which rows the matcher would land on, by key and words alone: ids, how
-- many rows name each as their kind, a score, and the alias when the row is
-- another name's. Definer, so the expression indexes are used (RLS runs
-- before these functions, which aren't leakproof, and would check every
-- row); match_ingredients then reads only these rows as its caller. A
-- venue's own rows only for a venue the caller works at. One reading at a
-- time, so each lookup is planned as a plain index search on its words.
--
-- For each reading (lib/match.ts matchIngredient, in its order):
--   * the same key;
--   * an alias of the name;
--   * a brand's words: rows with one, at most one of their words not on
--     the label (and then only names of three words or more);
--   * kinds: rows whose words are all in the name, or all in the kind.
-- Then each one's kind (a pick's plain kind) and the venue's bottles of it
-- (whether the venue has it). The count of rows naming a row as their kind
-- stands in for the rest of the catalog: the phone tells a kind from a
-- bottle by it, and whether a kind stays one when a pick leaves some of
-- its bottles out (plainKind).
-- ponytail: the count is the definer's, so it includes rows the caller's
-- role can't see (a venue row above a bartender's level, someone's own
-- shared ingredient); the phone's whole catalog wouldn't count those. It
-- only decides ties and plain kinds. Counting through RLS is the upgrade.
CREATE FUNCTION "private"."match_candidates"("p_readings" "jsonb", "p_venue_id" "uuid")
    RETURNS TABLE("reading" integer, "id" "uuid", "kind_of" integer, "score" real, "alias" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
#variable_conflict use_column
DECLARE
    v_venue uuid := (SELECT b FROM private.my_bar_ids(0) b WHERE b = p_venue_id LIMIT 1);
    v_at integer;
    v_read jsonb;
    v_key text;
    v_fold text;
    v_name text[];
    v_brand text[];
    v_kind text[];
    v_label text[];
BEGIN
    FOR v_read, v_at IN
        SELECT t.x, (t.n - 1)::integer FROM jsonb_array_elements(p_readings) WITH ORDINALITY AS t(x, n)
        WHERE jsonb_typeof(t.x->'name') = 'string'
    LOOP
        v_key := public.match_key(v_read->>'name');
        CONTINUE WHEN v_key IS NULL;
        v_fold := public.match_fold(v_read->>'name');
        v_name := public.match_words(v_read->>'name');
        v_brand := public.match_words(v_read->>'brand');
        v_kind := public.match_words(v_read->>'kind');
        v_label := v_brand || v_name || v_kind;
        RETURN QUERY
        WITH hit AS (
            SELECT i.id FROM public.items i
            WHERE i.item_type = 'ingredient' AND public.match_key(i.name) = v_key
              AND (i.bar_id IS NULL OR i.bar_id = v_venue)
            UNION
            SELECT a.item_id FROM public.ingredient_aliases a WHERE a.key = v_fold
            UNION
            SELECT i.id FROM public.items i
            WHERE i.item_type = 'ingredient' AND public.match_words(i.name) && v_brand
              AND (i.bar_id IS NULL OR i.bar_id = v_venue)
              AND (SELECT count(*) FROM unnest(public.match_words(i.name)) w WHERE w <> ALL (v_label))
                  <= CASE WHEN cardinality(public.match_words(i.name)) >= 3 THEN 1 ELSE 0 END
            UNION
            SELECT i.id FROM public.items i
            WHERE i.item_type = 'ingredient' AND cardinality(v_name) > 0
              AND public.match_words(i.name) <@ v_name AND cardinality(public.match_words(i.name)) > 0
              AND (i.bar_id IS NULL OR i.bar_id = v_venue)
            UNION
            SELECT i.id FROM public.items i
            WHERE i.item_type = 'ingredient' AND cardinality(v_kind) > 0
              AND public.match_words(i.name) <@ v_kind AND cardinality(public.match_words(i.name)) > 0
              AND (i.bar_id IS NULL OR i.bar_id = v_venue)
        ),
        found AS (
            SELECT h.id FROM hit h
            UNION
            SELECT i.generic_id FROM hit h JOIN public.items i ON i.id = h.id WHERE i.generic_id IS NOT NULL
            UNION
            SELECT c.id FROM hit h JOIN public.items c ON c.generic_id = h.id
            WHERE c.bar_id = v_venue AND c.item_type = 'ingredient'
        )
        SELECT v_at, f.id,
               (SELECT count(*) FROM public.items c
                WHERE c.generic_id = f.id AND c.item_type = 'ingredient' AND (c.bar_id IS NULL OR c.bar_id = v_venue))::integer,
               extensions.similarity(public.match_key(i.name), v_key)::real,
               (SELECT a.key FROM public.ingredient_aliases a WHERE a.key = v_fold AND a.item_id = f.id)
        FROM found f JOIN public.items i ON i.id = f.id;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION "private"."match_candidates"("jsonb", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."match_candidates"("jsonb", "uuid") TO "authenticated";

-- What Snap a bottle's readings could be: [{ name, brand?, kind? }, ...] in
-- (at most 40), the catalog rows the phone's matcher lands on for them out
-- (lib/match.ts CatalogItem: id, name, kind, venue, and how many rows name
-- it as their kind), each with the reading it is for, how alike its name is
-- (0 to 1), best first, and the alias (an ingredient_aliases key) when the
-- reading's name is another name for it. Read as the caller, so RLS decides
-- what comes back: shared rows, and the venue's own for its staff.
CREATE FUNCTION "public"."match_ingredients"("p_readings" "jsonb", "p_venue_id" "uuid" DEFAULT NULL)
    RETURNS TABLE("reading" integer, "id" "uuid", "name" "text", "generic_id" "uuid", "bar_id" "uuid", "kind_of" integer, "score" real, "alias" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    IF jsonb_typeof(p_readings) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Readings must be a list.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF jsonb_array_length(p_readings) > 40 THEN
        RAISE EXCEPTION 'At most 40 readings at a time.' USING ERRCODE = 'program_limit_exceeded';
    END IF;
    IF length(p_readings::text) > 20000 THEN
        RAISE EXCEPTION 'Readings are too long.' USING ERRCODE = 'program_limit_exceeded';
    END IF;
    -- The rows by id (an index scan on a list), not a join the planner may
    -- turn into checking RLS on every ingredient.
    RETURN QUERY
    WITH c AS MATERIALIZED (SELECT * FROM private.match_candidates(p_readings, p_venue_id)),
    p AS (
        SELECT v.id, v.name, v.generic_id, v.bar_id FROM public.app_item_presentation v
        WHERE v.id = ANY (ARRAY(SELECT DISTINCT c.id FROM c))
          AND v.item_type = 'ingredient' AND (v.bar_id IS NULL OR v.bar_id = p_venue_id)
    )
    SELECT c.reading, p.id, p.name, p.generic_id, p.bar_id, c.kind_of, c.score, c.alias
    FROM c JOIN p ON p.id = c.id
    ORDER BY c.reading, c.score DESC, p.name, p.id;
END;
$$;

COMMENT ON FUNCTION "public"."match_ingredients"("jsonb", "uuid") IS
    'Snap a bottle: the catalog rows the app''s matcher lands on for these readings ([{name, brand?, kind?}]), shared and the venue''s own, scored by how alike the names are.';

REVOKE ALL ON FUNCTION "public"."match_ingredients"("jsonb", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."match_ingredients"("jsonb", "uuid") TO "authenticated";
