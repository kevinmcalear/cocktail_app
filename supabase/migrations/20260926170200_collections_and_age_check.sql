-- DRAFT (docs/publishing_moderation_proposal.md, section 3). Local stack only.
-- Not applied to production; needs Kevin's review first.
--
-- Collections, home menus and the age check.
--
--   age check           confirm_age(birth date, country) at sign-up. It
--                       compares the date with the country's legal drinking
--                       age and keeps only the result (country, the age
--                       applied, when). The birth date is never stored. A
--                       person who declared themselves under age can't try
--                       again with another date; support can clear it.
--                       Signed-out visitors aren't checked here (see the
--                       proposal's open questions).
--   collected_items     drinks a person saved: published ones, or ones they
--                       can already read (their bar's, the shared catalogue).
--   collected_releases  releases a person collected from a bar. Live
--                       references: the drinks listed are the release's
--                       current published drinks.
--   home menus          ordinary menus rows with no bar, plus a date and a
--                       guest count. Bar-less menus become private to their
--                       creator (they were readable by every signed-in user).
--
-- All three are private to their owner. Saving anything needs a confirmed
-- age.

-- --- Age check ---

CREATE TABLE "private"."age_checks" (
    "user_id" "uuid" PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "country_code" "text" NOT NULL CHECK ("country_code" ~ '^[A-Z]{2}$'),
    -- The legal drinking age applied for that country when they confirmed.
    "minimum_age" smallint NOT NULL,
    -- Set when they're of age; NULL when they declared themselves under age.
    "confirmed_at" timestamp with time zone,
    "under_age_at" timestamp with time zone,
    CONSTRAINT "age_checks_one_outcome" CHECK (("confirmed_at" IS NULL) <> ("under_age_at" IS NULL))
);
ALTER TABLE "private"."age_checks" ENABLE ROW LEVEL SECURITY;

-- ponytail: a short list of the countries whose drinking age isn't 18, taken
-- at the strictest region where it varies. It needs a legal check before
-- launch, and doesn't handle countries where alcohol is banned outright; the
-- stores' own region settings are the backstop there.
CREATE FUNCTION "private"."drinking_age"("p_country_code" "text") RETURNS smallint
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT (CASE upper(p_country_code)
    WHEN 'US' THEN 21
    WHEN 'AE' THEN 21
    WHEN 'JP' THEN 20
    WHEN 'IS' THEN 20
    WHEN 'TH' THEN 20
    WHEN 'KR' THEN 19
    WHEN 'CA' THEN 19
    ELSE 18
  END)::smallint;
$$;

CREATE FUNCTION "private"."is_age_confirmed"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (SELECT 1 FROM private.age_checks WHERE user_id = auth.uid() AND confirmed_at IS NOT NULL);
$$;

-- Called once at sign-up. Returns the drinking age applied when the person is
-- of age for their country. When they aren't, it returns NULL and remembers
-- it, so a second attempt with another date raises.
CREATE FUNCTION "public"."confirm_age"("p_birth_date" "date", "p_country_code" "text") RETURNS smallint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_country TEXT := upper(btrim(p_country_code));
    v_minimum SMALLINT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in first.';
    END IF;
    IF v_country IS NULL OR v_country !~ '^[A-Z]{2}$' THEN
        RAISE EXCEPTION 'Pick a country.';
    END IF;
    IF p_birth_date IS NULL OR p_birth_date > current_date OR p_birth_date < DATE '1900-01-01' THEN
        RAISE EXCEPTION 'Enter a real date of birth.';
    END IF;
    IF EXISTS (SELECT 1 FROM private.age_checks WHERE user_id = auth.uid() AND under_age_at IS NOT NULL) THEN
        RAISE EXCEPTION 'This account can''t use home mode yet.' USING ERRCODE = 'P0001';
    END IF;

    v_minimum := private.drinking_age(v_country);

    IF p_birth_date + make_interval(years => v_minimum) > current_date THEN
        INSERT INTO private.age_checks (user_id, country_code, minimum_age, under_age_at)
        VALUES (auth.uid(), v_country, v_minimum, now())
        ON CONFLICT (user_id) DO UPDATE
        SET country_code = EXCLUDED.country_code, minimum_age = EXCLUDED.minimum_age,
            confirmed_at = NULL, under_age_at = EXCLUDED.under_age_at;
        -- Not RAISE: that would roll back the row that stops a second try.
        RETURN NULL;
    END IF;

    INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at)
    VALUES (auth.uid(), v_country, v_minimum, now())
    ON CONFLICT (user_id) DO UPDATE
    SET country_code = EXCLUDED.country_code, minimum_age = EXCLUDED.minimum_age,
        confirmed_at = EXCLUDED.confirmed_at, under_age_at = NULL;
    RETURN v_minimum;
