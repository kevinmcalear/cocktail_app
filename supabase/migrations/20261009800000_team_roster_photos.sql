-- My team shows each member's photo. get_bar_members adds avatar_url: the
-- photo they set in Settings, else their public profile's picture.
--
-- The Settings photo lives in the user's own auth metadata, which they can set
-- to anything, so it only counts when it points at their own folder in the
-- avatars bucket (where Settings uploads it), not at any picture on the web.
-- ponytail: the host isn't checked, since the database doesn't know its own
-- public URL. Upgrade path: store the storage path and build the URL here.
--
-- Return type changes, so the function has to be dropped first.

DROP FUNCTION "public"."get_bar_members"("p_bar_id" "uuid");

CREATE FUNCTION "public"."get_bar_members"("p_bar_id" "uuid")
RETURNS TABLE(
    "user_id" "uuid",
    "email" "text",
    "role_level" integer,
    "display_name" "text",
    "joined_at" timestamp with time zone,
    "avatar_url" "text"
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
            CASE
                WHEN au.raw_user_meta_data->>'avatar_url'
                     LIKE '%/storage/v1/object/public/avatars/' || ub.user_id::TEXT || '/%'
                THEN au.raw_user_meta_data->>'avatar_url'
            END,
            p.avatar_url
        )
    FROM public.user_bars ub
    JOIN auth.users au ON ub.user_id = au.id
    LEFT JOIN public.profiles p ON p.user_id = ub.user_id AND p.kind = 'person'
    WHERE ub.bar_id = p_bar_id
      AND NOT EXISTS (
          SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now()
      );
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") TO "authenticated", "service_role";
