-- Draw my glass (Venue tools board, x 3520 y 20300; Kevin's answers to Open
-- decisions d56 to d59, 25 Oct 2026): a venue, or someone at home, whose
-- glass isn't in the catalog photographs it, types its height or capacity,
-- and the app traces its outline the way the catalog's glasses were traced
-- (lib/glassTrace.ts, no AI). The drawing is saved on their own glass.
--
--   bar_glassware.outline       the traced glass, the same shape and check as
--   home_glassware.outline      glass_models.outline (20261113100000), so a
--                               venue's own glass is drawn exactly like a
--                               catalog one. A drink at the venue is drawn in
--                               its main glass's own outline before its
--                               model's (item_sketch_outline below).
--   .capacity_ml                what they typed when they gave the capacity
--                               instead of the height (the outline holds the
--                               height either way).
--   .photo_path                 d57 "keep it, venue only": the photo stays in
--                               the private glass-photos bucket so it can be
--                               traced again, under bar/<venue page id>/ or
--                               home/<user id>/. Its venue's staff (or its
--                               owner at home) and the Cocktail team see it,
--                               nobody else; Delete photo removes it.
--   glass_shares                d58: a venue or a home bar may share a traced
--                               glass with everyone. d56: it joins the
--                               catalog only after the Cocktail team (app
--                               admins) checks it (add_shared_glass); until
--                               then only its owners see it. Stop sharing
--                               takes it back while it's in review.
--   glass_models                d59: a glass that came from a venue's photo
--     .traced_by_profile_id     credits the venue's page ("traced by Little
--     .from_photo               Rye"); it cites no web page, so it may have
--                               no source_urls.

-- --- 1. A glass of their own, traced ---

-- The outline checks run as whoever saves the glass now (a CHECK runs as the
-- caller), not only the service role (20261113100000). Pure checks on the
-- value passed in: they read nothing.
GRANT EXECUTE ON FUNCTION "private"."valid_mm_pairs"("jsonb", integer, integer) TO "authenticated";
GRANT EXECUTE ON FUNCTION "private"."valid_glass_outline"("jsonb") TO "authenticated";

ALTER TABLE "public"."bar_glassware"
    ADD COLUMN "outline" "jsonb" CHECK ("outline" IS NULL OR "private"."valid_glass_outline"("outline")),
    ADD COLUMN "capacity_ml" numeric CHECK ("capacity_ml" IS NULL OR ("capacity_ml" > 0 AND "capacity_ml" < 5000)),
    ADD COLUMN "photo_path" "text",
    -- In the glass-photos bucket, spelled one way only, under the venue's page.
    ADD CONSTRAINT "bar_glassware_photo_path_own" CHECK (
        "photo_path" IS NULL OR "photo_path" ~ ('^bar/' || "profile_id"::"text" || '/[0-9A-Za-z_-]{1,64}\.jpg$')
    ),
    ADD CONSTRAINT "bar_glassware_capacity_when_traced" CHECK ("capacity_ml" IS NULL OR "outline" IS NOT NULL);

COMMENT ON COLUMN "public"."bar_glassware"."outline" IS
    'The venue''s own glass, traced from its photo (Draw my glass): mm down from the rim, as glass_models.outline. Its drinks are drawn in it.';
COMMENT ON COLUMN "public"."bar_glassware"."capacity_ml" IS
    'To the brim, when that is what the venue typed to size the traced glass; null when they typed its height.';
COMMENT ON COLUMN "public"."bar_glassware"."photo_path" IS
    'The photo it was traced from, in the private glass-photos bucket. Never shown in public.';

ALTER TABLE "public"."home_glassware"
    ADD COLUMN "outline" "jsonb" CHECK ("outline" IS NULL OR "private"."valid_glass_outline"("outline")),
    ADD COLUMN "capacity_ml" numeric CHECK ("capacity_ml" IS NULL OR ("capacity_ml" > 0 AND "capacity_ml" < 5000)),
    ADD COLUMN "photo_path" "text",
    ADD CONSTRAINT "home_glassware_photo_path_own" CHECK (
        "photo_path" IS NULL OR "photo_path" ~ ('^home/' || "user_id"::"text" || '/[0-9A-Za-z_-]{1,64}\.jpg$')
    ),
    ADD CONSTRAINT "home_glassware_capacity_when_traced" CHECK ("capacity_ml" IS NULL OR "outline" IS NOT NULL);

