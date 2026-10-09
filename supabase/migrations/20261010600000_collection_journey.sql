-- Collection: what a home bartender keeps. Design canvas
-- https://claude.ai/artifact/AEcT3Zz8UdmJs4UYACchuz.
--
-- To make: the heart on a drink now collects it (collected_items), which
-- syncs, where hearts lived on one device. A heart can be any drink the
-- person can read, so a drink that was never published still needs a name
-- for its memory.
--
-- Made it: made_drinks logs each time someone makes a drink at home, how it
-- compared with the one they had at the bar, what they swapped, and a note.
-- The score is a "made at home" rank_entries row (venue NULL), so it follows
-- the existing ranking and profile-sharing rules; photos are drink_photos.
--
-- Saved menus: saved_menu_editions keeps the bar menus (profile_menu_editions)
-- someone liked. Loved bars: loved_bars. All three are private to their owner.

-- --- To make ---

-- As 20260930500400, plus the drink's own name when it isn't published.
CREATE OR REPLACE FUNCTION "private"."fill_collected_memory"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    SELECT p.name, p.image_url,
           COALESCE(bp.display_name, b.name, cp.display_name)
      INTO NEW.name, NEW.image_url, NEW.bar_name
      FROM public.published_items p
      LEFT JOIN public.items i ON i.id = p.id
      LEFT JOIN public.bars b ON b.id = i.bar_id
      LEFT JOIN public.profiles bp ON bp.bar_id = i.bar_id AND bp.is_public
      LEFT JOIN public.profiles cp ON cp.user_id = i.created_by AND cp.is_public
     WHERE p.id = NEW.item_id AND NOT p.is_reference
     LIMIT 1;
    -- A classic or another drink nobody published still needs a name, and a
    -- drink from a bar's menu history (no bar of its own) the bar it comes
    -- from. The insert policy has already checked they can read it.
    IF NEW.name IS NULL OR NEW.bar_name IS NULL THEN
        SELECT COALESCE(NEW.name, i.name), COALESCE(NEW.bar_name, op.display_name) INTO NEW.name, NEW.bar_name
          FROM public.items i
          LEFT JOIN public.profiles op ON op.id = i.origin_bar_profile_id AND op.is_public
         WHERE i.id = NEW.item_id;
    END IF;
    RETURN NEW;
END;
$$;

-- --- Made it ---

-- A list of {"from", "to"} ingredient names: what the recipe called for and
-- what was used instead.
CREATE FUNCTION "private"."valid_swaps"("p_swaps" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_typeof(p_swaps) = 'array'
     AND jsonb_array_length(p_swaps) <= 12
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_swaps) e
        WHERE jsonb_typeof(e) <> 'object'
           OR COALESCE(jsonb_typeof(e -> 'from'), '') <> 'string'
           OR COALESCE(jsonb_typeof(e -> 'to'), '') <> 'string'
           OR char_length(e ->> 'from') NOT BETWEEN 1 AND 80
           OR char_length(e ->> 'to') NOT BETWEEN 1 AND 80
           OR (SELECT count(*) FROM jsonb_object_keys(e)) <> 2
     );
$$;

REVOKE EXECUTE ON FUNCTION "private"."valid_swaps"("jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."valid_swaps"("jsonb") TO "authenticated", "service_role";

CREATE TABLE "public"."made_drinks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "made_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    -- Next to the one they had at the bar. NULL when they never had it out.
    "compared" "text" CHECK ("compared" IN ('better', 'same', 'worse')),
    "swaps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL CHECK ("private"."valid_swaps"("swaps")),
    "note" "text" CHECK (char_length("note") <= 1000),
    -- Their "made at home" ranking, when they scored it.
    "rank_entry_id" "uuid" REFERENCES "public"."rank_entries"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE INDEX "made_drinks_user_idx" ON "public"."made_drinks" ("user_id", "made_on" DESC);
CREATE INDEX "made_drinks_item_idx" ON "public"."made_drinks" ("item_id");
CREATE INDEX "made_drinks_rank_entry_idx" ON "public"."made_drinks" ("rank_entry_id") WHERE "rank_entry_id" IS NOT NULL;

ALTER TABLE "public"."made_drinks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "made_drinks_select_own" ON "public"."made_drinks" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "made_drinks_delete_own" ON "public"."made_drinks" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
-- Any drink they can read (as collecting), and only their own ranking.
CREATE POLICY "made_drinks_insert_own" ON "public"."made_drinks" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "private"."is_age_confirmed"()
        AND (
            EXISTS (SELECT 1 FROM "public"."published_items" "p" WHERE "p"."id" = "item_id" AND NOT "p"."is_reference")
            OR EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id")
        )
        AND ("rank_entry_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."rank_entries" "r" WHERE "r"."id" = "rank_entry_id" AND "r"."user_id" = (SELECT "auth"."uid"())
        ))
    );
