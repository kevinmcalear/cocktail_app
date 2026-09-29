-- Venue invites: a venue admin adds someone by email, and they join when they
-- accept, signed in with that email (on the venue's staff link, /v/<slug>).
--
-- add_user_to_bar_by_email keeps its signature, so the app and its callers
-- don't change:
--   * the email belongs to a current member: their role changes, as before.
--   * anyone else: an invite at that role, whether or not the email has an
--     account yet. The reply is the same either way; nobody joins a venue
--     until they accept.
-- accept_bar_invite() turns the caller's own invite into a membership.

CREATE TABLE "public"."bar_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    -- Stored lower-cased and trimmed, the way it's compared.
    "email" "text" NOT NULL CHECK ("email" = lower(btrim("email")) AND "email" ~ '^[^@\s]+@[^@\s]+$'),
    "role_level" integer NOT NULL CHECK ("role_level" = ANY (ARRAY[10, 20, 30, 35, 40])),
    "invited_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("bar_id", "email")
);
CREATE INDEX "bar_invites_email_idx" ON "public"."bar_invites" ("email");

ALTER TABLE "public"."bar_invites" ENABLE ROW LEVEL SECURITY;

-- The venue's admins see and cancel its invites; the invitee sees and declines
-- their own. Invites are only written by add_user_to_bar_by_email.
CREATE POLICY "bar_invites_select" ON "public"."bar_invites" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(40))
        OR "email" = lower((SELECT "auth"."jwt"() ->> 'email')));
CREATE POLICY "bar_invites_delete" ON "public"."bar_invites" FOR DELETE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(40))
        OR "email" = lower((SELECT "auth"."jwt"() ->> 'email')));

REVOKE ALL ON "public"."bar_invites" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, DELETE ON "public"."bar_invites" TO "authenticated";
GRANT ALL ON "public"."bar_invites" TO "service_role";

CREATE OR REPLACE FUNCTION "public"."add_user_to_bar_by_email"("p_email" "text", "p_bar_id" "uuid", "p_role_level" integer) RETURNS "public"."user_bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_email TEXT := lower(btrim(p_email));
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
    INSERT INTO public.bar_invites (bar_id, email, role_level, invited_by)
    VALUES (p_bar_id, v_email, p_role_level, auth.uid())
    ON CONFLICT (bar_id, email)
    DO UPDATE SET role_level = EXCLUDED.role_level, invited_by = EXCLUDED.invited_by, created_at = now();

    RETURN NULL;
END;
$$;

-- The caller joins a venue they're invited to, at the invited role. Their
-- account's own email has to match the invite.
CREATE FUNCTION "public"."accept_bar_invite"("p_bar_id" "uuid") RETURNS "public"."user_bars"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_email TEXT;
    v_invite public.bar_invites;
    v_member public.user_bars;
BEGIN
    SELECT lower(email) INTO v_email
    FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;

    DELETE FROM public.bar_invites
    WHERE bar_id = p_bar_id AND email = v_email
    RETURNING * INTO v_invite;

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'There''s no invite to this venue for your email.';
    END IF;

    INSERT INTO public.user_bars (user_id, bar_id, role_level)
    VALUES (auth.uid(), p_bar_id, v_invite.role_level)
    ON CONFLICT (user_id, bar_id) DO UPDATE SET role_level = EXCLUDED.role_level
    RETURNING * INTO v_member;

    RETURN v_member;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."accept_bar_invite"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."accept_bar_invite"("uuid") TO "authenticated", "service_role";
