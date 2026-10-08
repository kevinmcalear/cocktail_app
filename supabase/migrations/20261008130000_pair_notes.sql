-- Why it works: one plain sentence for a strong pairing ("Agave syrup softens
-- the smoke and echoes the plant mezcal is made from"), in our own words.
--
-- The pair-notes edge function writes them: it takes the strongest pairs that
-- have none (next_pair_notes), asks the model once per batch with what we
-- already know (each side's taste from the flavor rules, how many drinks pair
-- them, a few of those drinks), checks each answer, and saves it
-- (save_pair_notes). Both are for the service role only. The model is off in
-- production until PAIR_NOTES_MODEL=live is set; locally it's mocked.
--
-- A note sits on the two core ingredients, stored once (a_id < b_id).
-- get_pair_note(a, b) reads it for any two ingredients, core or not.

CREATE TABLE "public"."ingredient_pair_notes" (
    "a_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "b_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "note" "text" NOT NULL CHECK (length("note") BETWEEN 10 AND 160),
    "source" "text" NOT NULL DEFAULT 'ai' CHECK ("source" IN ('ai', 'editor')),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("a_id", "b_id"),
    CHECK ("a_id" < "b_id")
);

ALTER TABLE "public"."ingredient_pair_notes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads pair notes" ON "public"."ingredient_pair_notes" FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "App admins edit pair notes" ON "public"."ingredient_pair_notes" FOR ALL TO "authenticated"
    USING ("private"."is_app_admin"()) WITH CHECK ("private"."is_app_admin"());
GRANT SELECT ON TABLE "public"."ingredient_pair_notes" TO "anon", "authenticated";
GRANT INSERT, UPDATE, DELETE ON TABLE "public"."ingredient_pair_notes" TO "authenticated";

-- The strongest pairs (bars today) without a note, with what the prompt needs.
CREATE FUNCTION "public"."next_pair_notes"("p_limit" integer DEFAULT 50)
    RETURNS TABLE ("a_id" "uuid", "b_id" "uuid", "a_name" "text", "b_name" "text", "together" integer, "drinks" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT p.a_id, p.b_id, a.name, b.name, p.together,
           ARRAY(SELECT d.name FROM public.get_pair_drinks(p.a_id, p.b_id, 3) d)
      FROM public.ingredient_pairs p
      JOIN public.items a ON a.id = p.a_id
      JOIN public.items b ON b.id = p.b_id
     WHERE p.era = 'now' AND p.a_id < p.b_id AND p.together >= 4 AND p.lift > 0
       AND NOT EXISTS (SELECT 1 FROM public.ingredient_pair_notes n WHERE n.a_id = p.a_id AND n.b_id = p.b_id)
     ORDER BY p.score DESC
     LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;
REVOKE EXECUTE ON FUNCTION "public"."next_pair_notes"(integer) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."next_pair_notes"(integer) TO "service_role";

-- Saves checked notes: [{"a_id", "b_id", "note"}]. An editor's note is never replaced.
CREATE FUNCTION "public"."save_pair_notes"("p_notes" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_count integer;
BEGIN
    INSERT INTO public.ingredient_pair_notes (a_id, b_id, note, source)
    SELECT LEAST(x.a_id, x.b_id), GREATEST(x.a_id, x.b_id), x.note, 'ai'
      FROM jsonb_to_recordset(p_notes) AS x(a_id uuid, b_id uuid, note text)
     WHERE x.a_id IS NOT NULL AND x.b_id IS NOT NULL AND x.a_id <> x.b_id AND length(x.note) BETWEEN 10 AND 160
    ON CONFLICT (a_id, b_id) DO UPDATE SET note = EXCLUDED.note, created_at = now()
        WHERE public.ingredient_pair_notes.source = 'ai';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION "public"."save_pair_notes"("jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."save_pair_notes"("jsonb") TO "service_role";

-- The note for two ingredients, each read as its core ingredient.
CREATE FUNCTION "public"."get_pair_note"("p_a" "uuid", "p_b" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    WITH m AS (SELECT * FROM private.core_ingredient_map()),
    ab AS (
        SELECT COALESCE((SELECT core_id FROM m WHERE m.id = p_a), p_a) AS a,
               COALESCE((SELECT core_id FROM m WHERE m.id = p_b), p_b) AS b
    )
    SELECT n.note FROM ab JOIN public.ingredient_pair_notes n ON n.a_id = LEAST(ab.a, ab.b) AND n.b_id = GREATEST(ab.a, ab.b);
$$;
REVOKE EXECUTE ON FUNCTION "public"."get_pair_note"("uuid", "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_pair_note"("uuid", "uuid") TO "anon", "authenticated";
