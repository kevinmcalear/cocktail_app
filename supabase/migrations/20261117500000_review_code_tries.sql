-- App Review's fixed-code sign-in (supabase/functions/review-sign-in) counts
-- its tries here, in private.rate_events, so the lockout holds when many
-- requests arrive at once: each takes a try under a lock before its code is
-- compared, and only a right code gives its try back.
--
--   * take_review_code_try(): one try if fewer than 5 were taken in the last
--     15 minutes; returns its event id, or NULL while locked.
--   * give_back_review_code_try(id): the right code's try stops counting.
--
-- Both are for the service role only.

ALTER TABLE "private"."rate_events" DROP CONSTRAINT "rate_events_kind_check";
ALTER TABLE "private"."rate_events" ADD CONSTRAINT "rate_events_kind_check"
    CHECK ("kind" IN ('invite', 'invite_email', 'venue_create', 'rank', 'rank_comparison', 'review_code'));

CREATE FUNCTION "public"."take_review_code_try"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_id bigint;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('review-code', 0));
    IF (SELECT count(*) FROM private.rate_events
        WHERE kind = 'review_code' AND created_at > now() - interval '15 minutes') >= 5 THEN
        RETURN NULL;
    END IF;
    INSERT INTO private.rate_events (kind) VALUES ('review_code') RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE FUNCTION "public"."give_back_review_code_try"("p_id" bigint) RETURNS void
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  DELETE FROM private.rate_events WHERE id = p_id AND kind = 'review_code';
$$;

REVOKE EXECUTE ON FUNCTION "public"."take_review_code_try"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."take_review_code_try"() TO "service_role";
REVOKE EXECUTE ON FUNCTION "public"."give_back_review_code_try"(bigint) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."give_back_review_code_try"(bigint) TO "service_role";
