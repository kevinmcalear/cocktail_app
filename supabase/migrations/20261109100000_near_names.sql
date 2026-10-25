-- Close names for "Did you mean", in every search (Kevin, 24 and 25 Oct 2026;
-- whole-app canvas, Search page, "Did you mean, in every search").
-- "salty boy" should find Salti Boi, "negorni" the Negroni, "peeny colada"
-- the Pina Colada.
--
--   * public.near_score(query, name): how close a name is to what was
--     typed, lower is closer, null when it isn't close. Both are folded as
--     Discover folds them (public.discover_fold, spaces collapsed). Every
--     typed word has to land on a word of the name: the same word (0), the
--     start of one (1, three letters or more), a letter off (2; two letters
--     at eight or more; a three-letter word keeps its first letter), or the
--     same sound (3, double metaphone). The score adds those up. Failing
--     that, the whole name a letter or two off for every four typed
--     (10 + the distance) catches swapped letters ("jungel bird").
--     lib/nearName.ts is the same rule for lists the app already holds;
--     supabase/tests/near-names.test.mjs runs both over every local drink
--     and fails on any difference.
--   * public.item_spellings: a spelling someone searched for and then said
--     "Yes, that's it" to, so the same search finds the drink straight away
--     next time. Only ever used to find the drink, never shown as its name.
--     Only a close spelling of a drink you can see can be saved
--     (public.save_spelling), and who saved it stays private.
--
-- fuzzystrmatch (levenshtein, dmetaphone) is already installed in the
-- extensions schema (20261104100000).
-- ponytail: near_score folds and splits on every call, about a quarter of a
-- second over all 14,000 local drinks, so searches call it on the rows they
-- already narrowed (an area, a bar, a picker's list). A stored folded name
-- with a trigram index is the upgrade if a search ever feels slow.

CREATE FUNCTION "public"."near_score"("p_query" "text", "p_name" "text")
    RETURNS integer
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  WITH f AS (
    SELECT btrim(regexp_replace(public.discover_fold(p_query), '\s+', ' ', 'g')) AS q,
           btrim(regexp_replace(public.discover_fold(p_name), '\s+', ' ', 'g')) AS n
  ),
  -- Each typed word's slips and sound, once rather than per word of the name.
  typed AS (
    SELECT w, CASE WHEN length(w) >= 8 THEN 2 ELSE 1 END AS slips,
           CASE WHEN length(w) BETWEEN 3 AND 64 THEN extensions.dmetaphone(w) ELSE '' END AS sound
    FROM f, regexp_split_to_table(f.q, '[^a-z0-9]+') w WHERE w <> ''
  ),
  named AS (
    SELECT w FROM f, regexp_split_to_table(f.n, '[^a-z0-9]+') w WHERE w <> ''
  ),
  words AS (
    SELECT t.w, (
      SELECT min(CASE
          WHEN nw.w = t.w THEN 0
          WHEN length(t.w) >= 3 AND left(nw.w, length(t.w)) = t.w THEN 1
          WHEN length(t.w) BETWEEN 3 AND 64 AND length(nw.w) <= 64
               AND (length(t.w) > 3 OR left(t.w, 1) = left(nw.w, 1))
               AND extensions.levenshtein_less_equal(t.w, nw.w, t.slips) <= t.slips THEN 2
          WHEN t.sound <> '' AND length(nw.w) <= 64 AND t.sound = extensions.dmetaphone(nw.w) THEN 3
        END)
      FROM named nw
    ) AS score
    FROM typed t
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM typed) THEN NULL
    WHEN NOT EXISTS (SELECT 1 FROM words WHERE score IS NULL) THEN (SELECT sum(score)::integer FROM words)
    WHEN length(f.q) <= 255 AND length(f.n) <= 255 THEN (
      SELECT 10 + x.d
      FROM (SELECT extensions.levenshtein_less_equal(f.q, f.n, greatest(1, length(f.q) / 4)) AS d) x
      WHERE x.d <= greatest(1, length(f.q) / 4)
    )
  END
  FROM f;
$$;

REVOKE ALL ON FUNCTION "public"."near_score"("text", "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."near_score"("text", "text") TO "anon", "authenticated", "service_role";

-- --- Saved spellings ---

CREATE TABLE "public"."item_spellings" (
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- Folded as near_score folds it.
    "spelling" "text" NOT NULL,
    "saved_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("item_id", "spelling"),
    CONSTRAINT "item_spellings_spelling_folded" CHECK (
        "spelling" = btrim(regexp_replace(public.discover_fold("spelling"), '\s+', ' ', 'g'))
        AND length("spelling") BETWEEN 1 AND 80
    )
);

COMMENT ON TABLE "public"."item_spellings" IS 'Another spelling of an item that someone searched for and confirmed ("Yes, that''s it"). Used only to find the item, never shown as its name.';

ALTER TABLE "public"."item_spellings" ENABLE ROW LEVEL SECURITY;

-- A spelling shows wherever its drink does: to anyone for a published drink,
-- and to whoever may select the item itself.
CREATE POLICY "item_spellings_select" ON "public"."item_spellings"
    FOR SELECT TO "anon", "authenticated"
    USING (
        EXISTS (SELECT 1 FROM "public"."published_items" p WHERE p."id" = "item_spellings"."item_id")
        OR EXISTS (SELECT 1 FROM "public"."items" i WHERE i."id" = "item_spellings"."item_id")
    );

CREATE INDEX "item_spellings_saved_by_idx" ON "public"."item_spellings" ("saved_by", "created_at");

-- How many spellings you saved in the last day. Definer: who saved a
-- spelling isn't readable, not even your own.
-- ponytail: its own 200 rather than a line in private.daily_limit, which
-- other open PRs also change; move it there once they land.
CREATE FUNCTION "private"."spelling_room"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT count(*) < 200 FROM public.item_spellings
  WHERE saved_by = (SELECT auth.uid()) AND created_at > now() - interval '1 day';
$$;

REVOKE ALL ON FUNCTION "private"."spelling_room"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."spelling_room"() TO "authenticated", "service_role";

-- Saved as yourself, for a drink you can see, only a close spelling of it,
-- and 200 a day at most.
CREATE POLICY "item_spellings_insert" ON "public"."item_spellings"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        "saved_by" = (SELECT "auth"."uid"())
        AND "private"."spelling_room"()
        AND EXISTS (
            SELECT 1 FROM "public"."items" i
            WHERE i."id" = "item_spellings"."item_id"
              AND public.near_score("item_spellings"."spelling", i."name") IS NOT NULL
        )
    );

-- Who saved a spelling is not for reading back.
REVOKE ALL ON TABLE "public"."item_spellings" FROM "anon", "authenticated";
GRANT SELECT ("item_id", "spelling") ON TABLE "public"."item_spellings" TO "anon", "authenticated";
GRANT INSERT ("item_id", "spelling") ON TABLE "public"."item_spellings" TO "authenticated";
GRANT ALL ON TABLE "public"."item_spellings" TO "service_role";

-- "Yes, that's it": keeps what was typed as another spelling of the item.
-- True when it is kept (now, or by someone before). False, and nothing kept,
-- when signed out, past the day's 200, when it is the item's own name, or
-- when it isn't close to the name of an item the caller can see.
CREATE FUNCTION "public"."save_spelling"("p_item_id" "uuid", "p_typed" "text")
    RETURNS boolean
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_spelling text := btrim(regexp_replace(public.discover_fold(p_typed), '\s+', ' ', 'g'));
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_spelling = '' OR length(v_spelling) > 80 OR NOT private.spelling_room() THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = p_item_id
      AND btrim(regexp_replace(public.discover_fold(i.name), '\s+', ' ', 'g')) <> v_spelling
      AND public.near_score(v_spelling, i.name) IS NOT NULL
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO public.item_spellings (item_id, spelling) VALUES (p_item_id, v_spelling)
  ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION "public"."save_spelling"("uuid", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_spelling"("uuid", "text") TO "authenticated", "service_role";
