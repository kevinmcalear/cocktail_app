-- Accolades and menu history on bar profiles.
--
--   profile_accolades     a bar's placings and awards, one row per award per
--                         year: No. 12 on The World's 50 Best Bars 2024, or
--                         Best International Cocktail Bar at the 2023
--                         Spirited Awards. A placing has a position, a named
--                         award has a title.
--   profile_menu_editions every cocktail menu a bar has put out, with the
--                         month and year it launched (month is null when only
--                         the year is known), a line on what it was about,
--                         the drinks when a source lists them, and where
--                         that came from.
--
-- Both are the public record of a bar, so anyone who can see the profile
-- reads them, signed in or not. Only app admins write them: a bar doesn't
-- award itself, and these are researched from published lists and press.
-- ponytail: menu editions are separate from a venue's own menus (menus,
-- menu_drinks), which are private to its staff. When a venue publishes its
-- menus (step 7d), its public history can come from there instead.
-- The data for the 50 bars on the map is in the next migration.

CREATE TABLE "public"."profile_accolades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    -- "The World's 50 Best Bars", "Tales of the Cocktail Spirited Awards".
    "award" "text" NOT NULL CHECK (char_length(btrim("award")) BETWEEN 2 AND 80),
    "year" smallint NOT NULL CHECK ("year" BETWEEN 1900 AND 2100),
    "position" smallint CHECK ("position" BETWEEN 1 AND 500),
    -- "World's Best Cocktail Bar", "Highest Climber".
    "title" "text" CHECK (char_length(btrim("title")) BETWEEN 2 AND 120),
    "source_url" "text" CHECK ("source_url" ~ '^https?://'),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_accolades_position_or_title" CHECK ("position" IS NOT NULL OR "title" IS NOT NULL),
    CONSTRAINT "profile_accolades_once" UNIQUE NULLS NOT DISTINCT ("profile_id", "award", "year", "position", "title")
);

CREATE TABLE "public"."profile_menu_editions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 120),
    "year" smallint NOT NULL CHECK ("year" BETWEEN 1900 AND 2100),
    "month" smallint CHECK ("month" BETWEEN 1 AND 12),
    "theme" "text" CHECK (char_length("theme") <= 300),
    "drinks" "text"[] DEFAULT '{}'::"text"[] NOT NULL CHECK (cardinality("drinks") <= 80),
    "source_url" "text" CHECK ("source_url" ~ '^https?://'),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_menu_editions_once" UNIQUE NULLS NOT DISTINCT ("profile_id", "name", "year", "month")
);

CREATE INDEX "profile_accolades_profile_idx" ON "public"."profile_accolades" ("profile_id", "year" DESC);
CREATE INDEX "profile_menu_editions_profile_idx" ON "public"."profile_menu_editions" ("profile_id", "year" DESC, "month" DESC NULLS LAST);

ALTER TABLE "public"."profile_accolades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profile_menu_editions" ENABLE ROW LEVEL SECURITY;

-- Readable with the profile: profiles' own policies decide which ones the
-- reader can see (public ones for everyone, private ones for their owner).
CREATE POLICY "profile_accolades_select" ON "public"."profile_accolades" FOR SELECT TO "anon", "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "profile_id"));
CREATE POLICY "profile_accolades_admin_insert" ON "public"."profile_accolades" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."is_app_admin"());
CREATE POLICY "profile_accolades_admin_update" ON "public"."profile_accolades" FOR UPDATE TO "authenticated"
    USING ("private"."is_app_admin"()) WITH CHECK ("private"."is_app_admin"());
CREATE POLICY "profile_accolades_admin_delete" ON "public"."profile_accolades" FOR DELETE TO "authenticated"
    USING ("private"."is_app_admin"());

CREATE POLICY "profile_menu_editions_select" ON "public"."profile_menu_editions" FOR SELECT TO "anon", "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "profile_id"));
CREATE POLICY "profile_menu_editions_admin_insert" ON "public"."profile_menu_editions" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."is_app_admin"());
CREATE POLICY "profile_menu_editions_admin_update" ON "public"."profile_menu_editions" FOR UPDATE TO "authenticated"
    USING ("private"."is_app_admin"()) WITH CHECK ("private"."is_app_admin"());
CREATE POLICY "profile_menu_editions_admin_delete" ON "public"."profile_menu_editions" FOR DELETE TO "authenticated"
    USING ("private"."is_app_admin"());

REVOKE ALL ON "public"."profile_accolades", "public"."profile_menu_editions" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."profile_accolades", "public"."profile_menu_editions" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."profile_accolades", "public"."profile_menu_editions" TO "authenticated";
GRANT ALL ON "public"."profile_accolades", "public"."profile_menu_editions" TO "service_role";
