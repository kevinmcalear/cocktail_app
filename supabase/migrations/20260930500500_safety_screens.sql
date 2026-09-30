-- DRAFT (step 10b-3, the safety screens). Local stack only.
-- Not applied to production; needs Kevin's review first.
--
-- What the app's report, block and moderation screens need on top of
-- 20260930500000 to 20260930500400:
--
--   am_i_moderator()     whether the signed-in person is a catalog admin
--                        (private.app_admins), so Settings can link the
--                        moderator inbox. It says nothing about anyone else.
--   get_my_blocks()      the people I've blocked, with their public name. A
--                        block hides their profile from me both ways, so the
--                        "Blocked people" list can't read it from profiles.
--   get_report_queue()   moderators only: reports with a short summary of
--                        what's reported. A hidden drink or release leaves
--                        every read path moderators have, so the queue reads
--                        it here.
--   items_select         a person's own published drink is readable by
--                        others only when published_items would show it:
--                        not held by a moderator, not across a block, and
--                        with a public, unheld profile. Before this, the raw
--                        items read (drink pages, profiles) still showed a
--                        hidden drink, or a blocked person's.

CREATE FUNCTION "public"."am_i_moderator"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT private.is_app_admin();
$$;

-- Everyone the caller has blocked, newest first. The name and handle come
-- from their profile while it's public; the list still shows (without a
-- name) someone whose profile is private or gone, so they can be unblocked.
CREATE FUNCTION "public"."get_my_blocks"()
    RETURNS TABLE("blocked_id" "uuid", "profile_id" "uuid", "handle" "text", "display_name" "text",
                  "avatar_url" "text", "blocked_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT b.blocked_id, p.id, p.handle, p.display_name, p.avatar_url, b.created_at
  FROM public.user_blocks b
  LEFT JOIN public.profiles p ON p.user_id = b.blocked_id AND p.is_public
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;

-- The moderator inbox: open reports oldest first, or closed ones newest
-- first, each with what it's about. target_hidden is whether a moderator has
-- hidden it (for a ranking, the bar's profile); target_name is NULL when the
-- reported thing has been deleted. Reporters stay anonymous here.
CREATE FUNCTION "public"."get_report_queue"("p_open" boolean DEFAULT true, "p_limit" integer DEFAULT 50)
    RETURNS TABLE("id" "uuid", "target_kind" "public"."report_target", "reason" "public"."report_reason",
                  "details" "text", "status" "public"."report_status", "resolution" "text",
                  "created_at" timestamp with time zone, "reviewed_at" timestamp with time zone,
                  "profile_id" "uuid", "item_id" "uuid", "release_id" "uuid", "comment_id" "uuid",
                  "target_name" "text", "target_detail" "text", "target_hidden" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only moderators can read the report queue.';
    END IF;
    RETURN QUERY
    SELECT r.id, r.target_kind, r.reason, r.details, r.status, r.resolution, r.created_at, r.reviewed_at,
           r.profile_id, r.item_id, r.release_id, r.comment_id,
           CASE r.target_kind
               WHEN 'profile' THEN p.display_name
               WHEN 'item' THEN i.name
               WHEN 'release' THEN rel.name
               WHEN 'ranking' THEN i.name
           END,
           CASE r.target_kind
               WHEN 'profile' THEN '@' || p.handle || CASE p.kind WHEN 'bar' THEN ' · bar' ELSE ' · person' END
               WHEN 'item' THEN COALESCE(ib.name, ip.display_name)
               WHEN 'release' THEN relb.name
               WHEN 'ranking' THEN p.display_name
           END,
           CASE r.target_kind
               WHEN 'profile' THEN p.moderated_at IS NOT NULL
               WHEN 'item' THEN i.moderated_at IS NOT NULL
               WHEN 'release' THEN rel.moderated_at IS NOT NULL
               WHEN 'ranking' THEN p.moderated_at IS NOT NULL
               ELSE false
           END
    FROM public.reports r
    LEFT JOIN public.profiles p ON p.id = r.profile_id
    LEFT JOIN public.items i ON i.id = r.item_id
    LEFT JOIN public.bars ib ON ib.id = i.bar_id
    LEFT JOIN public.profiles ip ON ip.user_id = i.created_by AND i.bar_id IS NULL
    LEFT JOIN public.releases rel ON rel.id = r.release_id
    LEFT JOIN public.bars relb ON relb.id = rel.bar_id
    WHERE (r.status = 'open') = p_open
    ORDER BY CASE WHEN p_open THEN r.created_at END ASC, r.created_at DESC
    LIMIT least(greatest(coalesce(p_limit, 50), 1), 200);
END;
$$;

-- items_select (20260930500400), with a person's published drink following
-- the same rule as published_items for everyone but its creator and
-- moderators.
DROP POLICY "items_select" ON "public"."items";
CREATE POLICY "items_select" ON "public"."items" FOR SELECT TO "authenticated"
    USING (
        CASE
            WHEN "bar_id" IS NOT NULL THEN "private"."can_view_bar_item"("bar_id", "override_visibility_level")
            WHEN "created_by" IS NULL OR "item_type" NOT IN ('cocktail', 'beer', 'wine') THEN true
            ELSE "created_by" = (SELECT "auth"."uid"())
                OR "private"."is_app_admin"()
                OR ("publish_mode" IN ('description', 'spec')
                    AND "moderated_at" IS NULL
                    AND "created_by" NOT IN (SELECT "private"."blocked_user_ids"())
                    AND EXISTS (
                        SELECT 1 FROM "public"."profiles" "p"
                        WHERE "p"."user_id" = "items"."created_by" AND "p"."is_public" AND "p"."moderated_at" IS NULL
                    ))
        END
    );

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "public"."am_i_moderator"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."am_i_moderator"() TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."get_my_blocks"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_my_blocks"() TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."get_report_queue"("p_open" boolean, "p_limit" integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_report_queue"("p_open" boolean, "p_limit" integer) TO "authenticated", "service_role";
