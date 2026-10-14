-- Supplier pages (after 20261017530000 adds the kind). Step 5 of the bottle
-- catalog plan: https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
-- A supplier is who a venue buys from: a spirits distributor or importer, an
-- ice company, a produce and garnish wholesaler, a glassware supplier. It
-- isn't a maker (a distributor carries other houses' brands), though one
-- business can have both pages.
--
--   * A supplier's page is owned like a maker's: by a venue team (bar_id),
--     edited by members who can publish, claimed the same way. It holds no
--     street address or coordinates, so it's never a pin on the map.
--   * profiles.supplies   what it supplies: bottles, ice, produce, garnish,
--                         glassware, barware, equipment. Suppliers only.
--   * profiles.serves     the cities it delivers to, as for makers.
--   * supplier_lines      whose brands a supplier carries, and where: a
--                         maker's page and a region (AU, or a state such as
--                         AU-VIC), with the page that says so. Public, like
--                         the pages. The supplier's team adds and removes its
--                         lines; the maker's team can take a line off its page.
--   * suppliers.profile_id  a venue's own supplier (private to the venue, in
--                         20260926150300) can point at the supplier's page.

-- --- Who owns a page ---

ALTER TABLE "public"."profiles" DROP CONSTRAINT "profiles_owner_matches_kind";
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_owner_matches_kind" CHECK (
    ("kind" = 'person' AND "bar_id" IS NULL) OR ("kind" IN ('bar', 'maker', 'supplier') AND "user_id" IS NULL)
);

CREATE OR REPLACE FUNCTION "private"."set_profile_visibility"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.is_public := COALESCE(NEW.is_public, NEW.kind IN ('bar', 'maker', 'supplier'));
    RETURN NEW;
END;
$$;

DROP POLICY "profiles_insert" ON "public"."profiles";
CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT TO "authenticated"
    WITH CHECK (
        ("kind" = 'person' AND "user_id" = (SELECT "auth"."uid"()))
        OR ("kind" IN ('bar', 'maker', 'supplier') AND "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
        OR "private"."is_app_admin"()
    );
DROP POLICY "profiles_update" ON "public"."profiles";
CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated"
    USING (
        "user_id" = (SELECT "auth"."uid"())
        OR "bar_id" IN (SELECT "private"."bars_with_capability"('publish'))
        OR "private"."is_app_admin"()
    )
    WITH CHECK (
        ("kind" = 'person' AND "user_id" = (SELECT "auth"."uid"()))
        OR ("kind" IN ('bar', 'maker', 'supplier') AND "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
        OR "private"."is_app_admin"()
    );

-- --- What a supplier supplies, and where it delivers ---

ALTER TABLE "public"."profiles"
    ADD COLUMN "supplies" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    ADD CONSTRAINT "profiles_supplies_known" CHECK (
        "supplies" <@ ARRAY['bottles', 'ice', 'produce', 'garnish', 'glassware', 'barware', 'equipment']::"text"[]
        AND ("kind" = 'supplier' OR cardinality("supplies") = 0)
    );

ALTER TABLE "public"."profiles" DROP CONSTRAINT "profiles_serves_cities";
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_serves_cities" CHECK (
    ("kind" IN ('maker', 'supplier') OR cardinality("serves") = 0)
    AND cardinality("serves") <= 100
    AND private.city_names_ok("serves")
);

COMMENT ON COLUMN "public"."profiles"."supplies" IS
    'A supplier''s: what it supplies (bottles, ice, produce, garnish, glassware, barware, equipment). Empty for everyone else.';
COMMENT ON COLUMN "public"."profiles"."serves" IS
    'A maker''s or supplier''s: the cities it delivers to. Never an address.';

-- Signed-out visitors read profiles column by column (20261006120000).
GRANT SELECT ("supplies") ON "public"."profiles" TO "anon";

-- --- Whose brands a supplier carries, and where ---

-- A region: a country (ISO 3166-1, "AU") or one of its states (ISO 3166-2, "AU-VIC").
CREATE TABLE "public"."supplier_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "supplier_profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "maker_profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "region" "text" NOT NULL CHECK ("region" ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'),
    "source_url" "text" CHECK ("source_url" IS NULL OR ("source_url" ~ '^https?://\S+$' AND char_length("source_url") <= 2000)),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supplier_lines_one_per_region" UNIQUE ("supplier_profile_id", "maker_profile_id", "region")
);

COMMENT ON TABLE "public"."supplier_lines" IS
    'Whose brands a supplier carries, and where (a country or state), with the page that says so.';

CREATE INDEX "supplier_lines_maker_profile_id_idx" ON "public"."supplier_lines" ("maker_profile_id");

CREATE FUNCTION "private"."guard_supplier_line"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.supplier_profile_id AND kind = 'supplier') THEN
        RAISE EXCEPTION 'A line belongs to a supplier''s page.' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.maker_profile_id AND kind = 'maker') THEN
        RAISE EXCEPTION 'A supplier carries a maker''s brands: link a maker''s page.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_supplier_line"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_supplier_line" BEFORE INSERT OR UPDATE ON "public"."supplier_lines"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_supplier_line"();

ALTER TABLE "public"."supplier_lines" ENABLE ROW LEVEL SECURITY;

-- Readable with both pages (their own RLS decides: public pages, so signed
-- out too).
CREATE POLICY "supplier_lines_select" ON "public"."supplier_lines" FOR SELECT TO "anon", "authenticated"
    USING (
        EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "supplier_profile_id")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "maker_profile_id")
    );
