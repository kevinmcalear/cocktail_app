-- Invite a person the app already knows, found by name (Kept-team, Invite >
-- By email: "a name finds people already on the app"). The sender picks a
-- person's page and never sees their email: this function looks the email up
-- and hands the invite to the two functions that already make invites, so
-- every rule they hold applies unchanged (the staff permission, nothing above
-- the inviter's own role, the daily limits, Admins only for an Admin).
--
--   * public.invite_profile_to_bar(profile, bar, role level, [venue role],
--     [note]): true when it made an invite, false when the person was
--     already on the team and just got the new built-in role. With a venue
--     role it is invite_to_role (a custom role such as Takeover bartender);
--     without, add_user_to_bar_by_email. The profile must be a public person
--     page with an account. Anyone without the staff permission at the bar
--     gets the same refusal whatever the profile. Someone with it can tell a
--     page with an account from one without, which public.profiles.is_claimed
--     already shows everyone, and an invite is the person's to accept.
--
-- send-bar-invite takes a profile_id in place of an email for the same reason
-- (edge function, deployed by hand): it resolves the email itself and never
-- returns it. It also names the venue role in the email when the invite has
-- one, where it said only the role's built-in level.

CREATE FUNCTION "public"."invite_profile_to_bar"("p_profile_id" "uuid", "p_bar_id" "uuid", "p_role_level" integer, "p_role_id" "uuid" DEFAULT NULL, "p_note" "text" DEFAULT NULL) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_name text;
    v_email text;
    v_member public.user_bars;
BEGIN
    IF p_bar_id IS NULL OR p_bar_id NOT IN (SELECT private.bars_with_capability('staff')) THEN
        RAISE EXCEPTION 'You need the invite and manage staff permission to add members.' USING ERRCODE = '42501';
    END IF;

    SELECT p.display_name, lower(au.email) INTO v_name, v_email
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.user_id
    WHERE p.id = p_profile_id AND p.kind = 'person' AND p.is_public;
    IF v_email IS NULL THEN
        RAISE EXCEPTION 'They haven''t joined the app yet. Invite them by email.' USING ERRCODE = '22023';
    END IF;

    IF p_role_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.venue_roles WHERE id = p_role_id AND bar_id = p_bar_id) THEN
            RAISE EXCEPTION 'That role isn''t one of this bar''s.' USING ERRCODE = '22023';
        END IF;
        PERFORM public.invite_to_role(v_email, p_role_id, v_name, p_note);
        RETURN true;
    END IF;

    v_member := public.add_user_to_bar_by_email(v_email, p_bar_id, p_role_level, v_name, p_note);
    RETURN v_member.user_id IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION "public"."invite_profile_to_bar"("uuid", "uuid", integer, "uuid", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."invite_profile_to_bar"("uuid", "uuid", integer, "uuid", "text") TO "authenticated", "service_role";
