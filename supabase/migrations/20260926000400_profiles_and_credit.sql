-- DRAFT (schema proposal, docs/schema_proposal.md section 6). Local stack only.
--
-- Public profiles for people and bars, and lineage and credit on drinks.
--
--   profiles        one kind of profile for home bartenders, working
--                   bartenders and bars, with a handle. A profile with no
--                   user or bar is unclaimed: a historic creator (Sam Ross) or
--                   a venue that isn't on the platform (Milk & Honey).
--   profile_claims  a person or a bar asking to take over an unclaimed profile;
--                   a catalog admin approves it.
--   items           riff_of_id, creator_profile_id, origin_bar_profile_id,
--                   origin_year and credit_status (suggested, claimed,
--                   verified). Only catalog admins verify; only the creator or
--                   their bar can claim.
--
-- Profiles are the first rows signed-out visitors can read directly (public
-- ones only), for the public web pages.

CREATE TYPE "public"."profile_kind" AS ENUM ('person', 'bar');
CREATE TYPE "public"."credit_status" AS ENUM ('suggested', 'claimed', 'verified');
CREATE TYPE "public"."claim_status" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "kind" "public"."profile_kind" NOT NULL,
    -- @juniper.jo
    "handle" "text" NOT NULL UNIQUE CHECK ("handle" ~ '^[a-z0-9]([a-z0-9._]{1,28})[a-z0-9]$'),
    "display_name" "text" NOT NULL CHECK (char_length(btrim("display_name")) BETWEEN 1 AND 80),
    "bio" "text" CHECK (char_length("bio") <= 500),
    "avatar_url" "text",
    "website" "text",
    -- Who owns it. Neither set: unclaimed.
    "user_id" "uuid" UNIQUE REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- A deleted bar leaves its profile behind unclaimed, so credits survive.
    "bar_id" "uuid" UNIQUE REFERENCES "public"."bars"("id") ON DELETE SET NULL,
    -- Bars are public unless they say otherwise; people are private until
    -- they publish. Filled by set_profile_visibility() when left out.
    "is_public" boolean NOT NULL,
    -- Shown on profiles and rankings: "Brunswick".
    "locality" "text" CHECK (char_length("locality") <= 80),
    -- Bars only: where it is, for its public page and area rankings.
    "address_line" "text",
    "postcode" "text",
    "city" "text",
    "region" "text",
    "country_code" "text" CHECK ("country_code" ~ '^[A-Z]{2}$'),
    "latitude" double precision CHECK ("latitude" BETWEEN -90 AND 90),
    "longitude" double precision CHECK ("longitude" BETWEEN -180 AND 180),
    "claimed_at" timestamp with time zone,
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_owner_matches_kind" CHECK (
        ("kind" = 'person' AND "bar_id" IS NULL) OR ("kind" = 'bar' AND "user_id" IS NULL)
    ),
    -- A person's profile never holds an address.
    CONSTRAINT "profiles_person_has_no_address" CHECK (
        "kind" = 'bar'
        OR ("address_line" IS NULL AND "postcode" IS NULL AND "latitude" IS NULL AND "longitude" IS NULL)
    ),
    CONSTRAINT "profiles_coordinates_pair" CHECK (("latitude" IS NULL) = ("longitude" IS NULL))
);

CREATE INDEX "profiles_area_idx" ON "public"."profiles" ("country_code", lower("city"), "postcode") WHERE "kind" = 'bar';

CREATE TABLE "public"."profile_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- Set when claiming a venue profile on behalf of a bar.
    "bar_id" "uuid" REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    -- How to verify: "I'm Sam, here's my Instagram".
    "message" "text" CHECK (char_length("message") <= 1000),
    "status" "public"."claim_status" DEFAULT 'pending' NOT NULL,
    "reviewed_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE UNIQUE INDEX "profile_claims_one_pending_key" ON "public"."profile_claims" ("profile_id", "user_id") WHERE "status" = 'pending';
CREATE INDEX "profile_claims_user_id_idx" ON "public"."profile_claims" ("user_id");

