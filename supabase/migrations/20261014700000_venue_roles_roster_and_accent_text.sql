-- Venue tools to the canvas (11 Oct): the venue's own roles on the roster,
-- when a role last changed, and the brand's text colour on accent.
--
--   * user_bars.role_since: when the member's role last changed (level or the
--     venue's own role). The member sheet shows "Bartender since 1 Jun".
--     Existing rows start at the day they joined. A trigger keeps it current;
--     the app never writes it.
--   * get_bar_members() also returns the member's venue role (id, name and
--     end date) and role_since, so My team can show "Head bartender" instead
--     of the base level, and Roles and access can list guest staff with their
--     end dates. Same access rules and same rows as before.
--   * bars.accent_text: the text colour on accent buttons and the active tab,
--     'cream' or 'ink'. NULL keeps today's automatic pick. Members read it with
--     the rest of the brand; admins write it like every other brand column
--     (bars policies, unchanged).

-- --- Role since ---

ALTER TABLE "public"."user_bars" ADD COLUMN "role_since" timestamp with time zone DEFAULT "now"() NOT NULL;
UPDATE "public"."user_bars" SET "role_since" = "created_at" WHERE "created_at" IS NOT NULL;

-- Runs after sync_member_role_level (triggers on one event fire in name
-- order), so it sees the final role_level and venue_role_id.
CREATE FUNCTION "private"."touch_member_role_since"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.role_level IS DISTINCT FROM OLD.role_level
       OR NEW.venue_role_id IS DISTINCT FROM OLD.venue_role_id THEN
        NEW.role_since := now();
    ELSE
        NEW.role_since := OLD.role_since;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "touch_member_role_since" BEFORE UPDATE ON "public"."user_bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."touch_member_role_since"();

REVOKE EXECUTE ON FUNCTION "private"."touch_member_role_since"() FROM PUBLIC, "anon", "authenticated";

-- --- Roster with the venue's own roles ---

-- The return type changes, so the function is dropped and made again with the
-- same body (20261010700000) plus four columns.
DROP FUNCTION "public"."get_bar_members"("p_bar_id" "uuid");

CREATE FUNCTION "public"."get_bar_members"("p_bar_id" "uuid")
RETURNS TABLE(
    "user_id" "uuid",
    "email" "text",
    "role_level" integer,
    "display_name" "text",
    "joined_at" timestamp with time zone,
    "avatar_url" "text",
    "venue_role_id" "uuid",
    "venue_role_name" "text",
    "role_ends_at" timestamp with time zone,
    "role_since" timestamp with time zone
)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_role INT;
BEGIN
    SELECT ub.role_level INTO v_user_role
    FROM public.user_bars ub
    WHERE ub.bar_id = p_bar_id AND ub.user_id = auth.uid()
      AND NOT EXISTS (
          SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now()
      );

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'You do not have access to view this bar members.';
    END IF;

    RETURN QUERY
    SELECT
        ub.user_id,
        CASE
            WHEN v_user_role >= 40 OR ub.user_id = auth.uid() THEN au.email::TEXT
            ELSE NULL::TEXT
        END,
        ub.role_level,
        private.member_display_name(ub.user_id),
        ub.created_at,
        COALESCE(
            private.account_photo(ub.user_id),
            p.avatar_url
        ),
        vr.id,
        vr.name,
        vr.ends_at,
        ub.role_since
    FROM public.user_bars ub
    JOIN auth.users au ON ub.user_id = au.id
    LEFT JOIN public.profiles p ON p.user_id = ub.user_id AND p.kind = 'person'
    LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
    WHERE ub.bar_id = p_bar_id
      AND (vr.ends_at IS NULL OR vr.ends_at > now());
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") TO "authenticated", "service_role";

-- --- Text on accent ---

ALTER TABLE "public"."bars"
    ADD COLUMN "accent_text" "text",
    ADD CONSTRAINT "bars_accent_text_check" CHECK ("accent_text" IS NULL OR "accent_text" = ANY (ARRAY['cream', 'ink']));
