-- DRAFT. Local stack only. Not applied to production; needs Kevin's review first.
--
-- Who a person says they are on their public profile, in their own hands.
--
--   profiles.tagline               what they do with drinks, in their words
--                                  ("Home bartender"). Shown under the name.
--                                  Empty: nothing shows. Replaces the app's
--                                  old fixed "Bartender" on every person.
--   profiles.headline_position_id  or one of their own jobs instead, shown as
--                                  "Head bartender at Little Rye". The app
--                                  shows it only while the bar has confirmed
--                                  the job and it's public.
--   profiles.shows_photo           whether people see their account photo.
--                                  Off: their initials. A person's page is for
--                                  signed-in people only, so on means "people
--                                  on Cocktail". Their bar's team list still
--                                  shows it (get_bar_members, 20261009800000).
--
-- The account photo lives in the login account (Settings › Account uploads it
-- to the avatars bucket) and never reached profiles.avatar_url, so every
-- person page showed initials. A trigger now copies it across for a claimed
-- person, or clears it when shows_photo is off; refresh_my_profile_photo()
-- runs it after a new upload.
--
-- Jobs a person adds themselves now show on their own page before the bar
-- confirms them, marked as not confirmed (the app labels them). A bar's page
-- still lists only confirmed people (the app filters), and a bar can still
-- decline a job, which removes it.

ALTER TABLE "public"."profiles"
    ADD COLUMN "tagline" "text",
    ADD COLUMN "shows_photo" boolean DEFAULT true NOT NULL,
    ADD COLUMN "headline_position_id" "uuid" REFERENCES "public"."profile_positions"("id") ON DELETE SET NULL,
    -- Matches taglineProblem in lib/profiles.ts.
    ADD CONSTRAINT "profiles_tagline_shape" CHECK (
        "tagline" IS NULL
        OR ("kind" = 'person' AND char_length("tagline") BETWEEN 1 AND 40 AND "tagline" = btrim("tagline") AND "tagline" !~ '[[:cntrl:]]')
    ),
    ADD CONSTRAINT "profiles_headline_person" CHECK ("headline_position_id" IS NULL OR "kind" = 'person');

CREATE INDEX "profiles_headline_position_id_idx" ON "public"."profiles" ("headline_position_id");

-- Signed-out visitors read profiles by column (20260927000000); the profile
-- page selects these too.
GRANT SELECT ("tagline", "shows_photo", "headline_position_id") ON "public"."profiles" TO "anon";

-- --- Headline: only one of your own jobs ---

CREATE FUNCTION "private"."check_profile_headline"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.headline_position_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.profile_positions pp
        WHERE pp.id = NEW.headline_position_id AND pp.person_profile_id = NEW.id
    ) THEN
        RAISE EXCEPTION 'That job isn''t one of yours.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."check_profile_headline"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "check_profile_headline" BEFORE INSERT OR UPDATE OF "headline_position_id" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."check_profile_headline"();

-- --- Photo ---

-- The account photo, but only one in the person's own avatars folder (the
-- same rule as get_bar_members), never any picture on the web.
CREATE FUNCTION "private"."account_photo"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT au.raw_user_meta_data->>'avatar_url'
  FROM auth.users au
  WHERE au.id = p_user_id
    AND au.raw_user_meta_data->>'avatar_url' LIKE '%/storage/v1/object/public/avatars/' || p_user_id::text || '/%';
$$;

REVOKE EXECUTE ON FUNCTION "private"."account_photo"("uuid") FROM PUBLIC, "anon", "authenticated";

CREATE FUNCTION "private"."set_profile_photo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.kind = 'person' AND NEW.user_id IS NOT NULL THEN
        NEW.avatar_url := CASE WHEN NEW.shows_photo THEN COALESCE(private.account_photo(NEW.user_id), NEW.avatar_url) END;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."set_profile_photo"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "set_profile_photo" BEFORE INSERT OR UPDATE ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."set_profile_photo"();

-- After a new upload: copies the account photo onto your own profile (or
-- leaves it off, when you hide it). RLS keeps it to your own row.
CREATE FUNCTION "public"."refresh_my_profile_photo"() RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  UPDATE public.profiles SET shows_photo = shows_photo
  WHERE user_id = (SELECT auth.uid()) AND kind = 'person';
$$;

REVOKE EXECUTE ON FUNCTION "public"."refresh_my_profile_photo"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."refresh_my_profile_photo"() TO "authenticated", "service_role";

-- Everyone who already has an account photo gets it on their page.
UPDATE "public"."profiles" SET "shows_photo" = true WHERE "kind" = 'person' AND "user_id" IS NOT NULL;

-- --- Screen the tagline like the rest of the public text ---

CREATE OR REPLACE FUNCTION "private"."screen_profile_text"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
        PERFORM private.refuse_screened(NEW.display_name, 'name', 'display_name');
    END IF;
    IF TG_OP = 'INSERT' OR NEW.handle IS DISTINCT FROM OLD.handle THEN
        PERFORM private.refuse_screened(NEW.handle, 'handle', 'handle');
    END IF;
    IF TG_OP = 'INSERT' OR NEW.bio IS DISTINCT FROM OLD.bio THEN
        PERFORM private.refuse_screened(NEW.bio, 'bio', 'bio');
    END IF;
    IF TG_OP = 'INSERT' OR NEW.instagram IS DISTINCT FROM OLD.instagram THEN
        PERFORM private.refuse_screened(NEW.instagram, 'Instagram', 'instagram');
    END IF;
    IF TG_OP = 'INSERT' OR NEW.social_links IS DISTINCT FROM OLD.social_links THEN
        PERFORM private.refuse_screened(array_to_string(NEW.social_links, ' '), 'social links', 'social_links');
    END IF;
    IF TG_OP = 'INSERT' OR NEW.tagline IS DISTINCT FROM OLD.tagline THEN
        PERFORM private.refuse_screened(NEW.tagline, 'line under your name', 'tagline');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER "screen_text" ON "public"."profiles";
CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "display_name", "handle", "bio", "instagram", "social_links", "tagline" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_profile_text"();

-- --- Jobs you add yourself show before the bar confirms ---

-- Everyone: a job the person stands behind (they added it, or accepted the
-- bar's listing) that is current, or past and switched on. Whether the bar
-- has confirmed it is bar_accepted, which the app shows.
-- No private.* helper here: anon has no USAGE on private.
DROP POLICY "profile_positions_select" ON "public"."profile_positions";
CREATE POLICY "profile_positions_select" ON "public"."profile_positions" FOR SELECT TO "anon", "authenticated"
    USING (
        "person_accepted"
        AND ("is_current" OR "is_shown")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "person_profile_id")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "b" WHERE "b"."id" = "bar_profile_id")
    );