-- A column default can't depend on kind, so a trigger fills is_public when
-- the insert leaves it out. An explicit value, true or false, is kept.
CREATE FUNCTION "private"."set_profile_visibility"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.is_public := COALESCE(NEW.is_public, NEW.kind = 'bar');
    RETURN NEW;
END;
$$;

CREATE TRIGGER "set_profile_visibility" BEFORE INSERT ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."set_profile_visibility"();

-- --- Lineage and credit on drinks ---

ALTER TABLE "public"."items"
    ADD COLUMN "riff_of_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    ADD COLUMN "creator_profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    ADD COLUMN "origin_bar_profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    ADD COLUMN "origin_year" smallint CHECK ("origin_year" BETWEEN 1600 AND 2100),
    ADD COLUMN "credit_status" "public"."credit_status",
    ADD CONSTRAINT "items_not_own_riff" CHECK ("riff_of_id" <> "id");

CREATE INDEX "items_riff_of_id_idx" ON "public"."items" ("riff_of_id");
CREATE INDEX "items_creator_profile_id_idx" ON "public"."items" ("creator_profile_id");
CREATE INDEX "items_origin_bar_profile_id_idx" ON "public"."items" ("origin_bar_profile_id");

-- Keeps credit honest whoever edits the drink:
--   * the creator is a person profile, the origin a bar profile;
--   * a credit starts as 'suggested';
--   * only catalog admins (or the service role) set 'verified', and changing a
--     verified credit's creator or bar drops it back to 'suggested';
--   * 'claimed' means the creator said so: the creator themselves, or a Drink
--     Creator at the origin bar.
CREATE FUNCTION "private"."guard_item_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_changed BOOLEAN;
    v_old_status public.credit_status;
BEGIN
    IF NEW.creator_profile_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.creator_profile_id AND kind = 'person') THEN
        RAISE EXCEPTION 'A drink''s creator must be a person''s profile.';
    END IF;
    IF NEW.origin_bar_profile_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.origin_bar_profile_id AND kind = 'bar') THEN
        RAISE EXCEPTION 'A drink''s origin must be a bar''s profile.';
    END IF;

    IF NEW.creator_profile_id IS NULL AND NEW.origin_bar_profile_id IS NULL THEN
        NEW.credit_status := NULL;
        RETURN NEW;
    END IF;
    NEW.credit_status := COALESCE(NEW.credit_status, 'suggested');

    -- Service role and SQL run without a user; catalog admins moderate.
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_changed := true;
    ELSE
        v_changed := NEW.creator_profile_id IS DISTINCT FROM OLD.creator_profile_id
                  OR NEW.origin_bar_profile_id IS DISTINCT FROM OLD.origin_bar_profile_id;
        v_old_status := OLD.credit_status;
    END IF;

    IF NEW.credit_status = 'verified' THEN
        IF v_old_status IS DISTINCT FROM 'verified' THEN
            RAISE EXCEPTION 'Only moderators can verify a credit.';
        ELSIF v_changed THEN
            NEW.credit_status := 'suggested';
        END IF;
    END IF;

    IF NEW.credit_status = 'claimed' AND (v_changed OR v_old_status IS DISTINCT FROM 'claimed') THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.creator_profile_id AND user_id = auth.uid())
           AND NOT EXISTS (
               SELECT 1 FROM public.profiles p
               WHERE p.id = NEW.origin_bar_profile_id AND p.bar_id IN (SELECT private.my_bar_ids(35))
           ) THEN
            RAISE EXCEPTION 'Only the creator or their bar can claim a credit.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_item_credit" BEFORE INSERT OR UPDATE OF "creator_profile_id", "origin_bar_profile_id", "credit_status" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_credit"();

-- --- Claims ---

-- Approves a claim: the profile becomes the claimant's (or their bar's), and
-- any other pending claims on it are turned down. Catalog admins only.
CREATE FUNCTION "public"."approve_profile_claim"("p_claim_id" "uuid") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_claim public.profile_claims;
    v_profile public.profiles;
