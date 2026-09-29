-- DRAFT (docs/publishing_moderation_proposal.md, section 4). Local stack only.
-- Not applied to production; needs Kevin's review first.
--
-- Reports: anyone signed in can report a profile, a published drink, a
-- release, a comment (once comments exist) or a bar's ranking on a list.
-- Reports are private to the reporter and to moderators (catalog admins); the
-- person reported, and everyone else, can't read them.
--
-- Moderators work through two functions:
--   resolve_report(report, status, resolution, hide)
--       closes a report as 'actioned' or 'dismissed', and optionally hides
--       the reported profile, drink or release (moderated_at);
--   set_content_hidden(kind, id, hidden)
--       hides or restores a profile, drink or release directly.
-- A hidden profile, drink or release drops out of every public read path
-- (published_items, app_recipe_presentation, public profiles, live releases,
-- get_drink_rankings), and its owner can't undo that.

CREATE TYPE "public"."report_target" AS ENUM ('profile', 'item', 'release', 'comment', 'ranking');
CREATE TYPE "public"."report_reason" AS ENUM (
    'spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm',
    'under_age', 'impersonation', 'misleading', 'fake_rankings', 'other'
);
CREATE TYPE "public"."report_status" AS ENUM ('open', 'actioned', 'dismissed');

CREATE TABLE "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    -- Kept when the reporter deletes their account, for the moderation record.
    "reporter_id" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "target_kind" "public"."report_target" NOT NULL,
    -- What's reported. 'ranking' uses item_id for the list ("martinis") and
    -- profile_id for the bar. The target columns go NULL if the target is
    -- deleted; the report stays.
    "profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    "item_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    "release_id" "uuid" REFERENCES "public"."releases"("id") ON DELETE SET NULL,
    -- ponytail: no comments table yet; add the foreign key when there is one.
    "comment_id" "uuid",
    "reason" "public"."report_reason" NOT NULL,
    "details" "text" CHECK (char_length("details") <= 1000),
    "status" "public"."report_status" DEFAULT 'open' NOT NULL,
    -- Shown to the reporter: what happened.
    "resolution" "text" CHECK (char_length("resolution") <= 1000),
    "reviewed_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    -- Only the columns for the report's kind.
    CONSTRAINT "reports_target_shape" CHECK (CASE "target_kind"
        WHEN 'profile' THEN "item_id" IS NULL AND "release_id" IS NULL AND "comment_id" IS NULL
        WHEN 'item' THEN "profile_id" IS NULL AND "release_id" IS NULL AND "comment_id" IS NULL
        WHEN 'release' THEN "profile_id" IS NULL AND "item_id" IS NULL AND "comment_id" IS NULL
        WHEN 'comment' THEN "profile_id" IS NULL AND "item_id" IS NULL AND "release_id" IS NULL
        WHEN 'ranking' THEN "release_id" IS NULL AND "comment_id" IS NULL
    END),
    CONSTRAINT "reports_review_shape" CHECK (("status" = 'open') = ("reviewed_at" IS NULL))
);

-- One open report per person per target: a second tap doesn't pile up.
CREATE UNIQUE INDEX "reports_one_open_key" ON "public"."reports"
    ("reporter_id", "target_kind", "profile_id", "item_id", "release_id", "comment_id") NULLS NOT DISTINCT
    WHERE "status" = 'open';
CREATE INDEX "reports_queue_idx" ON "public"."reports" ("status", "created_at");
CREATE INDEX "reports_reporter_id_idx" ON "public"."reports" ("reporter_id", "created_at" DESC);
CREATE INDEX "reports_profile_id_idx" ON "public"."reports" ("profile_id");
CREATE INDEX "reports_item_id_idx" ON "public"."reports" ("item_id");
CREATE INDEX "reports_release_id_idx" ON "public"."reports" ("release_id");

-- A profile can be reported when the reporter can see it, or when it's
-- someone they've blocked (blocking hides the profile, and people often
-- block first and report second).
CREATE FUNCTION "private"."can_report_profile"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id
      AND (p.is_public
           OR p.user_id IN (SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid()))
  );
$$;

-- Reports the caller filed in the last day, for the insert policy's daily
-- limit. A helper because a policy can't query its own table.
CREATE FUNCTION "private"."my_reports_today"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT count(*) FROM public.reports WHERE reporter_id = auth.uid() AND created_at > now() - interval '1 day';
$$;

-- --- Moderation ---

CREATE FUNCTION "public"."set_content_hidden"("p_kind" "public"."report_target", "p_id" "uuid", "p_hidden" boolean) RETURNS void
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
        ELSE RAISE EXCEPTION 'Hiding isn''t available for % yet.', p_kind;
    END CASE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nothing to hide with that id.';
    END IF;
END;
$$;

CREATE FUNCTION "public"."resolve_report"(
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
            END,
            true
        );
    END IF;

    RETURN v_report;
END;
$$;

-- --- Policies ---

ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;

-- The reporter sees their own (to know what happened); moderators see all.
CREATE POLICY "reports_select" ON "public"."reports" FOR SELECT TO "authenticated"
    USING ("reporter_id" = (SELECT "auth"."uid"()) OR "private"."is_app_admin"());

-- A new, open report about something the reporter can see, at most 20 a day.
-- Changes go through resolve_report(); nobody edits or deletes reports.
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
        END
        AND "private"."my_reports_today"() < 20
    );

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "private"."my_reports_today"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."my_reports_today"() TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."can_report_profile"("p_profile_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."can_report_profile"("p_profile_id" "uuid") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."set_content_hidden"("p_kind" "public"."report_target", "p_id" "uuid", "p_hidden" boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."set_content_hidden"("p_kind" "public"."report_target", "p_id" "uuid", "p_hidden" boolean) TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."resolve_report"("p_report_id" "uuid", "p_status" "public"."report_status", "p_resolution" "text", "p_hide" boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."resolve_report"("p_report_id" "uuid", "p_status" "public"."report_status", "p_resolution" "text", "p_hide" boolean) TO "authenticated", "service_role";
