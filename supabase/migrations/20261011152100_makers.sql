-- Maker pages (after 20261011152000 adds the kind). Step 1b of the bottle
-- catalog plan: https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
-- A maker is the house that makes something a bar buys and puts in or around
-- a drink, and puts its name on it: a distillery or brand house (Tanqueray,
-- Cocchi, Fee Brothers), a clear-ice company, a garnish maker, a glassware
-- or barware maker. Importers, distributors and retailers aren't makers.
--
--   * A maker's page is owned like a bar's: by a venue team (bar_id), made
--     and edited by members who can publish, and claimed the same way
--     (start_bar_claim, then a moderator or a strong email match). One page
--     per venue team, as for bars.
--   * profiles.makes      what it makes: bottles, ice, garnish, glassware,
--                         barware, equipment. Makers only.
--   * profiles.serves     the cities a maker delivers to ("New York",
--                         "London"): where bars can order from it, never an
--                         address.
--   * profiles.part_of_profile_id  the group a maker belongs to (Tanqueray is
--                         part of Diageo). Set by moderators only, so nobody
--                         claims a famous parent.
--   * items.maker_profile_id   who makes a bottle, or anything else bought
--                         and put in a drink (cherries, dehydrated wheels,
--                         pressed juice): those are catalog items too.
--   * item_maker_credits  who cut a drink's ice or made its glass ("ice by").
--                         Tools and equipment belong on prep recipes, later.
--                         Set by whoever can edit the drink; the maker's team
--                         confirms it (confirm_maker_credit) or takes it off,
--                         so a bar can't claim a supplier it doesn't use. A
--                         bar that cuts its own ice credits its own page, and
--                         that credit is confirmed as it's made.
--   * A maker page holds no street address or coordinates (like a person's),
--     so it can never be a pin on the map, and the map, Discover, near-me and
--     top-drinks queries keep reading bars only.

-- --- Who owns a page ---

ALTER TABLE "public"."profiles" DROP CONSTRAINT "profiles_owner_matches_kind";
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_owner_matches_kind" CHECK (
    ("kind" = 'person' AND "bar_id" IS NULL) OR ("kind" IN ('bar', 'maker') AND "user_id" IS NULL)
);

CREATE OR REPLACE FUNCTION "private"."set_profile_visibility"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.is_public := COALESCE(NEW.is_public, NEW.kind IN ('bar', 'maker'));
    RETURN NEW;
END;
$$;

