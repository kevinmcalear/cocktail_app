-- DRAFT. Local stack only. Not applied to production; needs Kevin's review first.
--
-- Past jobs are opt-in, one job at a time (decided 7 Oct 2026). A profile
-- always shows where the person works now; each job they used to have shows
-- only once they switch it on. Most person profiles were seeded from public
-- research and are unclaimed, so nobody has switched anything on, and their
-- past jobs stop being readable by others.
--
--   profile_positions.is_shown   the person's switch. Only matters once the
--                                job is past (is_current = false). Only the
--                                person turns it on; anyone who can edit the
--                                row can turn it off.
--   profile_positions_select     others read a job that is current or shown.
--                                The person, moderators and the bar's
--                                publishers still read every row through
--                                profile_positions_write (FOR ALL), so they
--                                can fix or remove it.
--
-- Drink credits don't change: items.creator_profile_id and item_co_creators
-- never read positions.

ALTER TABLE "public"."profile_positions"
    ADD COLUMN "is_shown" boolean DEFAULT false NOT NULL;

-- Showing a past job is the person's call: not the bar's, not a moderator's.
-- SQL with no signed-in user (migrations, the service role) is trusted.
CREATE FUNCTION "private"."guard_position_shown"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.is_shown AND (TG_OP = 'INSERT' OR NOT OLD.is_shown) AND auth.uid() IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.person_profile_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Only the person can show a past job on their profile.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_position_shown" BEFORE INSERT OR UPDATE OF "is_shown" ON "public"."profile_positions"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_position_shown"();

REVOKE EXECUTE ON FUNCTION "private"."guard_position_shown"() FROM PUBLIC, "anon", "authenticated";

-- No private.* helper: anon has no USAGE on private.
DROP POLICY "profile_positions_select" ON "public"."profile_positions";
CREATE POLICY "profile_positions_select" ON "public"."profile_positions" FOR SELECT TO "anon", "authenticated"
    USING (
        ("is_current" OR "is_shown")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "person_profile_id")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "b" WHERE "b"."id" = "bar_profile_id")
    );
