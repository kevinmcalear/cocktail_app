-- DRAFT. Local stack only. Not applied to production; needs Kevin's review.
--
-- People's photos of a drink. Anyone signed in (and age-confirmed) can add a
-- photo to a drink page they can see. It's credited to them ("Photo by Jo"),
-- and when they've ranked the drink they can show their score with it
-- ("ranked it 8.4").
--
--   drink_photos              one row per photo: the drink, who posted it,
--                             the picture (an images row in the drinks
--                             bucket) and, optionally, their rank entry.
--   get_drink_photos(item)    the photos on a drink page, newest first, with
--                             the poster's public name and their score when
--                             they chose to show it.
--
-- Safety follows the public layer's rules: photos from people on either side
-- of a block are left out, a moderator can hide one (moderated_at, which the
-- poster can't undo), and a photo can be reported (target_kind 'photo').
-- rank_entries stays the owner's alone: the score comes through a helper that
-- returns only the score of the entry the poster attached to the photo.

CREATE TABLE "public"."drink_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "image_id" "uuid" NOT NULL REFERENCES "public"."images"("id") ON DELETE CASCADE,
    -- Their ranking of this drink, shown with the photo. NULL: no score shown.
    "rank_entry_id" "uuid" REFERENCES "public"."rank_entries"("id") ON DELETE SET NULL,
    -- Set by a moderator. Only catalog admins can set or clear it.
    "moderated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE INDEX "drink_photos_item_id_idx" ON "public"."drink_photos" ("item_id", "created_at" DESC);
CREATE INDEX "drink_photos_user_id_idx" ON "public"."drink_photos" ("user_id", "created_at" DESC);
CREATE INDEX "drink_photos_image_id_idx" ON "public"."drink_photos" ("image_id");
CREATE INDEX "drink_photos_rank_entry_id_idx" ON "public"."drink_photos" ("rank_entry_id");

-- Photos the caller posted in the last day, for the insert policy's daily
-- limit. A helper because a policy can't count its own table.
CREATE FUNCTION "private"."my_drink_photos_today"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT count(*) FROM public.drink_photos WHERE user_id = auth.uid() AND created_at > now() - interval '1 day';
$$;

-- The poster's score for the rank entry they attached to a photo, and nothing
-- else from their list. NULL when no entry is attached.
CREATE FUNCTION "private"."drink_photo_score"("p_photo_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT s.score
  FROM public.drink_photos dp
  JOIN public.rank_entry_scores s ON s.id = dp.rank_entry_id AND s.user_id = dp.user_id
  WHERE dp.id = p_photo_id;
$$;

-- Only moderators set moderated_at; the poster can't hide or restore their
-- own photo that way (they can delete it).
CREATE FUNCTION "private"."guard_drink_photo"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.moderated_at IS DISTINCT FROM OLD.moderated_at AND auth.role() <> 'service_role' AND NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only moderators can hide or restore a photo.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_drink_photo" BEFORE UPDATE ON "public"."drink_photos"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_drink_photo"();

ALTER TABLE "public"."drink_photos" ENABLE ROW LEVEL SECURITY;

-- Your own photos, and everyone's visible photos of a drink you can see.
CREATE POLICY "drink_photos_select" ON "public"."drink_photos" FOR SELECT TO "authenticated"
    USING (
        "user_id" = (SELECT "auth"."uid"())
        OR "private"."is_app_admin"()
        OR ("moderated_at" IS NULL
            AND "user_id" NOT IN (SELECT "private"."blocked_user_ids"())
            AND EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "drink_photos"."item_id"))
    );

-- A photo of a drink you can see, posted as yourself once your age is
-- confirmed, at most 20 a day. A score can only come from your own ranking
-- of this drink.
CREATE POLICY "drink_photos_insert" ON "public"."drink_photos" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "moderated_at" IS NULL
        AND "private"."is_age_confirmed"()
        AND EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "drink_photos"."item_id")
        AND ("rank_entry_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."rank_entries" "r"
            WHERE "r"."id" = "drink_photos"."rank_entry_id" AND "r"."user_id" = (SELECT "auth"."uid"()) AND "r"."item_id" = "drink_photos"."item_id"
        ))
        AND "private"."my_drink_photos_today"() < 20
    );

-- Moderators hide photos through set_content_hidden().
CREATE POLICY "drink_photos_update" ON "public"."drink_photos" FOR UPDATE TO "authenticated"
    USING ("private"."is_app_admin"());

CREATE POLICY "drink_photos_delete" ON "public"."drink_photos" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()) OR "private"."is_app_admin"());