DROP POLICY "profiles_insert" ON "public"."profiles";
CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT TO "authenticated"
    WITH CHECK (
        ("kind" = 'person' AND "user_id" = (SELECT "auth"."uid"()))
        OR ("kind" IN ('bar', 'maker') AND "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
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
        OR ("kind" IN ('bar', 'maker') AND "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
        OR "private"."is_app_admin"()
    );

-- --- What a maker makes, where it delivers, and its group ---

-- Each city a plain name, 1 to 80 characters.
CREATE FUNCTION "private"."city_names_ok"("p_names" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
    SELECT coalesce(bool_and(n IS NOT NULL AND char_length(btrim(n)) BETWEEN 1 AND 80 AND n = btrim(n)), true)
      FROM unnest(p_names) AS n;
$$;

ALTER TABLE "public"."profiles"
    ADD COLUMN "makes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    ADD COLUMN "serves" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    ADD COLUMN "part_of_profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "profiles_makes_known" CHECK (
        "makes" <@ ARRAY['bottles', 'ice', 'garnish', 'glassware', 'barware', 'equipment']::"text"[]
        AND ("kind" = 'maker' OR cardinality("makes") = 0)
    ),
    ADD CONSTRAINT "profiles_serves_cities" CHECK (
        ("kind" = 'maker' OR cardinality("serves") = 0)
        AND cardinality("serves") <= 100
        AND private.city_names_ok("serves")
    ),
    ADD CONSTRAINT "profiles_part_of_not_self" CHECK ("part_of_profile_id" IS NULL OR "part_of_profile_id" <> "id");

COMMENT ON COLUMN "public"."profiles"."makes" IS
    'A maker''s: what it makes (bottles, ice, garnish, glassware, barware, equipment). Empty for bars and people.';
COMMENT ON COLUMN "public"."profiles"."serves" IS
    'A maker''s: the cities it delivers to. Never an address.';
COMMENT ON COLUMN "public"."profiles"."part_of_profile_id" IS
    'A maker''s group (Tanqueray is part of Diageo). Set by moderators only.';

CREATE INDEX "profiles_part_of_idx" ON "public"."profiles" ("part_of_profile_id") WHERE "part_of_profile_id" IS NOT NULL;

-- Only makers belong to a group, the group is a maker, and only moderators
-- (or migrations) say so.
CREATE FUNCTION "private"."guard_profile_part_of"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.part_of_profile_id IS NOT DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.part_of_profile_id END) THEN
        RETURN NEW;
    END IF;
    IF auth.uid() IS NOT NULL AND NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only moderators say which group a maker belongs to.' USING ERRCODE = '42501';
    END IF;
    IF NEW.part_of_profile_id IS NOT NULL AND (
        NEW.kind <> 'maker'
        OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.part_of_profile_id AND kind = 'maker')
    ) THEN
        RAISE EXCEPTION 'Only a maker belongs to a group, and the group is a maker.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_profile_part_of"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_profile_part_of" BEFORE INSERT OR UPDATE OF "part_of_profile_id", "kind" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_profile_part_of"();

-- Signed-out visitors read profiles column by column (20261006120000).
GRANT SELECT ("makes", "serves", "part_of_profile_id") ON "public"."profiles" TO "anon";

-- --- Who makes a bottle ---

ALTER TABLE "public"."items"
    ADD COLUMN "maker_profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."items"."maker_profile_id" IS
    'Ingredients: the maker''s page for this bottle or product. brand_maker stays the name as printed.';

CREATE INDEX "items_maker_profile_id_idx" ON "public"."items" ("maker_profile_id") WHERE "maker_profile_id" IS NOT NULL;

CREATE FUNCTION "private"."guard_item_maker"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.maker_profile_id IS NULL THEN RETURN NEW; END IF;
    IF NEW.item_type <> 'ingredient' THEN
        RAISE EXCEPTION 'Only an ingredient has a maker. Credit a drink''s ice or glass instead.' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.maker_profile_id AND kind = 'maker') THEN
        RAISE EXCEPTION 'A bottle''s maker must be a maker''s page.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_item_maker"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_item_maker" BEFORE INSERT OR UPDATE OF "maker_profile_id", "item_type" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_maker"();

-- --- Who cut a drink's ice or made its glass ---

CREATE TABLE "public"."item_maker_credits" (
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "makes" "text" NOT NULL CHECK ("makes" IN ('ice', 'glassware')),
    -- When the maker's team said yes, it's ours. NULL until then.
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("item_id", "profile_id", "makes")
);

COMMENT ON TABLE "public"."item_maker_credits" IS
    'Who cut a drink''s ice or made its glass ("ice by"). Bottles and garnishes credit their maker through the ingredient.';

CREATE INDEX "item_maker_credits_profile_id_idx" ON "public"."item_maker_credits" ("profile_id");

CREATE FUNCTION "private"."guard_item_maker_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_item public.items;
    v_profile public.profiles;
BEGIN
    SELECT * INTO v_item FROM public.items WHERE id = NEW.item_id;
    IF v_item.id IS NULL OR v_item.item_type <> 'cocktail' THEN
        RAISE EXCEPTION 'Credit a maker on a drink.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.profile_id;
    -- The drink's own bar, cutting its own ice: confirmed as it's made.
    IF v_profile.kind = 'bar' AND NEW.makes = 'ice'
       AND (v_profile.bar_id = v_item.bar_id OR v_profile.id = v_item.origin_bar_profile_id) THEN
        NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
        RETURN NEW;
    END IF;
    IF v_profile.kind IS DISTINCT FROM 'maker' OR NOT (NEW.makes = ANY (v_profile.makes)) THEN
        RAISE EXCEPTION 'That maker''s page doesn''t say it makes %.', NEW.makes USING ERRCODE = 'check_violation';
    END IF;
    -- Anyone else's credit waits for the maker to confirm it.
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL AND NOT private.is_app_admin() THEN
        NEW.confirmed_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_item_maker_credit"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_item_maker_credit" BEFORE INSERT OR UPDATE ON "public"."item_maker_credits"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_maker_credit"();

