-- A failed AI call shouldn't use up anyone's daily allowance.
--
-- Quota is taken before calling the model, so concurrent calls can't overrun
-- a limit. When the call then fails without producing anything, these hand the
-- unit back. (When Imagen was shut down, 25 automatic sketches failed twice
-- each and used all of a venue's 50 for the day without drawing anything.)

-- Hands back the payer's most recent unit for p_fn from the last 24 hours:
-- a venue's when p_bar_id is set, otherwise that user's personal one.
-- Service role only.
CREATE FUNCTION "public"."refund_ai_quota"("p_user_id" "uuid", "p_bar_id" "uuid", "p_fn" "text") RETURNS void
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  DELETE FROM private.ai_usage
  WHERE id = (
    SELECT u.id FROM private.ai_usage u
    WHERE u.fn = p_fn
      AND u.created_at > now() - interval '24 hours'
      AND CASE
        WHEN p_bar_id IS NOT NULL THEN u.bar_id = p_bar_id
        ELSE u.bar_id IS NULL AND u.user_id = p_user_id
      END
    ORDER BY u.created_at DESC
    LIMIT 1
  );
$$;

-- The same for an automatic image, with the payer worked out as
-- consume_item_ai_quota does: the item's venue, else its creator.
CREATE FUNCTION "public"."refund_item_ai_quota"("p_item_id" "uuid", "p_fn" "text") RETURNS void
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT public.refund_ai_quota(i.created_by, i.bar_id, p_fn)
  FROM public.items i
  WHERE i.id = p_item_id AND (i.bar_id IS NOT NULL OR i.created_by IS NOT NULL);
$$;

REVOKE EXECUTE ON FUNCTION "public"."refund_ai_quota"("p_user_id" "uuid", "p_bar_id" "uuid", "p_fn" "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."refund_item_ai_quota"("p_item_id" "uuid", "p_fn" "text") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."refund_ai_quota"("p_user_id" "uuid", "p_bar_id" "uuid", "p_fn" "text") TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."refund_item_ai_quota"("p_item_id" "uuid", "p_fn" "text") TO "service_role";
