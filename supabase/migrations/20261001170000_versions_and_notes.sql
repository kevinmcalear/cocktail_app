-- DRAFT. Local stack only until Kevin's OK.
--
-- Spec versions and team notes. Ethyl teams keep an old spec by copying the
-- drink ("Old Fashioned 2 Copy"); here every save through save_drink_spec
-- becomes a version with a snapshot, in the same transaction as the spec
-- rows, so history is never lost and never rewritten.
--
--   item_versions      one row per save: the snapshot (lines with names,
--                      method, glass, ice, notes, dilution, service style),
--                      an optional note, who and when. Read with the specs
--                      capability, since a snapshot holds the amounts. Only
--                      the RPCs write it.
--   item_comments      the team's thread on a drink at its venue, tied to the
--                      version it was written about. Members at Employee and
--                      up read and write; authors edit their own; Admin
--                      deletes. Never public. The content filter screens the
--                      text; reports.comment_id now points here.
--   save_drink_spec    replaces the drink's lines and method and writes the
--                      version. A drink with no versions yet gets its old
--                      state recorded as version 1 first.
--   restore_drink_version  puts an old snapshot back as a new version.

CREATE TABLE "public"."item_versions" (
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "version" integer NOT NULL CHECK ("version" > 0),
    "snapshot" "jsonb" NOT NULL,
    "note" "text" CHECK ("note" IS NULL OR char_length("note") <= 500),
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_by_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("item_id", "version")
);

CREATE TABLE "public"."item_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "version" integer,
    "author_id" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "author_name" "text",
    "body" "text" NOT NULL CHECK (char_length(btrim("body")) BETWEEN 1 AND 2000),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);
CREATE INDEX "item_comments_item_id_idx" ON "public"."item_comments" ("item_id", "created_at");

ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_comment_id_fkey"
    FOREIGN KEY ("comment_id") REFERENCES "public"."item_comments"("id") ON DELETE SET NULL;

ALTER TABLE "public"."item_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."item_comments" ENABLE ROW LEVEL SECURITY;

-- Can the caller see this drink's amounts? A venue drink: the specs
-- capability at its bar. A drink with no venue: whoever may edit it.
CREATE FUNCTION "private"."can_view_versions"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN i.bar_id IS NOT NULL THEN 'specs' = ANY (private.capabilities(i.bar_id))
      ELSE private.can_edit_item(i.id)
    END
    FROM public.items i WHERE i.id = p_item_id), false);
$$;

CREATE POLICY "item_versions_select" ON "public"."item_versions" FOR SELECT TO "authenticated"
    USING ("private"."can_view_versions"("item_id"));

CREATE POLICY "item_comments_select" ON "public"."item_comments" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('talking_points')));
CREATE POLICY "item_comments_insert" ON "public"."item_comments" FOR INSERT TO "authenticated"
    WITH CHECK (
        "author_id" = (SELECT "auth"."uid"())
        AND "bar_id" IN (SELECT "private"."bars_with_capability"('talking_points'))
        AND EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id" AND "i"."bar_id" = "item_comments"."bar_id")
    );
CREATE POLICY "item_comments_update" ON "public"."item_comments" FOR UPDATE TO "authenticated"
    USING ("author_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("author_id" = (SELECT "auth"."uid"()));
CREATE POLICY "item_comments_delete" ON "public"."item_comments" FOR DELETE TO "authenticated"
    USING ("author_id" = (SELECT "auth"."uid"()) OR "bar_id" IN (SELECT "private"."my_bar_ids"(40)));

-- The name to show for a member: what they signed up with, else the part of
-- their email before the @ (venue-only screens).
CREATE FUNCTION "private"."member_display_name"("p_user" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1))
  FROM auth.users u WHERE u.id = p_user;
$$;

CREATE FUNCTION "private"."item_comments_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM private.refuse_screened(NEW.body, 'note', 'body');
    IF TG_OP = 'INSERT' THEN
        NEW.author_name := private.member_display_name(NEW.author_id);
    ELSE
        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "item_comments_before_write" BEFORE INSERT OR UPDATE OF "body" ON "public"."item_comments"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_comments_before_write"();