-- The photos on a drink page, newest first. Runs as the caller, so the
-- policies above decide what's in it; a poster's name comes back only while
-- their profile is one the caller may read.
CREATE FUNCTION "public"."get_drink_photos"("p_item_id" "uuid", "p_limit" integer DEFAULT 30)
    RETURNS TABLE(
        "id" "uuid", "image_url" "text", "created_at" timestamp with time zone, "is_mine" boolean,
        "poster_handle" "text", "poster_name" "text", "poster_avatar_url" "text", "score" numeric
    )
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT dp.id, im.url, dp.created_at, dp.user_id = auth.uid(),
         p.handle, p.display_name, p.avatar_url,
         private.drink_photo_score(dp.id)
  FROM public.drink_photos dp
  JOIN public.images im ON im.id = dp.image_id
  LEFT JOIN public.profiles p ON p.user_id = dp.user_id AND p.kind = 'person'
  WHERE dp.item_id = p_item_id AND dp.moderated_at IS NULL
  ORDER BY dp.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- --- Reports ---

ALTER TABLE "public"."reports"
    ADD COLUMN "photo_id" "uuid" REFERENCES "public"."drink_photos"("id") ON DELETE SET NULL;
CREATE INDEX "reports_photo_id_idx" ON "public"."reports" ("photo_id");

-- A photo report names the photo and the drink it's on.
ALTER TABLE "public"."reports" DROP CONSTRAINT "reports_target_shape";
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_target_shape" CHECK (CASE "target_kind"
    WHEN 'profile' THEN "item_id" IS NULL AND "release_id" IS NULL AND "comment_id" IS NULL AND "photo_id" IS NULL
    WHEN 'item' THEN "profile_id" IS NULL AND "release_id" IS NULL AND "comment_id" IS NULL AND "photo_id" IS NULL
    WHEN 'release' THEN "profile_id" IS NULL AND "item_id" IS NULL AND "comment_id" IS NULL AND "photo_id" IS NULL
    WHEN 'comment' THEN "profile_id" IS NULL AND "item_id" IS NULL AND "release_id" IS NULL AND "photo_id" IS NULL
    WHEN 'ranking' THEN "release_id" IS NULL AND "comment_id" IS NULL AND "photo_id" IS NULL
    WHEN 'photo' THEN "profile_id" IS NULL AND "release_id" IS NULL AND "comment_id" IS NULL
END);

-- One open report per person per target, now telling photos apart.
DROP INDEX "public"."reports_one_open_key";
CREATE UNIQUE INDEX "reports_one_open_key" ON "public"."reports"
    ("reporter_id", "target_kind", "profile_id", "item_id", "release_id", "comment_id", "photo_id") NULLS NOT DISTINCT
    WHERE "status" = 'open';

-- reports_insert (20260930500300) plus photos. A photo can be reported while
-- the reporter can see it, or when it's from someone they've blocked (people
-- often block first and report second).
CREATE FUNCTION "private"."can_report_photo"("p_photo_id" "uuid", "p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drink_photos dp
    WHERE dp.id = p_photo_id AND dp.item_id = p_item_id
      AND (dp.moderated_at IS NULL
           OR dp.user_id IN (SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid()))
  );
$$;

DROP POLICY "reports_insert" ON "public"."reports";
CREATE POLICY "reports_insert" ON "public"."reports" FOR INSERT TO "authenticated"
    WITH CHECK (
        "reporter_id" = (SELECT "auth"."uid"())
        AND "status" = 'open' AND "resolution" IS NULL AND "reviewed_by" IS NULL AND "reviewed_at" IS NULL
        AND CASE "target_kind"
            WHEN 'profile' THEN "private"."can_report_profile"("profile_id")
            WHEN 'item' THEN
                EXISTS (SELECT 1 FROM "public"."published_items" "p" WHERE "p"."id" = "reports"."item_id" AND NOT "p"."is_reference")
                OR EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "reports"."item_id")
            WHEN 'release' THEN EXISTS (SELECT 1 FROM "public"."releases" "r" WHERE "r"."id" = "reports"."release_id")
            WHEN 'comment' THEN "comment_id" IS NOT NULL
            WHEN 'ranking' THEN "item_id" IS NOT NULL AND EXISTS (
                SELECT 1 FROM "public"."profiles" "p"
                WHERE "p"."id" = "reports"."profile_id" AND "p"."kind" = 'bar' AND "p"."is_public"
            )
            WHEN 'photo' THEN "private"."can_report_photo"("photo_id", "item_id")
        END
        AND "private"."my_reports_today"() < 20
    );

