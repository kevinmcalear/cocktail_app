-- A credit for making a drink with someone waits for that person to say yes
-- (QA Q34): item_co_creators gains a status, pending, accepted or declined.
--
-- How a credit starts, when someone signed in names a co-creator:
--   * naming yourself: accepted;
--   * naming someone else with an account: pending until they accept;
--   * naming a person on a page nobody has claimed: pending until whoever
--     claims it accepts (the page's credits stay pending through the claim);
--   * a moderator naming someone on an unclaimed page: accepted, as the
--     research seeds are (historic people like Harry Craddock never claim).
-- SQL and the service role write what they say, accepted when they leave it
-- out. Every row already here is backfilled as accepted, so nothing that
-- shows today disappears.
--
-- Who sees what: accepted credits read as before (with the drink and the
-- profile). Pending and declined ones are seen only by the person named, the
-- drink's editors (so they can see it's waiting and don't name them twice)
-- and moderators. Every reader of item_co_creators goes through this policy:
-- the drink page's credits, a person's page and find-yourself's counts.
-- Signed-out visitors read no co-creators at all, as before.
--
-- Only the person named can change a credit's status: answer_credit(item,
-- accept). credits_to_check() lists the signed-in person's pending ones, for
-- "Credits to check" on You.
--
-- items.credit_status stays a separate fact: it says how sure the drink's
-- main credit (its creator and first bar) is, suggested, claimed or verified,
-- and a bar's editors can claim it for their bar. It isn't one person's yes,
-- so it doesn't share this status.

CREATE TYPE "public"."co_creator_status" AS ENUM ('pending', 'accepted', 'declined');

-- The default fills every existing row: the backfill. Signed-in inserts get
-- their status from the trigger below.
ALTER TABLE "public"."item_co_creators"
    ADD COLUMN "status" "public"."co_creator_status" DEFAULT 'accepted' NOT NULL;

CREATE INDEX "item_co_creators_pending_idx" ON "public"."item_co_creators" ("profile_id") WHERE "status" = 'pending';

CREATE OR REPLACE FUNCTION "private"."guard_item_co_creator"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_owner UUID;
BEGIN
    SELECT user_id INTO v_owner FROM public.profiles WHERE id = NEW.profile_id AND kind = 'person';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'A drink''s co-creator must be a person''s profile.';
    END IF;

    -- Someone signed in never picks the status; SQL and the service role do.
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
        NEW.status := CASE
            WHEN v_owner = auth.uid() THEN 'accepted'
            WHEN v_owner IS NULL AND private.is_app_admin() THEN 'accepted'
            ELSE 'pending'
        END::public.co_creator_status;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."guard_item_co_creator"() FROM PUBLIC, "anon", "authenticated";

DROP POLICY "item_co_creators_select" ON "public"."item_co_creators";
CREATE POLICY "item_co_creators_select" ON "public"."item_co_creators" FOR SELECT TO "authenticated"
    USING (
        EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "profile_id")
        AND (
            "status" = 'accepted'
            OR "profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
            OR "private"."is_app_admin"()
            OR "private"."can_edit_item"("item_id")
        )
    );

-- No UPDATE policy: a status changes only here, by the person named. They can
-- change their mind later (decline one they accepted, or the other way).
-- Declining keeps the row, so the drink's editors can't name them again; the
-- person can still take themselves off with a delete, as before.
CREATE FUNCTION "public"."answer_credit"("p_item_id" "uuid", "p_accept" boolean) RETURNS "public"."co_creator_status"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_status public.co_creator_status;
BEGIN
    IF auth.uid() IS NULL OR p_accept IS NULL THEN
        RAISE EXCEPTION 'Sign in to answer a credit.';
    END IF;

    UPDATE public.item_co_creators c
       SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END::public.co_creator_status
     WHERE c.item_id = p_item_id
       AND c.profile_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() AND p.kind = 'person')
    RETURNING c.status INTO v_status;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'You aren''t named on that drink.';
    END IF;
    RETURN v_status;
END;
$$;

-- The signed-in person's pending credits, newest first. It reads past items
-- RLS on purpose: a person named on a venue's private drink still sees its
-- name, its creator and its bar, so they know what they're saying yes to.
-- ponytail: the newest 200; page it if someone is ever named that often.
CREATE FUNCTION "public"."credits_to_check"() RETURNS TABLE (
    "item_id" "uuid",
    "name" "text",
    "item_type" "public"."entity_type",
    "creator_name" "text",
    "bar_name" "text",
    "named_at" timestamp with time zone
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT i.id, i.name, i.item_type, cp.display_name, COALESCE(bp.display_name, b.name), c.created_at
      FROM public.item_co_creators c
      JOIN public.profiles me ON me.id = c.profile_id AND me.user_id = auth.uid() AND me.kind = 'person'
      JOIN public.items i ON i.id = c.item_id
      LEFT JOIN public.profiles cp ON cp.id = i.creator_profile_id
      LEFT JOIN public.profiles bp ON bp.id = i.origin_bar_profile_id
      LEFT JOIN public.bars b ON b.id = i.bar_id
     WHERE c.status = 'pending'
     ORDER BY c.created_at DESC
     LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION "public"."answer_credit"("uuid", boolean) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."credits_to_check"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."answer_credit"("uuid", boolean) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."credits_to_check"() TO "authenticated";
