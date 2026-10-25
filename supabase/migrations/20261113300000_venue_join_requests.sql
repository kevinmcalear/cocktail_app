-- Ask to join a bar's team (find-yourself step 6): someone signed in asks a
-- claimed bar's venue to let them in, and the venue's team managers (the
-- 'staff' capability, Admins by default) accept them as a Bartender or say no.
-- Until now only an invite or a bar claim put someone on a team.
--
--   venue_join_requests   one row per person and venue. Accepting adds the
--                         user_bars row (Bartender, 30) and deletes the
--                         request; declining keeps it with declined_at, so
--                         the same person can't ask that venue again.
--
-- Rows change only through request_to_join_venue() and answer_join_request().
-- The person reads their own; a venue's team managers read theirs through
-- join_requests(), which adds who is asking.

CREATE TABLE "public"."venue_join_requests" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "bar_id" uuid NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "user_id" uuid DEFAULT auth.uid() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "declined_at" timestamp with time zone,
    CONSTRAINT "venue_join_requests_bar_user_key" UNIQUE ("bar_id", "user_id")
);

CREATE INDEX "venue_join_requests_waiting_idx" ON "public"."venue_join_requests" ("bar_id") WHERE "declined_at" IS NULL;
CREATE INDEX "venue_join_requests_user_idx" ON "public"."venue_join_requests" ("user_id");

ALTER TABLE "public"."venue_join_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_join_requests_select" ON "public"."venue_join_requests" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT auth.uid()) OR "bar_id" IN (SELECT private.bars_with_capability('staff')));

REVOKE ALL ON TABLE "public"."venue_join_requests" FROM "anon", "public";
REVOKE ALL ON TABLE "public"."venue_join_requests" FROM "authenticated";
GRANT SELECT ON TABLE "public"."venue_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."venue_join_requests" TO "service_role";

-- --- Asking ---

-- Ask the venue behind a claimed bar page to let the caller in. Returns the
-- request (the existing one if they already asked).
CREATE FUNCTION "public"."request_to_join_venue"("p_bar_profile_id" uuid) RETURNS "public"."venue_join_requests"
    LANGUAGE plpgsql SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar uuid;
    v_row public.venue_join_requests;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to ask to join a team.' USING ERRCODE = '42501';
    END IF;
    SELECT p.bar_id INTO v_bar FROM public.profiles p
    WHERE p.id = p_bar_profile_id AND p.kind = 'bar' AND p.is_claimed AND p.moderated_at IS NULL;
    IF v_bar IS NULL THEN
        RAISE EXCEPTION 'That bar isn''t on Cocktail with a team yet.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_bars WHERE user_id = auth.uid() AND bar_id = v_bar) THEN
        RAISE EXCEPTION 'You''re already on this team.';
    END IF;

    -- One request at a time per person, so a double tap can't pass the cap below twice.
    PERFORM pg_advisory_xact_lock(hashtextextended('request_to_join_venue:' || auth.uid()::text, 0));
    SELECT * INTO v_row FROM public.venue_join_requests WHERE bar_id = v_bar AND user_id = auth.uid();
    IF v_row.id IS NOT NULL THEN
        IF v_row.declined_at IS NOT NULL THEN
            RAISE EXCEPTION 'The team said no last time. Ask its Admin for an invite.';
        END IF;
        RETURN v_row;
    END IF;
    -- A handful at once is plenty for a real bartender; more looks like spam.
    IF (SELECT count(*) FROM public.venue_join_requests WHERE user_id = auth.uid() AND declined_at IS NULL) >= 5 THEN
        RAISE EXCEPTION 'You''ve asked five teams already. Wait for one to answer.';
    END IF;

    INSERT INTO public.venue_join_requests (bar_id, user_id) VALUES (v_bar, auth.uid())
    RETURNING * INTO v_row;
    RETURN v_row;
END;
$$;

-- --- Answering ---

-- Requests waiting at a venue the caller manages the team of, with who is
-- asking: their person page when they have one, else the name on their account.
CREATE FUNCTION "public"."join_requests"("p_bar_id" uuid) RETURNS TABLE (
    "id" uuid,
    "created_at" timestamp with time zone,
    "user_id" uuid,
    "name" text,
    "avatar_url" text,
    "profile_handle" text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT r.id, r.created_at, r.user_id,
         COALESCE(NULLIF(btrim(p.display_name), ''), private.member_display_name(r.user_id)),
         p.avatar_url, p.handle
  FROM public.venue_join_requests r
  LEFT JOIN LATERAL (
    SELECT pp.display_name, pp.avatar_url, pp.handle FROM public.profiles pp
    WHERE pp.user_id = r.user_id AND pp.kind = 'person' LIMIT 1
  ) p ON true
  WHERE r.bar_id = p_bar_id AND r.declined_at IS NULL
    AND p_bar_id IN (SELECT private.bars_with_capability('staff'))
  ORDER BY r.created_at;
$$;

-- Yes makes them a Bartender at the venue; no keeps the request, declined.
CREATE FUNCTION "public"."answer_join_request"("p_id" uuid, "p_accept" boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_row public.venue_join_requests;
BEGIN
    SELECT * INTO v_row FROM public.venue_join_requests WHERE id = p_id AND declined_at IS NULL FOR UPDATE;
    IF v_row.id IS NULL OR v_row.bar_id NOT IN (SELECT private.bars_with_capability('staff')) THEN
        RAISE EXCEPTION 'That request isn''t waiting on you.';
    END IF;
    IF NOT p_accept THEN
        UPDATE public.venue_join_requests SET declined_at = now() WHERE id = p_id;
        RETURN;
    END IF;
    -- Already on the team (an invite got there first): keep their role.
    INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES (v_row.user_id, v_row.bar_id, 30)
    ON CONFLICT (user_id, bar_id) DO NOTHING;
    DELETE FROM public.venue_join_requests WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."request_to_join_venue"(uuid) FROM "public", "anon";
REVOKE ALL ON FUNCTION "public"."join_requests"(uuid) FROM "public", "anon";
REVOKE ALL ON FUNCTION "public"."answer_join_request"(uuid, boolean) FROM "public", "anon";
GRANT EXECUTE ON FUNCTION "public"."request_to_join_venue"(uuid) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."join_requests"(uuid) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."answer_join_request"(uuid, boolean) TO "authenticated", "service_role";
