-- DRAFT (docs/publishing_moderation_proposal.md, section 4). Local stack only.
-- Not applied to production; needs Kevin's review first.
--
-- Blocks between people, and moderation holds on public content.
--
--   user_blocks      one person blocking another. Private to the blocker: the
--                    blocked person can't read it.
--   blocked users    private.blocked_user_ids() is everyone the caller has
--                    blocked or been blocked by. Public read paths leave their
--                    content out in both directions, so a block also hides the
--                    blocker from the person they blocked.
--   moderated_at     on items and profiles (and releases, next migration):
--                    set by a moderator to take something out of the public
--                    layer. Only catalog admins (private.app_admins) or the
--                    service role can set or clear it, so the owner can't
--                    undo a takedown by editing the row.
--
-- The public profile policy and get_drink_rankings() now skip moderated
-- profiles, and signed-in readers don't see profiles on either side of a block.

CREATE TABLE "public"."user_blocks" (
    "blocker_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "blocked_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("blocker_id", "blocked_id"),
    CONSTRAINT "user_blocks_not_self" CHECK ("blocker_id" <> "blocked_id")
);

CREATE INDEX "user_blocks_blocked_id_idx" ON "public"."user_blocks" ("blocked_id");

-- Everyone the caller has blocked or been blocked by. Empty when signed out.
-- Policies use it as "user_id NOT IN (SELECT private.blocked_user_ids())" so it
-- runs once per query.
CREATE FUNCTION "private"."blocked_user_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid()
  UNION
  SELECT blocker_id FROM public.user_blocks WHERE blocked_id = auth.uid();
$$;

-- --- Moderation holds ---

ALTER TABLE "public"."items" ADD COLUMN "moderated_at" timestamp with time zone;
ALTER TABLE "public"."profiles" ADD COLUMN "moderated_at" timestamp with time zone;

-- Only moderators (catalog admins) and the service role set or clear a hold.
CREATE FUNCTION "private"."guard_moderated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.moderated_at IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.moderated_at IS DISTINCT FROM OLD.moderated_at) THEN
        IF auth.uid() IS NOT NULL AND NOT private.is_app_admin() THEN
            RAISE EXCEPTION 'Only moderators can hide or restore content.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_moderated_at" BEFORE INSERT OR UPDATE OF "moderated_at" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_moderated_at"();
CREATE TRIGGER "guard_moderated_at" BEFORE INSERT OR UPDATE OF "moderated_at" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_moderated_at"();

-- --- Policies ---

ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;

-- The blocker's alone. Blocking only needs the other person's user id, which
-- their public profile carries.
CREATE POLICY "user_blocks_own" ON "public"."user_blocks" FOR ALL TO "authenticated"
    USING ("blocker_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("blocker_id" = (SELECT "auth"."uid"()));

-- Public profiles, minus moderated ones. Signed-out visitors can't block, so
-- their policy needs no helper; signed-in readers also lose profiles on
-- either side of a block. Owners and their bars still read their own through
-- profiles_select_own.
DROP POLICY "profiles_select_public" ON "public"."profiles";
CREATE POLICY "profiles_select_public_anon" ON "public"."profiles" FOR SELECT TO "anon"
    USING ("is_public" AND "moderated_at" IS NULL);
CREATE POLICY "profiles_select_public" ON "public"."profiles" FOR SELECT TO "authenticated"
    USING (
        "is_public" AND "moderated_at" IS NULL
        AND ("user_id" IS NULL OR "user_id" NOT IN (SELECT "private"."blocked_user_ids"()))
    );

-- get_drink_rankings (20260926000600): unchanged apart from skipping
-- moderated venue profiles.
CREATE OR REPLACE FUNCTION "public"."get_drink_rankings"(
    "p_ranked_as_item_id" "uuid",
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_postcode" "text" DEFAULT NULL,
    "p_limit" integer DEFAULT 20
) RETURNS TABLE("position" bigint, "venue_profile_id" "uuid", "handle" "text", "display_name" "text",
                "locality" "text", "city" "text", "score" numeric, "rankers" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT row_number() OVER (ORDER BY v.score DESC, v.rankers DESC), p.id, p.handle, p.display_name,
         p.locality, p.city, v.score, v.rankers
  FROM private.venue_drink_scores v
  JOIN public.profiles p ON p.id = v.venue_profile_id
  WHERE v.ranked_as_item_id = p_ranked_as_item_id
    AND v.rankers >= private.ranking_min_rankers()
    AND p.is_public
    AND p.moderated_at IS NULL
    AND (p_country_code IS NULL OR p.country_code = upper(p_country_code))
    AND (p_city IS NULL OR lower(p.city) = lower(p_city))
    AND (p_postcode IS NULL OR p.postcode = p_postcode)
  ORDER BY v.score DESC, v.rankers DESC
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "private"."blocked_user_ids"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."blocked_user_ids"() TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."guard_moderated_at"() FROM PUBLIC, "anon", "authenticated";