-- The drink as it is now, for a version: every line with its ingredient's
-- name, the method names, glass, ice, notes, dilution and service style.
CREATE FUNCTION "private"."drink_snapshot"("p_item" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_build_object(
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ingredient_item_id', r.ingredient_item_id,
        'name', ing.name,
        'amount', r.amount,
        'unit', r.unit,
        'note', r.preparation_notes,
        'optional', COALESCE(r.is_optional, false),
        'at_service', r.at_service) ORDER BY r.sort_order, r.created_at)
      FROM public.recipes r LEFT JOIN public.items ing ON ing.id = r.ingredient_item_id
      WHERE r.recipe_item_id = p_item), '[]'::jsonb),
    'methods', COALESCE((
      SELECT jsonb_agg(m.name ORDER BY im.sort_order)
      FROM public.item_methods im JOIN public.items m ON m.id = im.method_item_id
      WHERE im.item_id = p_item), '[]'::jsonb),
    'method_ids', COALESCE((
      SELECT jsonb_agg(im.method_item_id ORDER BY im.sort_order)
      FROM public.item_methods im WHERE im.item_id = p_item), '[]'::jsonb),
    'glass', (SELECT g.name FROM public.items i JOIN public.items g ON g.id = i.glassware_id WHERE i.id = p_item),
    'ice', (SELECT ic.name FROM public.items i JOIN public.items ic ON ic.id = i.ice_id WHERE i.id = p_item),
    'notes', (SELECT i.notes FROM public.items i WHERE i.id = p_item),
    'dilution_pct', (SELECT i.dilution_pct FROM public.items i WHERE i.id = p_item),
    'service_style', (SELECT i.service_style FROM public.items i WHERE i.id = p_item));
$$;

-- Writes the next version unless nothing changed. Returns the version number now current.
CREATE FUNCTION "private"."write_drink_version"("p_item" "uuid", "p_note" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_snapshot jsonb := private.drink_snapshot(p_item);
    v_latest integer;
    v_same boolean;
BEGIN
    SELECT max(version) INTO v_latest FROM public.item_versions WHERE item_id = p_item;
    SELECT (snapshot = v_snapshot) INTO v_same FROM public.item_versions WHERE item_id = p_item AND version = v_latest;
    IF v_same THEN RETURN v_latest; END IF;
    INSERT INTO public.item_versions (item_id, version, snapshot, note, created_by, created_by_name)
    VALUES (p_item, COALESCE(v_latest, 0) + 1, v_snapshot, NULLIF(btrim(COALESCE(p_note, '')), ''), auth.uid(), private.member_display_name(auth.uid()));
    RETURN COALESCE(v_latest, 0) + 1;
END;
$$;

-- Replace the lines and method in one transaction and version the result.
-- p_lines: [{"id": "<existing row or null>", "ingredient_item_id": ..., "amount": 60,
--            "unit": "ml", "preparation_notes": null, "is_optional": false}] in order.
-- Kept rows keep their at_service decision (the Service section sets it).
CREATE FUNCTION "public"."save_drink_spec"("p_item" "uuid", "p_lines" "jsonb", "p_method_id" "uuid", "p_note" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_line jsonb;
    v_index integer := 0;
    v_kept uuid[] := '{}';
    v_id uuid;
    v_had_versions boolean;
BEGIN
    IF auth.uid() IS NULL OR NOT private.can_edit_item(p_item) THEN
        RAISE EXCEPTION 'You can''t edit this drink.' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_lines) <> 'array' THEN RAISE EXCEPTION 'Lines must be a list.'; END IF;

    -- The first save through here records how the drink was before it.
    SELECT EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = p_item) INTO v_had_versions;
    IF NOT v_had_versions THEN
        PERFORM private.write_drink_version(p_item, 'As it was before versions were kept');
    END IF;

    -- Positions are unique per drink, so move the old rows out of the way first.
    UPDATE public.recipes SET sort_order = sort_order + 100000 WHERE recipe_item_id = p_item;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        v_id := NULLIF(v_line ->> 'id', '')::uuid;
        IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.recipes WHERE id = v_id AND recipe_item_id = p_item) THEN
            UPDATE public.recipes
               SET ingredient_item_id = (v_line ->> 'ingredient_item_id')::uuid,
                   amount = NULLIF(v_line ->> 'amount', '')::numeric,
                   unit = NULLIF(v_line ->> 'unit', ''),
                   preparation_notes = NULLIF(v_line ->> 'preparation_notes', ''),
                   is_optional = COALESCE((v_line ->> 'is_optional')::boolean, false),
                   sort_order = v_index
             WHERE id = v_id;
        ELSE
            INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, sort_order)
            VALUES (p_item, (v_line ->> 'ingredient_item_id')::uuid, NULLIF(v_line ->> 'amount', '')::numeric, NULLIF(v_line ->> 'unit', ''),
                    NULLIF(v_line ->> 'preparation_notes', ''), COALESCE((v_line ->> 'is_optional')::boolean, false), v_index)
            RETURNING id INTO v_id;
        END IF;
        v_kept := v_kept || v_id;
        v_index := v_index + 1;
    END LOOP;
    DELETE FROM public.recipes WHERE recipe_item_id = p_item AND NOT (id = ANY (v_kept));

    DELETE FROM public.item_methods WHERE item_id = p_item;
    IF p_method_id IS NOT NULL THEN
        INSERT INTO public.item_methods (item_id, method_item_id, sort_order) VALUES (p_item, p_method_id, 0);
    END IF;

    RETURN private.write_drink_version(p_item, p_note);