-- set_content_hidden and resolve_report (20260930500300) plus photos.
CREATE OR REPLACE FUNCTION "public"."set_content_hidden"("p_kind" "public"."report_target", "p_id" "uuid", "p_hidden" boolean) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_at TIMESTAMPTZ := CASE WHEN p_hidden THEN now() END;
BEGIN
    IF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only moderators can hide or restore content.';
    END IF;
    CASE p_kind
        WHEN 'profile' THEN UPDATE public.profiles SET moderated_at = v_at WHERE id = p_id;
        WHEN 'item' THEN UPDATE public.items SET moderated_at = v_at WHERE id = p_id;
        WHEN 'release' THEN UPDATE public.releases SET moderated_at = v_at WHERE id = p_id;
        WHEN 'photo' THEN UPDATE public.drink_photos SET moderated_at = v_at WHERE id = p_id;
        ELSE RAISE EXCEPTION 'Hiding isn''t available for % yet.', p_kind;
    END CASE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nothing to hide with that id.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."resolve_report"(
    "p_report_id" "uuid",
    "p_status" "public"."report_status",
    "p_resolution" "text" DEFAULT NULL,
    "p_hide" boolean DEFAULT false
) RETURNS "public"."reports"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_report public.reports;
BEGIN
    IF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only moderators can resolve reports.';
    END IF;
    IF p_status = 'open' THEN
        RAISE EXCEPTION 'Resolve a report as actioned or dismissed.';
    END IF;

    UPDATE public.reports
    SET status = p_status, resolution = p_resolution, reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_report_id AND status = 'open'
    RETURNING * INTO v_report;
    IF v_report.id IS NULL THEN
        RAISE EXCEPTION 'No open report with that id.';
    END IF;

    IF p_hide THEN
        PERFORM public.set_content_hidden(
            v_report.target_kind,
            CASE v_report.target_kind
                WHEN 'profile' THEN v_report.profile_id
                WHEN 'item' THEN v_report.item_id
                WHEN 'release' THEN v_report.release_id
                WHEN 'photo' THEN v_report.photo_id
            END,
            true
        );
    END IF;

    RETURN v_report;
END;
$$;

-- get_report_queue (20260930500500) plus photos: the photo's id and picture,
-- the drink it's on as the name, and who posted it as the detail.
DROP FUNCTION "public"."get_report_queue"(boolean, integer);
CREATE FUNCTION "public"."get_report_queue"("p_open" boolean DEFAULT true, "p_limit" integer DEFAULT 50)
    RETURNS TABLE("id" "uuid", "target_kind" "public"."report_target", "reason" "public"."report_reason",
                  "details" "text", "status" "public"."report_status", "resolution" "text",
                  "created_at" timestamp with time zone, "reviewed_at" timestamp with time zone,
                  "profile_id" "uuid", "item_id" "uuid", "release_id" "uuid", "comment_id" "uuid",
                  "target_name" "text", "target_detail" "text", "target_hidden" boolean,
                  "photo_id" "uuid", "photo_url" "text")
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
               WHEN 'photo' THEN CASE WHEN dp.id IS NOT NULL THEN i.name END
           END,
           CASE r.target_kind
               WHEN 'profile' THEN '@' || p.handle || CASE p.kind WHEN 'bar' THEN ' · bar' ELSE ' · person' END
               WHEN 'item' THEN COALESCE(ib.name, ip.display_name)
               WHEN 'release' THEN relb.name
               WHEN 'ranking' THEN p.display_name
               WHEN 'photo' THEN 'Photo by ' || COALESCE('@' || pp.handle, 'someone without a profile')
           END,
           CASE r.target_kind
               WHEN 'profile' THEN p.moderated_at IS NOT NULL
               WHEN 'item' THEN i.moderated_at IS NOT NULL
               WHEN 'release' THEN rel.moderated_at IS NOT NULL
               WHEN 'ranking' THEN p.moderated_at IS NOT NULL
               WHEN 'photo' THEN dp.moderated_at IS NOT NULL
               ELSE false
           END,
           r.photo_id, dpi.url
    FROM public.reports r
    LEFT JOIN public.profiles p ON p.id = r.profile_id
    LEFT JOIN public.items i ON i.id = r.item_id
    LEFT JOIN public.bars ib ON ib.id = i.bar_id
    LEFT JOIN public.profiles ip ON ip.user_id = i.created_by AND i.bar_id IS NULL
    LEFT JOIN public.releases rel ON rel.id = r.release_id
    LEFT JOIN public.bars relb ON relb.id = rel.bar_id
    LEFT JOIN public.drink_photos dp ON dp.id = r.photo_id
    LEFT JOIN public.images dpi ON dpi.id = dp.image_id
    LEFT JOIN public.profiles pp ON pp.user_id = dp.user_id AND pp.kind = 'person'
    WHERE (r.status = 'open') = p_open
    ORDER BY CASE WHEN p_open THEN r.created_at END ASC, r.created_at DESC
    LIMIT least(greatest(coalesce(p_limit, 50), 1), 200);
END;
$$;

-- --- Grants ---

REVOKE ALL ON "public"."drink_photos" FROM "anon";
REVOKE TRUNCATE, TRIGGER, REFERENCES ON "public"."drink_photos" FROM "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."my_drink_photos_today"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."my_drink_photos_today"() TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."drink_photo_score"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."drink_photo_score"("uuid") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."can_report_photo"("uuid", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."can_report_photo"("uuid", "uuid") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."guard_drink_photo"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."get_drink_photos"("uuid", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_drink_photos"("uuid", integer) TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."get_report_queue"(boolean, integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_report_queue"(boolean, integer) TO "authenticated", "service_role";