CREATE POLICY "made_drinks_update_own" ON "public"."made_drinks" FOR UPDATE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND ("rank_entry_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."rank_entries" "r" WHERE "r"."id" = "rank_entry_id" AND "r"."user_id" = (SELECT "auth"."uid"())
        ))
    );

REVOKE ALL ON "public"."made_drinks" FROM "anon";
REVOKE TRUNCATE, TRIGGER, REFERENCES ON "public"."made_drinks" FROM "authenticated";
-- The drink and who made it never change; the rest can be fixed later.
REVOKE UPDATE ON "public"."made_drinks" FROM "authenticated";
GRANT UPDATE ("made_on", "compared", "swaps", "note", "rank_entry_id") ON "public"."made_drinks" TO "authenticated";

-- A private log, but still a table anyone signed in writes to: a day's
-- entries are capped so a loop can't fill it.
CREATE FUNCTION "private"."limit_made_drinks"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('made:' || NEW.user_id::text, 0));
    IF (SELECT count(*) FROM public.made_drinks m
         WHERE m.user_id = NEW.user_id AND m.created_at > now() - interval '1 day') >= 50 THEN
        RAISE EXCEPTION 'You''ve logged 50 drinks today. Try again tomorrow.';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."limit_made_drinks"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "limit_made_drinks" BEFORE INSERT ON "public"."made_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."limit_made_drinks"();

-- --- Saved menus ---

CREATE TABLE "public"."saved_menu_editions" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "edition_id" "uuid" NOT NULL REFERENCES "public"."profile_menu_editions"("id") ON DELETE CASCADE,
    "saved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("user_id", "edition_id")
);

CREATE INDEX "saved_menu_editions_edition_idx" ON "public"."saved_menu_editions" ("edition_id");

ALTER TABLE "public"."saved_menu_editions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_menu_editions_select_own" ON "public"."saved_menu_editions" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "saved_menu_editions_delete_own" ON "public"."saved_menu_editions" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
-- A menu they can see (its bar's page is visible to them). The menu page
-- itself is behind the drinking-age check, so saving is too.
CREATE POLICY "saved_menu_editions_insert_own" ON "public"."saved_menu_editions" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "private"."is_age_confirmed"()
        AND EXISTS (SELECT 1 FROM "public"."profile_menu_editions" "e" WHERE "e"."id" = "edition_id")
    );

REVOKE ALL ON "public"."saved_menu_editions" FROM "anon";
REVOKE UPDATE, TRUNCATE, TRIGGER, REFERENCES ON "public"."saved_menu_editions" FROM "authenticated";

-- --- Loved bars ---

CREATE TABLE "public"."loved_bars" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "loved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("user_id", "profile_id")
);

CREATE INDEX "loved_bars_profile_idx" ON "public"."loved_bars" ("profile_id");

ALTER TABLE "public"."loved_bars" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loved_bars_select_own" ON "public"."loved_bars" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "loved_bars_delete_own" ON "public"."loved_bars" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
-- Only a bar's page they can see; a person's profile can't be loved.
CREATE POLICY "loved_bars_insert_own" ON "public"."loved_bars" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "profile_id" AND "p"."kind" = 'bar')
    );

REVOKE ALL ON "public"."loved_bars" FROM "anon";
REVOKE UPDATE, TRUNCATE, TRIGGER, REFERENCES ON "public"."loved_bars" FROM "authenticated";
