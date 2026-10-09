-- A maker's inbox: the drinks that credit its ice or glass and wait for its
-- team to say yes (after 20261011153000). A bar's drinks are often private to
-- the bar, so the team can't open them; this tells it which drink and which
-- bar, and nothing else, so it can confirm (confirm_maker_credit) or take the
-- credit off (a delete it's already allowed).

CREATE FUNCTION "public"."maker_credit_requests"("p_bar_id" "uuid")
RETURNS TABLE ("item_id" "uuid", "profile_id" "uuid", "makes" "text", "drink_name" "text", "credited_by" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT c.item_id, c.profile_id, c.makes, i.name,
           COALESCE(bp.display_name, b.name, op.display_name),
           c.created_at
      FROM public.item_maker_credits c
      JOIN public.profiles m ON m.id = c.profile_id AND m.kind = 'maker' AND m.bar_id = p_bar_id
      JOIN public.items i ON i.id = c.item_id
      LEFT JOIN public.bars b ON b.id = i.bar_id
      LEFT JOIN public.profiles bp ON bp.bar_id = i.bar_id AND bp.kind = 'bar'
      LEFT JOIN public.profiles op ON op.id = i.origin_bar_profile_id
     WHERE c.confirmed_at IS NULL
       AND p_bar_id IN (SELECT private.bars_with_capability('publish'))
     ORDER BY c.created_at DESC
     LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION "public"."maker_credit_requests"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."maker_credit_requests"("uuid") TO "authenticated", "service_role";