-- The supplier's own team says what it carries.
CREATE POLICY "supplier_lines_insert" ON "public"."supplier_lines" FOR INSERT TO "authenticated"
    WITH CHECK (
        "private"."is_app_admin"()
        OR "supplier_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    );
-- Either team can take a line off: the supplier's, or the maker's (so a
-- supplier can't claim a brand it doesn't carry).
CREATE POLICY "supplier_lines_delete" ON "public"."supplier_lines" FOR DELETE TO "authenticated"
    USING (
        "private"."is_app_admin"()
        OR "supplier_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
        OR "maker_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    );

REVOKE ALL ON TABLE "public"."supplier_lines" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."supplier_lines" TO "anon", "authenticated";
GRANT INSERT, DELETE ON TABLE "public"."supplier_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_lines" TO "service_role";

-- --- A venue's own supplier, pointing at the supplier's page ---

ALTER TABLE "public"."suppliers"
    ADD COLUMN "profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."suppliers"."profile_id" IS
    'The supplier''s page, when it has one. The row stays the venue''s own (name, order notes).';

CREATE INDEX "suppliers_profile_id_idx" ON "public"."suppliers" ("profile_id") WHERE "profile_id" IS NOT NULL;

CREATE FUNCTION "private"."guard_venue_supplier_page"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.profile_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.profile_id AND kind = 'supplier') THEN
        RAISE EXCEPTION 'Link a supplier''s page.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_venue_supplier_page"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_supplier_page" BEFORE INSERT OR UPDATE OF "profile_id" ON "public"."suppliers"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_venue_supplier_page"();

-- --- Claiming a supplier's page ---

-- 20261014900000's start_bar_claim, for a supplier's page too. Bars and
-- makers keep their wording word for word; a supplier's says "supplier".
CREATE OR REPLACE FUNCTION "public"."start_bar_claim"("p_profile_id" "uuid", "p_method" "public"."claim_method", "p_bar_id" "uuid" DEFAULT NULL, "p_note" "text" DEFAULT NULL, "p_code" "text" DEFAULT NULL) RETURNS "public"."profile_claims"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user uuid := auth.uid();
    v_profile public.profiles;
    v_claim public.profile_claims;
    v_instagram text;
    v_evidence jsonb;
    v_noun text;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Sign in to claim a bar.' USING ERRCODE = '42501';
    END IF;
    IF p_method IS NULL OR p_method = 'note' THEN
        RAISE EXCEPTION 'Pick how we can check it''s your bar.' USING ERRCODE = '22023';
    END IF;
    IF p_code IS NOT NULL AND p_code !~ '^[0-9]{6}$' THEN
        RAISE EXCEPTION 'The code should be six digits.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id AND kind IN ('bar', 'maker', 'supplier');
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'There''s no bar page with that id.' USING ERRCODE = 'P0001';
    END IF;
    v_noun := CASE v_profile.kind WHEN 'maker' THEN 'maker' WHEN 'supplier' THEN 'supplier' ELSE 'bar' END;
    IF v_profile.user_id IS NOT NULL OR v_profile.bar_id IS NOT NULL THEN
        RAISE EXCEPTION 'This page has already been claimed.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profile_claims WHERE profile_id = p_profile_id AND user_id = v_user AND status = 'pending') THEN
        RAISE EXCEPTION 'You already have a claim waiting on this %.', v_noun USING ERRCODE = '23505';
    END IF;
    IF p_bar_id IS NOT NULL THEN
        IF p_bar_id NOT IN (SELECT private.my_bar_ids(40)) THEN
            RAISE EXCEPTION 'Only an Admin of that venue can link it to this page.' USING ERRCODE = '42501';
        END IF;
        IF EXISTS (SELECT 1 FROM public.profiles WHERE bar_id = p_bar_id) THEN
            RAISE EXCEPTION 'That venue already has a page of its own.' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    v_instagram := private.page_instagram(v_profile.instagram, v_profile.website, v_profile.social_links);
    v_evidence := jsonb_build_object('website', v_profile.website, 'instagram', v_instagram, 'is_closed', v_profile.is_closed);
    IF p_method = 'email' THEN
        v_evidence := v_evidence || private.claim_email_evidence(v_user, v_profile.website, v_profile.is_closed);
        IF NOT (v_evidence ->> 'matches')::boolean THEN
            RAISE EXCEPTION 'Your sign-in email isn''t at this %''s website domain. Pick another way.', v_noun USING ERRCODE = 'P0001';
        END IF;
    ELSIF p_method = 'instagram' THEN
        IF v_instagram IS NULL THEN
            RAISE EXCEPTION 'This page has no Instagram to check. Pick another way.' USING ERRCODE = 'P0001';
        END IF;
        -- The code comes in a message from the bar's account, not its bio.
        v_evidence := v_evidence || jsonb_build_object('instagram_dm', true);
    END IF;

    INSERT INTO public.profile_claims (profile_id, user_id, bar_id, message, method, code, evidence)
    VALUES (p_profile_id, v_user, p_bar_id, nullif(btrim(left(p_note, 1000)), ''), p_method,
            CASE WHEN p_method IN ('instagram', 'phone') THEN coalesce(p_code, private.claim_code()) END, v_evidence)
    RETURNING * INTO v_claim;

    IF (v_evidence ->> 'auto')::boolean THEN
        PERFORM private.hand_over_claim(v_claim.id, NULL);
        SELECT * INTO v_claim FROM public.profile_claims WHERE id = v_claim.id;
    END IF;
    RETURN v_claim;
END;
$$;