END;
$$;

-- Put an old version's lines and method back, as a new version.
CREATE FUNCTION "public"."restore_drink_version"("p_item" "uuid", "p_version" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_snapshot jsonb;
    v_line jsonb;
    v_index integer := 0;
    v_method uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT private.can_edit_item(p_item) THEN
        RAISE EXCEPTION 'You can''t edit this drink.' USING ERRCODE = '42501';
    END IF;
    SELECT snapshot INTO v_snapshot FROM public.item_versions WHERE item_id = p_item AND version = p_version;
    IF v_snapshot IS NULL THEN RAISE EXCEPTION 'No version % of this drink.', p_version; END IF;

    DELETE FROM public.recipes WHERE recipe_item_id = p_item;
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_snapshot -> 'lines') LOOP
        INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, at_service, sort_order)
        VALUES (p_item, (v_line ->> 'ingredient_item_id')::uuid, NULLIF(v_line ->> 'amount', '')::numeric, NULLIF(v_line ->> 'unit', ''),
                NULLIF(v_line ->> 'note', ''), COALESCE((v_line ->> 'optional')::boolean, false), (v_line ->> 'at_service')::boolean, v_index);
        v_index := v_index + 1;
    END LOOP;
    DELETE FROM public.item_methods WHERE item_id = p_item;
    v_index := 0;
    FOR v_method IN SELECT (value #>> '{}')::uuid FROM jsonb_array_elements(COALESCE(v_snapshot -> 'method_ids', '[]'::jsonb)) LOOP
        INSERT INTO public.item_methods (item_id, method_item_id, sort_order) VALUES (p_item, v_method, v_index);
        v_index := v_index + 1;
    END LOOP;
    UPDATE public.items
       SET notes = v_snapshot ->> 'notes',
           dilution_pct = NULLIF(v_snapshot ->> 'dilution_pct', '')::numeric,
           service_style = NULLIF(v_snapshot ->> 'service_style', '')
     WHERE id = p_item;

    RETURN private.write_drink_version(p_item, 'Restored version ' || p_version);
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."can_view_versions"("uuid") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."member_display_name"("uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."drink_snapshot"("uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."write_drink_version"("uuid", "text") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "private"."can_view_versions"("uuid") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."save_drink_spec"("uuid", "jsonb", "uuid", "text") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."restore_drink_version"("uuid", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_drink_spec"("uuid", "jsonb", "uuid", "text") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."restore_drink_version"("uuid", integer) TO "authenticated", "service_role";
GRANT SELECT ON "public"."item_versions" TO "authenticated", "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."item_comments" TO "authenticated", "service_role";
GRANT ALL ON "public"."item_versions" TO "service_role";
