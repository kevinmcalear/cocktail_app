-- Venue invites carry the invitee's name (7 Oct jam: an admin adds a name,
-- an email and a role). The name shows in the pending list and prefills the
-- invitee's own onboarding.
--
--   * bar_invites.name: optional, 1 to 80 characters, stored trimmed.
--   * add_user_to_bar_by_email gains p_name (default NULL), so callers that
--     send three arguments keep working. Re-inviting without a name keeps
--     the one already on the invite. A role change for a current member
--     ignores it: they already have a name.
--   * my_bar_invites(): the caller's own pending invites, with the venue's
--     name and its public bar profile (if it has one). An invitee can't read
--     the bars row before joining, so this is how onboarding says
--     "You're invited to <bar>".

ALTER TABLE "public"."bar_invites" ADD COLUMN "name" "text"
    CHECK ("name" IS NULL OR ("name" = btrim("name") AND char_length("name") BETWEEN 1 AND 80));

DROP FUNCTION "public"."add_user_to_bar_by_email"("text", "uuid", integer);

CREATE FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer, "p_name" "text" DEFAULT NULL) RETURNS "public"."user_bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_email TEXT := lower(btrim(p_email));
    v_name TEXT := nullif(btrim(p_name), '');
    v_member public.user_bars;
BEGIN
    IF p_bar_id IS NULL OR p_bar_id NOT IN (SELECT private.my_bar_ids(40)) THEN
        RAISE EXCEPTION 'You must be a bar Admin to add members.';
    END IF;

    IF p_role_level IS NULL OR NOT (p_role_level = ANY (ARRAY[10, 20, 30, 35, 40])) THEN
        RAISE EXCEPTION 'Invalid role level.';
    END IF;

    IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+$' THEN
        RAISE EXCEPTION 'Enter an email address.';
    END IF;

    IF char_length(v_name) > 80 THEN
        RAISE EXCEPTION 'Keep the name to 80 characters.';
    END IF;

    -- A current member: change their role. Admins already see members' emails.
    UPDATE public.user_bars ub
    SET role_level = p_role_level
    FROM auth.users au
    WHERE ub.bar_id = p_bar_id AND ub.user_id = au.id AND lower(au.email) = v_email
    RETURNING ub.* INTO v_member;

    IF FOUND THEN
        RETURN v_member;
    END IF;

    -- Anyone else: an invite, the same whether or not the email has an account.
    INSERT INTO public.bar_invites (bar_id, email, role_level, invited_by, name)
    VALUES (p_bar_id, v_email, p_role_level, auth.uid(), v_name)
    ON CONFLICT (bar_id, email)
    DO UPDATE SET role_level = EXCLUDED.role_level, invited_by = EXCLUDED.invited_by, created_at = now(),
        name = COALESCE(EXCLUDED.name, public.bar_invites.name);

    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."add_user_to_bar_by_email"("text", "uuid", integer, "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."add_user_to_bar_by_email"("text", "uuid", integer, "text") TO "authenticated", "service_role";

-- The caller's own invites, matched on their confirmed email like
-- accept_bar_invite. Nothing here the invitee couldn't learn by opening the
-- venue's staff link, except the bar profile id, which is public anyway.
CREATE FUNCTION "public"."my_bar_invites"() RETURNS TABLE (
    "id" "uuid",
    "bar_id" "uuid",
    "bar_name" "text",
    "bar_slug" "text",
    "bar_profile_id" "uuid",
    "role_level" integer,
    "name" "text",
    "created_at" timestamp with time zone
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT i.id, i.bar_id, b.name, b.slug, p.id, i.role_level, i.name, i.created_at
    FROM public.bar_invites i
    JOIN public.bars b ON b.id = i.bar_id
    LEFT JOIN public.profiles p ON p.bar_id = i.bar_id AND p.kind = 'bar'
    WHERE i.email = (
        SELECT lower(u.email) FROM auth.users u
        WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
    )
    ORDER BY i.created_at;
$$;

REVOKE EXECUTE ON FUNCTION "public"."my_bar_invites"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_bar_invites"() TO "authenticated", "service_role";