BEGIN
    IF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only moderators can approve claims.';
    END IF;

    SELECT * INTO v_claim FROM public.profile_claims WHERE id = p_claim_id AND status = 'pending' FOR UPDATE;
    IF v_claim.id IS NULL THEN
        RAISE EXCEPTION 'No pending claim with that id.';
    END IF;

    UPDATE public.profiles
    SET user_id = CASE WHEN kind = 'person' THEN v_claim.user_id END,
        bar_id = CASE WHEN kind = 'bar' THEN v_claim.bar_id END,
        claimed_at = now()
    WHERE id = v_claim.profile_id AND user_id IS NULL AND bar_id IS NULL
    RETURNING * INTO v_profile;
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'That profile has already been claimed.';
    END IF;

    UPDATE public.profile_claims
    SET status = CASE WHEN id = p_claim_id THEN 'approved' ELSE 'rejected' END::public.claim_status,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    WHERE profile_id = v_claim.profile_id AND status = 'pending';

    RETURN v_profile;
END;
$$;

-- --- Policies ---

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profile_claims" ENABLE ROW LEVEL SECURITY;

-- Anyone, signed in or not, reads public profiles.
CREATE POLICY "profiles_select_public" ON "public"."profiles" FOR SELECT TO "anon", "authenticated"
    USING ("is_public");
-- Owners read their own while private; members read their bar's.
CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated"
    USING (
        "user_id" = (SELECT "auth"."uid"())
        OR "bar_id" IN (SELECT "private"."my_bar_ids"(0))
        OR "private"."is_app_admin"()
    );
-- A person makes their own profile; a bar's profile is made and edited by
-- members who can publish for it; unclaimed profiles are curated by catalog
-- admins.
CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT TO "authenticated"
    WITH CHECK (
        ("kind" = 'person' AND "user_id" = (SELECT "auth"."uid"()))
        OR ("kind" = 'bar' AND "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
        OR "private"."is_app_admin"()
    );
CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated"
    USING (
        "user_id" = (SELECT "auth"."uid"())
        OR "bar_id" IN (SELECT "private"."bars_with_capability"('publish'))
        OR "private"."is_app_admin"()
    )
    WITH CHECK (
        ("kind" = 'person' AND "user_id" = (SELECT "auth"."uid"()))
        OR ("kind" = 'bar' AND "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
        OR "private"."is_app_admin"()
    );
CREATE POLICY "profiles_delete" ON "public"."profiles" FOR DELETE TO "authenticated"
    USING (
        "user_id" = (SELECT "auth"."uid"())
        OR "bar_id" IN (SELECT "private"."bars_with_capability"('publish'))
        OR "private"."is_app_admin"()
    );

-- Claims: the claimant and catalog admins see them. A claim is on a visible,
-- unclaimed profile of the right kind; a bar claim needs 'publish' at that bar.
CREATE POLICY "profile_claims_select" ON "public"."profile_claims" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "private"."is_app_admin"());
CREATE POLICY "profile_claims_insert" ON "public"."profile_claims" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "status" = 'pending' AND "reviewed_by" IS NULL AND "reviewed_at" IS NULL
        AND EXISTS (
            SELECT 1 FROM "public"."profiles" "p"
            WHERE "p"."id" = "profile_id" AND "p"."user_id" IS NULL AND "p"."bar_id" IS NULL
              AND (("p"."kind" = 'person' AND "bar_id" IS NULL)
                   OR ("p"."kind" = 'bar' AND "bar_id" IN (SELECT "private"."bars_with_capability"('publish'))))
        )
    );
CREATE POLICY "profile_claims_delete_own_pending" ON "public"."profile_claims" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()) AND "status" = 'pending');
-- Approval goes through approve_profile_claim(); admins can reject directly.
CREATE POLICY "profile_claims_update_admin" ON "public"."profile_claims" FOR UPDATE TO "authenticated"
    USING ("private"."is_app_admin"())
    WITH CHECK ("private"."is_app_admin"() AND "status" <> 'approved');

REVOKE EXECUTE ON FUNCTION "private"."guard_item_credit"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."set_profile_visibility"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."approve_profile_claim"("p_claim_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."approve_profile_claim"("p_claim_id" "uuid") TO "authenticated", "service_role";