-- A venue's drink is drawn in its main glass of the type: the venue's own
-- tracing first, else the real glass it names. As 20261113100000 otherwise.
CREATE OR REPLACE FUNCTION "private"."item_sketch_outline"("p_item_id" "uuid", "p_glass" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN split_part(i.sketch_variant, '_', 1) = p_glass THEN NULL
    WHEN m.id IS NOT NULL THEN m.outline
    ELSE (SELECT coalesce(g.outline, bm.outline)
            FROM public.bar_glassware g
            LEFT JOIN public.glass_models bm ON bm.id = g.model_id AND bm.glass = p_glass
           WHERE g.profile_id = private.item_bar_profile(i.id) AND g.glass = p_glass AND g.is_default
           LIMIT 1)
  END - 'traced_from'
  FROM public.items i
  LEFT JOIN public.glass_models m ON m.id = i.glass_model_id AND m.glass = p_glass
  WHERE i.id = p_item_id;
$$;
-- (bar_glassware's refresh_sketch_variant trigger, 20261007100000, already
-- redraws the venue's drinks on any change to its glasses, the outline too.)

-- --- 2. The photos: private, the venue's or the owner's own ---

INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES ('glass-photos', 'glass-photos', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT ("id") DO NOTHING;

-- As 20261101300000, plus glass photos: 30 a day per person (a few retakes for each of a bar's glasses).
CREATE OR REPLACE FUNCTION "private"."daily_limit"("p_kind" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE p_kind
    WHEN 'invite_per_inviter' THEN 20
    WHEN 'invite_per_venue' THEN 50
    WHEN 'invite_email_per_invite' THEN 3
    WHEN 'invite_email_per_sender' THEN 30
    WHEN 'venue_create' THEN 3
    WHEN 'ai_project' THEN 2000
    WHEN 'ai_project_new_accounts' THEN 1000
    WHEN 'rank' THEN 300
    WHEN 'rank_comparison' THEN 3000
    WHEN 'drinks_upload' THEN 300
    WHEN 'avatars_upload' THEN 30
    WHEN 'feedback_upload' THEN 20
    WHEN 'glass-photos_upload' THEN 30
  END;
$$;

-- Whose a glass photo is, from its path: bar/<venue page id>/ is the venue's
-- (its staff see it; those who change its glassware add and remove it),
-- home/<user id>/ is that person's alone.
CREATE FUNCTION "private"."can_use_glass_photo"("p_name" "text", "p_write" boolean) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN (storage.foldername(p_name))[1] = 'home' THEN (storage.foldername(p_name))[2] = auth.uid()::text
    WHEN (storage.foldername(p_name))[1] <> 'bar'
      OR (storage.foldername(p_name))[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN false
    WHEN p_write THEN private.can_edit_bar_glassware(((storage.foldername(p_name))[2])::uuid)
    ELSE EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = ((storage.foldername(p_name))[2])::uuid AND p.kind = 'bar'
                    AND p.bar_id IN (SELECT private.my_bar_ids(0)))
  END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."can_use_glass_photo"("text", boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."can_use_glass_photo"("text", boolean) TO "authenticated", "service_role";

CREATE POLICY "glass_photos_insert" ON "storage"."objects" FOR INSERT TO "authenticated"
    WITH CHECK (
        "bucket_id" = 'glass-photos'
        AND "private"."can_use_glass_photo"("name", true)
        AND "private"."has_upload_room"('glass-photos')
    );

-- The venue's staff or the owner, and the Cocktail team, who check a shared glass against it.
CREATE POLICY "glass_photos_select" ON "storage"."objects" FOR SELECT TO "authenticated"
    USING (
        "bucket_id" = 'glass-photos'
        AND ("private"."can_use_glass_photo"("name", false) OR (SELECT "private"."is_app_admin"()))
    );

-- Delete photo, and a retake's old photo. No updates: a new photo is a new file.
CREATE POLICY "glass_photos_delete" ON "storage"."objects" FOR DELETE TO "authenticated"
    USING ("bucket_id" = 'glass-photos' AND "private"."can_use_glass_photo"("name", true));

-- --- 3. Sharing a traced glass with everyone ---

CREATE TABLE "public"."glass_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    -- The glass shared: a venue's or a home bar's, one or the other.
    "bar_glass_id" "uuid" UNIQUE REFERENCES "public"."bar_glassware"("id") ON DELETE CASCADE,
    "home_glass_id" "uuid" UNIQUE REFERENCES "public"."home_glassware"("id") ON DELETE CASCADE,
    "sent_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    -- In review until the Cocktail team adds it to the catalog (model_id) or declines it (note says why).
    "status" "text" DEFAULT 'in_review' NOT NULL CHECK ("status" IN ('in_review', 'added', 'declined')),
    "model_id" "uuid" REFERENCES "public"."glass_models"("id") ON DELETE SET NULL,
    "note" "text" CHECK ("note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 300),
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "glass_shares_one_glass" CHECK (num_nonnulls("bar_glass_id", "home_glass_id") = 1)
);

COMMENT ON TABLE "public"."glass_shares" IS
    'A venue''s or a home bar''s traced glass offered to the catalog (Draw my glass, d56/d58). The Cocktail team adds it (add_shared_glass) or declines it.';

CREATE INDEX "glass_shares_in_review_idx" ON "public"."glass_shares" ("created_at") WHERE "status" = 'in_review';
CREATE INDEX "glass_shares_model_id_idx" ON "public"."glass_shares" ("model_id") WHERE "model_id" IS NOT NULL;
CREATE INDEX "glass_shares_sent_by_idx" ON "public"."glass_shares" ("sent_by");

ALTER TABLE "public"."glass_shares" ENABLE ROW LEVEL SECURITY;

-- Whether the caller may share (p_write) or see a share of this glass: the
-- venue's glassware editors (its staff, to see), or the glass's owner at home.
CREATE FUNCTION "private"."can_use_glass_share"("p_bar_glass_id" "uuid", "p_home_glass_id" "uuid", "p_write" boolean) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN p_home_glass_id IS NOT NULL THEN EXISTS (SELECT 1 FROM public.home_glassware h WHERE h.id = p_home_glass_id AND h.user_id = auth.uid())
    WHEN p_write THEN EXISTS (SELECT 1 FROM public.bar_glassware g WHERE g.id = p_bar_glass_id AND private.can_edit_bar_glassware(g.profile_id))
    ELSE EXISTS (SELECT 1 FROM public.bar_glassware g JOIN public.profiles p ON p.id = g.profile_id
                  WHERE g.id = p_bar_glass_id AND p.bar_id IN (SELECT private.my_bar_ids(0)))
  END;
$$;

-- Only a traced glass can be shared: the catalog draws it from its outline.
CREATE FUNCTION "private"."is_traced_glass"("p_bar_glass_id" "uuid", "p_home_glass_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.bar_glassware WHERE id = p_bar_glass_id AND outline IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.home_glassware WHERE id = p_home_glass_id AND outline IS NOT NULL);
$$;

REVOKE EXECUTE ON FUNCTION "private"."can_use_glass_share"("uuid", "uuid", boolean) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."is_traced_glass"("uuid", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."can_use_glass_share"("uuid", "uuid", boolean) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."is_traced_glass"("uuid", "uuid") TO "authenticated", "service_role";

CREATE POLICY "glass_shares_select" ON "public"."glass_shares" FOR SELECT TO "authenticated"
    USING ("private"."can_use_glass_share"("bar_glass_id", "home_glass_id", false) OR (SELECT "private"."is_app_admin"()));

-- Sent in review, by the caller, for a traced glass of theirs.
CREATE POLICY "glass_shares_insert" ON "public"."glass_shares" FOR INSERT TO "authenticated"
    WITH CHECK (
        "status" = 'in_review' AND "model_id" IS NULL AND "note" IS NULL AND "reviewed_at" IS NULL
        AND "sent_by" = (SELECT "auth"."uid"())
        AND "private"."can_use_glass_share"("bar_glass_id", "home_glass_id", true)
        AND "private"."is_traced_glass"("bar_glass_id", "home_glass_id")
    );

-- Stop sharing, while it's still in review; a declined one goes when it's sent
-- again (a glass has one share). Once added, the catalog's glass stays.
CREATE POLICY "glass_shares_delete" ON "public"."glass_shares" FOR DELETE TO "authenticated"
    USING ("status" IN ('in_review', 'declined') AND "private"."can_use_glass_share"("bar_glass_id", "home_glass_id", true));

REVOKE ALL ON "public"."glass_shares" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, INSERT, DELETE ON "public"."glass_shares" TO "authenticated";
GRANT ALL ON "public"."glass_shares" TO "service_role";

-- The Cocktail team reads a home glass someone shared, to check it.
CREATE POLICY "home_glassware_shared_team" ON "public"."home_glassware" FOR SELECT TO "authenticated"
    USING ((SELECT "private"."is_app_admin"()) AND EXISTS (SELECT 1 FROM "public"."glass_shares" s WHERE s."home_glass_id" = "home_glassware"."id"));

-- --- 4. Into the catalog, credited ---

ALTER TABLE "public"."glass_models"
    ADD COLUMN "traced_by_profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    ADD COLUMN "from_photo" boolean DEFAULT false NOT NULL;

CREATE INDEX "glass_models_traced_by_profile_id_idx" ON "public"."glass_models" ("traced_by_profile_id") WHERE "traced_by_profile_id" IS NOT NULL;

COMMENT ON COLUMN "public"."glass_models"."traced_by_profile_id" IS
    'The venue whose photo it was traced from, credited on the glass (Draw my glass, d59). Null for a home bar''s and for the makers'' own.';
COMMENT ON COLUMN "public"."glass_models"."from_photo" IS
    'Traced from a venue''s or a home bar''s own photo and checked by the Cocktail team, not read from a web page: it may cite none.';

-- A glass from a photo cites no page; every other glass cites at least one.
ALTER TABLE "public"."glass_models" DROP CONSTRAINT "glass_models_source_urls_check";
ALTER TABLE "public"."glass_models" ADD CONSTRAINT "glass_models_source_urls_check" CHECK (
    cardinality("source_urls") <= 10 AND (cardinality("source_urls") >= 1 OR "from_photo")
    AND "private"."valid_source_urls"("source_urls")
);

-- The Cocktail team adds a shared glass to the catalog under a page that
-- makes glassware (a maker's, or a bar's own, 20261116200000), named and
-- sized as shared unless they correct it. Returns the new glass.
CREATE FUNCTION "public"."add_shared_glass"("p_share_id" "uuid", "p_maker_profile_id" "uuid", "p_name" "text" DEFAULT NULL, "p_capacity_ml" numeric DEFAULT NULL) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    s public.glass_shares;
    v_glass text;
    v_variant text;
    v_name text;
    v_series text;
    v_designer text;
    v_outline jsonb;
    v_capacity numeric;
    v_credit uuid;
    v_model uuid;
BEGIN
    IF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only the Cocktail team adds shared glasses.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    SELECT * INTO s FROM public.glass_shares WHERE id = p_share_id FOR UPDATE;
    IF s.id IS NULL OR s.status <> 'in_review' THEN
        RAISE EXCEPTION 'That glass isn''t waiting for review.' USING ERRCODE = 'check_violation';
    END IF;
    IF s.bar_glass_id IS NOT NULL THEN
        SELECT g.glass, g.variant, g.name, g.series, g.designer, g.outline, g.capacity_ml, g.profile_id
          INTO v_glass, v_variant, v_name, v_series, v_designer, v_outline, v_capacity, v_credit
          FROM public.bar_glassware g WHERE g.id = s.bar_glass_id;
    ELSE
        SELECT h.glass, h.variant, h.name, NULL, NULL, h.outline, h.capacity_ml, NULL
          INTO v_glass, v_variant, v_name, v_series, v_designer, v_outline, v_capacity, v_credit
          FROM public.home_glassware h WHERE h.id = s.home_glass_id;
    END IF;
    IF v_outline IS NULL THEN
        RAISE EXCEPTION 'That glass has no traced outline.' USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.glass_models (maker_profile_id, glass, variant, name, series, designer, capacity_ml, height_mm, rim_mm,
                                     outline, source_urls, from_photo, traced_by_profile_id)
    VALUES (p_maker_profile_id, v_glass, v_variant, coalesce(nullif(btrim(p_name), ''), v_name, initcap(v_glass)), v_series, v_designer,
            coalesce(p_capacity_ml, v_capacity), (v_outline ->> 'height_mm')::numeric, (v_outline ->> 'rim_mm')::numeric,
            v_outline - 'traced_from', '{}', true, v_credit)
    RETURNING id INTO v_model;
    UPDATE public.glass_shares SET status = 'added', model_id = v_model, reviewed_at = now() WHERE id = s.id;
    RETURN v_model;
END;
$$;

-- Not one for the catalog (a photo too rough, a glass already there): the note says why.
CREATE FUNCTION "public"."decline_shared_glass"("p_share_id" "uuid", "p_note" "text") RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only the Cocktail team reviews shared glasses.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    UPDATE public.glass_shares SET status = 'declined', note = nullif(btrim(p_note), ''), reviewed_at = now()
     WHERE id = p_share_id AND status = 'in_review';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'That glass isn''t waiting for review.' USING ERRCODE = 'check_violation';
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."add_shared_glass"("uuid", "uuid", "text", numeric) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."decline_shared_glass"("uuid", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."add_shared_glass"("uuid", "uuid", "text", numeric) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."decline_shared_glass"("uuid", "text") TO "authenticated", "service_role";