END;
$$;

-- For the app: whether the signed-in person has confirmed their age.
-- 'confirmed', 'under_age' or 'unknown'.
CREATE FUNCTION "public"."get_my_age_check"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN confirmed_at IS NOT NULL THEN 'confirmed' ELSE 'under_age' END
     FROM private.age_checks WHERE user_id = auth.uid()),
    'unknown'
  );
$$;

-- --- Collections ---

CREATE TABLE "public"."collected_items" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- Where they found it, when it came from a release.
    "release_id" "uuid" REFERENCES "public"."releases"("id") ON DELETE SET NULL,
    "collected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("user_id", "item_id")
);

CREATE INDEX "collected_items_item_id_idx" ON "public"."collected_items" ("item_id");
CREATE INDEX "collected_items_release_id_idx" ON "public"."collected_items" ("release_id");

CREATE TABLE "public"."collected_releases" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "release_id" "uuid" NOT NULL REFERENCES "public"."releases"("id") ON DELETE CASCADE,
    "collected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("user_id", "release_id")
);

CREATE INDEX "collected_releases_release_id_idx" ON "public"."collected_releases" ("release_id");

-- --- Home menus ---

ALTER TABLE "public"."menus"
    -- "Sat 27 Sep · 6 guests"
    ADD COLUMN "menu_date" "date",
    ADD COLUMN "guest_count" integer CHECK ("guest_count" BETWEEN 1 AND 500);

-- Bar-less menus were readable by every signed-in user. They're personal
-- working documents (prepare_account_deletion already treats them that way),
-- so now only their creator reads them. Legacy bar-less menus with no
-- recorded creator keep today's behaviour. menu_drinks follows menus.
DROP POLICY "menus_select" ON "public"."menus";
CREATE POLICY "menus_select" ON "public"."menus" FOR SELECT TO "authenticated"
    USING (
        "bar_id" IN (SELECT "private"."my_bar_ids"(0))
        OR ("bar_id" IS NULL AND ("created_by" IS NULL OR "created_by" = (SELECT "auth"."uid"())))
    );

-- --- Policies ---

ALTER TABLE "public"."collected_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."collected_releases" ENABLE ROW LEVEL SECURITY;

-- The owner's alone. A drink can be saved when it's published (and not
-- hidden from the caller by a block or a moderator), or when the caller can
-- already read it.
CREATE POLICY "collected_items_select_own" ON "public"."collected_items" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "collected_items_delete_own" ON "public"."collected_items" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "collected_items_insert_own" ON "public"."collected_items" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "private"."is_age_confirmed"()
        AND (
            EXISTS (SELECT 1 FROM "public"."published_items" "p" WHERE "p"."id" = "item_id" AND NOT "p"."is_reference")
            OR EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id")
        )
        AND ("release_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."release_items" "ri" WHERE "ri"."release_id" = "collected_items"."release_id" AND "ri"."item_id" = "collected_items"."item_id"
        ))
    );

-- A release can be collected once it's live.
CREATE POLICY "collected_releases_select_own" ON "public"."collected_releases" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "collected_releases_delete_own" ON "public"."collected_releases" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "collected_releases_insert_own" ON "public"."collected_releases" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "private"."is_age_confirmed"()
        AND EXISTS (
            SELECT 1 FROM "public"."releases" "r"
            WHERE "r"."id" = "release_id" AND "r"."published_at" <= "now"() AND "r"."moderated_at" IS NULL
        )
    );

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "private"."drinking_age"("p_country_code" "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."is_age_confirmed"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."is_age_confirmed"() TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."confirm_age"("p_birth_date" "date", "p_country_code" "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."confirm_age"("p_birth_date" "date", "p_country_code" "text") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."get_my_age_check"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_my_age_check"() TO "authenticated", "service_role";
