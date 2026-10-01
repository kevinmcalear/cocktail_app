-- An Instagram name on a profile (a person or a bar), separate from website.
-- Names already stored as instagram.com links move here, and that link stops
-- pretending to be a website. The owner sets it; the CHECK matches
-- instagramProblem() in lib/profiles.ts.
-- ponytail: one column, not a social-accounts table. Add another network when
-- a second one is actually used.

ALTER TABLE "public"."profiles"
    ADD COLUMN "instagram" "text",
    ADD CONSTRAINT "profiles_instagram_format" CHECK (
        "instagram" IS NULL
        OR (
            char_length("instagram") BETWEEN 1 AND 30
            AND "instagram" ~ '^[a-z0-9._]+$'
            AND "instagram" !~ '^\.|\.$|\.\.'
        )
    );

-- Move Instagram links out of website. A real site stays put.
UPDATE "public"."profiles" AS p
SET "instagram" = v.handle,
    "website" = CASE
        WHEN p.website ~* '^https?://(www\.)?instagram\.com/[A-Za-z0-9._]+/?$' THEN NULL
        ELSE p.website
    END
FROM (
    SELECT "id",
        lower(regexp_replace((regexp_match("website", 'instagram\.com/([A-Za-z0-9._]+)'))[1], '\.+$', '')) AS handle
    FROM "public"."profiles"
    WHERE "website" ~* 'instagram\.com/[A-Za-z0-9._]+'
) AS v
WHERE p.id = v.id
  AND p.instagram IS NULL
  AND char_length(v.handle) BETWEEN 1 AND 30
  AND v.handle ~ '^[a-z0-9._]+$'
  AND v.handle !~ '^\.|\.$|\.\.';

-- Screen the name the same way as the handle. Backfill above ran first, so
-- names we already published aren't re-checked.
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
    RETURN NEW;
END;
$$;

DROP TRIGGER "screen_text" ON "public"."profiles";
CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "display_name", "handle", "bio", "instagram" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_profile_text"();
