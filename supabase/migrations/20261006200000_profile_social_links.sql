-- A profile's other social accounts: Facebook, TikTok, X, YouTube and Threads
-- pages, as links. Instagram keeps its own column (20261001124323), since
-- publishing asks for it by name. A bar page shows these under the name, next
-- to Instagram and the website (profileLinks in lib/profiles.ts).
-- ponytail: one array of URLs, not a column per network or a link table, and
-- no editor yet; bars get theirs from 20261006200100. Add an owner editor when
-- a claimed bar asks to change one.

ALTER TABLE "public"."profiles"
    ADD COLUMN "social_links" "text"[],
    -- Only profile pages on the five networks, in the shape the app links to.
    -- Matches SOCIAL in lib/profiles.ts.
    ADD CONSTRAINT "profiles_social_links_format" CHECK (
        "social_links" IS NULL
        OR (
            cardinality("social_links") BETWEEN 1 AND 5
            AND array_position("social_links", NULL) IS NULL
            AND array_to_string("social_links", '') !~ ','
            AND array_to_string("social_links", ',') ~ '^(https://(www\.facebook\.com/(p/)?[A-Za-z0-9.-]+/|www\.tiktok\.com/@[A-Za-z0-9._]+|x\.com/[A-Za-z0-9_]+|www\.youtube\.com/(@|channel/)[A-Za-z0-9._-]+|www\.threads\.com/@[A-Za-z0-9._]+)(,|$))+$'
        )
    );

-- Signed-out visitors read profiles by column (20260927000000).
GRANT SELECT ("social_links") ON "public"."profiles" TO "anon";

-- Screen the links like the Instagram name.
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
    RETURN NEW;
END;
$$;

DROP TRIGGER "screen_text" ON "public"."profiles";
CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "display_name", "handle", "bio", "instagram", "social_links" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_profile_text"();
