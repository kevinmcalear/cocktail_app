-- Bar setup changes that touch an existing function and team membership
-- (Kevin's, Kept-team):
--
--   answer_join_request()  Yes adds the person at the role the bar's staff
--                          link says (bars.staff_link_role, 20261206300000)
--                          instead of always Bartender, in the same step, so
--                          nobody is a Bartender for a moment first.
--   bar_owner()            New. Tells the bar's team who owns it: the person
--                          whose claim of the bar was approved. Team says
--                          Owner on their row. profile_claims stays readable
--                          only by the claimant.

CREATE OR REPLACE FUNCTION "public"."answer_join_request"("p_id" uuid, "p_accept" boolean) RETURNS void
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
    INSERT INTO public.user_bars (user_id, bar_id, role_level)
    SELECT v_row.user_id, v_row.bar_id, b.staff_link_role FROM public.bars b WHERE b.id = v_row.bar_id
    ON CONFLICT (user_id, bar_id) DO NOTHING;
    DELETE FROM public.venue_join_requests WHERE id = p_id;
END;
$$;

-- The bar's owner, for anyone on its team; null for anyone else, or a bar
-- nobody has claimed.
CREATE FUNCTION "public"."bar_owner"("p_bar_id" uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT c.user_id FROM public.profile_claims c
  WHERE c.bar_id = p_bar_id AND c.status = 'approved'
    AND p_bar_id IN (SELECT private.my_bar_ids(0))
  ORDER BY c.reviewed_at DESC NULLS LAST
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION "public"."bar_owner"(uuid) FROM "public", "anon";
GRANT EXECUTE ON FUNCTION "public"."bar_owner"(uuid) TO "authenticated", "service_role";
