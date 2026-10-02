-- Career history a hospitality worker adds when we don't already have their
-- profile: menus they worked on, at a bar that may have closed.
--
-- Jobs stay in profile_positions. Drinks stay in items (a shared cocktail
-- they created, credited as suggested, origin bar optional). Both already
-- allow a closed bar: nothing in those policies reads profiles.is_closed.
--
-- profile_worked_menus uses the same writers as profile_positions: the
-- person, a publisher at that bar, or a moderator. It is their own record
-- of a list they worked, not the bar's researched profile_menu_editions,
-- which stay admin-only.
--
-- A pending claim on a person profile blocks making a second one, so
-- approval can still hand the existing profile over (profiles.user_id is
-- unique). ponytail: no merge. A moderator still merges by hand if both
-- exist.

CREATE TABLE "public"."profile_worked_menus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "person_profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "bar_profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 120),
    "year" smallint CHECK ("year" BETWEEN 1900 AND 2100),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_worked_menus_once" UNIQUE NULLS NOT DISTINCT ("person_profile_id", "bar_profile_id", "name", "year")
);

CREATE INDEX "profile_worked_menus_bar_idx" ON "public"."profile_worked_menus" ("bar_profile_id");

CREATE FUNCTION "private"."guard_worked_menu"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.person_profile_id AND kind = 'person') THEN
        RAISE EXCEPTION 'A menu credit belongs to a person''s profile.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.bar_profile_id AND kind = 'bar') THEN
        RAISE EXCEPTION 'A menu credit is at a bar''s profile.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_worked_menu" BEFORE INSERT OR UPDATE OF "person_profile_id", "bar_profile_id" ON "public"."profile_worked_menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_worked_menu"();

REVOKE EXECUTE ON FUNCTION "private"."guard_worked_menu"() FROM PUBLIC, "anon", "authenticated";

CREATE FUNCTION "private"."screen_worked_menu_text"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.name IS DISTINCT FROM OLD.name THEN
        PERFORM private.refuse_screened(NEW.name, 'menu name', 'name');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "name" ON "public"."profile_worked_menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_worked_menu_text"();

REVOKE EXECUTE ON FUNCTION "private"."screen_worked_menu_text"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."profile_worked_menus" ENABLE ROW LEVEL SECURITY;

-- Visible when you can see both profiles (profiles' own RLS decides).
-- A closed bar is still a bar profile, so its history stays readable.
CREATE POLICY "profile_worked_menus_select" ON "public"."profile_worked_menus" FOR SELECT TO "anon", "authenticated"
    USING (
        EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "person_profile_id")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "b" WHERE "b"."id" = "bar_profile_id")
    );
CREATE POLICY "profile_worked_menus_write" ON "public"."profile_worked_menus" FOR ALL TO "authenticated"
    USING (
        "private"."is_app_admin"()
        OR "person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
        OR "bar_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    )
    WITH CHECK (
        "private"."is_app_admin"()
        OR "person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
        OR "bar_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    );

GRANT SELECT ON TABLE "public"."profile_worked_menus" TO "anon", "authenticated";
GRANT INSERT, UPDATE, DELETE ON TABLE "public"."profile_worked_menus" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_worked_menus" TO "service_role";

-- Don't make a second person profile while a claim on one is waiting.
CREATE FUNCTION "private"."guard_profile_during_claim"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.kind = 'person' AND NEW.user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profile_claims c
        JOIN public.profiles p ON p.id = c.profile_id
        WHERE c.user_id = NEW.user_id AND c.status = 'pending' AND p.kind = 'person'
    ) THEN
        RAISE EXCEPTION 'You already have a claim waiting. A moderator will hand that profile to you.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_profile_during_claim" BEFORE INSERT ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_profile_during_claim"();

REVOKE EXECUTE ON FUNCTION "private"."guard_profile_during_claim"() FROM PUBLIC, "anon", "authenticated";
