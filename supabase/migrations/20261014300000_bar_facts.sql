-- A bar's facts: opening hours, phone, what kind of bar it is, the year it
-- opened. Local stack only until Kevin's OK.
--
-- The venue types these itself (decision b22, manual). Nothing here comes
-- from Google: its terms forbid storing Places hours, phone or website, so
-- there is no place id, no sync and no Google column.
--
-- They are columns on the bar's profile, beside website and address_line,
-- so they follow the profile's own rules:
--   * read: whoever can read the bar page (profiles_select_public, and for
--     signed-out visitors the column grants below);
--   * write: profiles_update, which for a bar page is that venue's admins
--     (the 'publish' capability) and catalog admins. No new policy.
--
-- hours is one week, Monday first, as
--   {"mon": [["17:00", "01:00"]], "tue": [], "fri": [["12:00", "15:00"], ["17:00", "02:00"]], ...}
-- A day holds at most two ranges. A close at or before the open is past
-- midnight (Friday 17:00 to 01:00 closes at 1am Saturday). A missing or
-- empty day is closed. NULL hours means we don't know them.
-- hours_updated_at is stamped whenever hours change, for "updated 3 Oct".
-- timezone is the bar's IANA zone, so "Open now" is worked out in the bar's
-- own time wherever the reader is.

-- --- Checks ---

-- One week of hours in the shape above.
CREATE FUNCTION "private"."bar_hours_ok"("p_hours" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
    SELECT jsonb_typeof(p_hours) = 'object'
       AND NOT EXISTS (
           SELECT 1 FROM jsonb_each(p_hours) AS d(day, ranges)
           WHERE d.day NOT IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
              OR jsonb_typeof(d.ranges) <> 'array'
              OR jsonb_array_length(d.ranges) > 2
              OR EXISTS (
                  SELECT 1 FROM jsonb_array_elements(d.ranges) AS r(span)
                  WHERE jsonb_typeof(r.span) <> 'array'
                     OR jsonb_array_length(r.span) <> 2
                     OR jsonb_typeof(r.span -> 0) <> 'string'
                     OR jsonb_typeof(r.span -> 1) <> 'string'
                     OR NOT (r.span ->> 0) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                     OR NOT (r.span ->> 1) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                     OR (r.span ->> 0) = (r.span ->> 1)));
$$;

ALTER TABLE "public"."profiles"
    ADD COLUMN "hours" "jsonb",
    ADD COLUMN "hours_updated_at" timestamp with time zone,
    ADD COLUMN "timezone" "text",
    ADD COLUMN "phone" "text",
    ADD COLUMN "bar_type" "text",
    ADD COLUMN "opened_year" integer,
    ADD CONSTRAINT "profiles_hours_shape" CHECK ("hours" IS NULL OR "private"."bar_hours_ok"("hours")),
    ADD CONSTRAINT "profiles_timezone_shape" CHECK (
        "timezone" IS NULL OR ("timezone" ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+){0,2}$' AND char_length("timezone") <= 64)
    ),
    -- Digits with the usual separators and an optional leading +.
    ADD CONSTRAINT "profiles_phone_shape" CHECK (
        "phone" IS NULL OR ("phone" ~ '^\+?[0-9][0-9 ().-]{2,30}[0-9]$' AND "phone" = btrim("phone"))
    ),
    ADD CONSTRAINT "profiles_bar_type_shape" CHECK (
        "bar_type" IS NULL OR (char_length("bar_type") BETWEEN 1 AND 40 AND "bar_type" = btrim("bar_type"))
    ),
    ADD CONSTRAINT "profiles_opened_year_range" CHECK ("opened_year" IS NULL OR "opened_year" BETWEEN 1600 AND 2100),
    -- A person's profile never carries a phone number or opening hours.
    ADD CONSTRAINT "profiles_bar_facts_bars_only" CHECK (
        "kind" = 'bar'
        OR ("hours" IS NULL AND "timezone" IS NULL AND "phone" IS NULL AND "bar_type" IS NULL AND "opened_year" IS NULL)
    );

COMMENT ON COLUMN "public"."profiles"."hours" IS
    'A bar''s weekly opening hours, typed by the venue: {"mon": [["17:00","01:00"]], ...}, Monday first, at most two ranges a day, a close at or before the open is past midnight, a missing or empty day is closed. NULL: unknown.';
COMMENT ON COLUMN "public"."profiles"."hours_updated_at" IS 'When hours last changed. Set by a trigger.';
COMMENT ON COLUMN "public"."profiles"."timezone" IS 'A bar''s IANA time zone, for "Open now" in the bar''s own time.';
COMMENT ON COLUMN "public"."profiles"."phone" IS 'A bar''s public phone number, as the venue typed it.';
COMMENT ON COLUMN "public"."profiles"."bar_type" IS 'What kind of bar it is, e.g. "Cocktail bar".';
COMMENT ON COLUMN "public"."profiles"."opened_year" IS 'The year the bar opened.';

-- --- Stamping when the hours changed ---

CREATE FUNCTION "private"."stamp_bar_hours"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.hours IS DISTINCT FROM OLD.hours THEN
        NEW.hours_updated_at := CASE WHEN NEW.hours IS NULL THEN NULL ELSE now() END;
    ELSE
        NEW.hours_updated_at := OLD.hours_updated_at;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."stamp_bar_hours"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "stamp_bar_hours" BEFORE INSERT OR UPDATE OF "hours", "hours_updated_at" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."stamp_bar_hours"();

-- Signed-out visitors read profiles column by column (20260927000000).
GRANT SELECT ("hours", "hours_updated_at", "timezone", "phone", "bar_type", "opened_year") ON "public"."profiles" TO "anon";