ALTER TABLE "public"."item_maker_credits" ENABLE ROW LEVEL SECURITY;

-- Readable with the drink and the maker's page (their own RLS decides, so
-- signed in, like the drink itself). A maker's team also sees every credit
-- naming its page, so it can confirm or remove one on a drink it can't open
-- (the row only: the drink stays private).
CREATE POLICY "item_maker_credits_select" ON "public"."item_maker_credits" FOR SELECT TO "authenticated"
    USING (
        (
            EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id")
            AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "profile_id")
        )
        OR "profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    );
-- Whoever can edit the drink names its makers (same rule as co-creators).
CREATE POLICY "item_maker_credits_insert" ON "public"."item_maker_credits" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."is_app_admin"() OR "private"."can_edit_item"("item_id"));
-- A maker's team can take itself off.
CREATE POLICY "item_maker_credits_delete" ON "public"."item_maker_credits" FOR DELETE TO "authenticated"
    USING (
        "private"."is_app_admin"()
        OR "private"."can_edit_item"("item_id")
        OR "profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    );

-- The maker's team confirms a credit (no update policy: this is the only way).
CREATE FUNCTION "public"."confirm_maker_credit"("p_item_id" "uuid", "p_profile_id" "uuid", "p_makes" "text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_at timestamp with time zone;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = p_profile_id AND kind = 'maker' AND bar_id IN (SELECT private.bars_with_capability('publish'))
    ) THEN
        RAISE EXCEPTION 'Only the maker''s own team can confirm its credit.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.item_maker_credits SET confirmed_at = COALESCE(confirmed_at, now())
     WHERE item_id = p_item_id AND profile_id = p_profile_id AND makes = p_makes
    RETURNING confirmed_at INTO v_at;
    IF v_at IS NULL THEN
        RAISE EXCEPTION 'There''s no such credit to confirm.' USING ERRCODE = 'P0001';
    END IF;
    RETURN v_at;
END;
$$;
REVOKE EXECUTE ON FUNCTION "public"."confirm_maker_credit"("uuid", "uuid", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."confirm_maker_credit"("uuid", "uuid", "text") TO "authenticated", "service_role";

REVOKE ALL ON TABLE "public"."item_maker_credits" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."item_maker_credits" TO "authenticated";
GRANT INSERT, DELETE ON TABLE "public"."item_maker_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."item_maker_credits" TO "service_role";

-- --- Claiming a maker's page ---

-- 20261010130000's start_bar_claim, for a maker's page too. Bars keep their
-- wording word for word; a maker's says "maker". Nothing else changes.
CREATE OR REPLACE FUNCTION "public"."start_bar_claim"("p_profile_id" "uuid", "p_method" "public"."claim_method", "p_bar_id" "uuid" DEFAULT NULL, "p_note" "text" DEFAULT NULL) RETURNS "public"."profile_claims"
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

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id AND kind IN ('bar', 'maker');
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'There''s no bar page with that id.' USING ERRCODE = 'P0001';
    END IF;
    v_noun := CASE WHEN v_profile.kind = 'maker' THEN 'maker' ELSE 'bar' END;
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
    ELSIF p_method = 'instagram' AND v_instagram IS NULL THEN
        RAISE EXCEPTION 'This page has no Instagram to check. Pick another way.' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.profile_claims (profile_id, user_id, bar_id, message, method, code, evidence)
    VALUES (p_profile_id, v_user, p_bar_id, nullif(btrim(left(p_note, 1000)), ''), p_method,
            CASE WHEN p_method IN ('instagram', 'phone') THEN private.claim_code() END, v_evidence)
    RETURNING * INTO v_claim;

    IF (v_evidence ->> 'auto')::boolean THEN
        PERFORM private.hand_over_claim(v_claim.id, NULL);
        SELECT * INTO v_claim FROM public.profile_claims WHERE id = v_claim.id;
    END IF;
    RETURN v_claim;
END;
$$;
