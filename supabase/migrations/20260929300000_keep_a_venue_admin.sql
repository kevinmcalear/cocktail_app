-- A venue keeps at least one Admin while it has other members.
--
-- prepare_account_deletion() already refuses to delete the account of a
-- venue's only admin (20260924000000). This applies the same rule to every
-- change to user_bars: demoting the last admin, the last admin leaving, or a
-- venue role's base level dropping below Admin. It only fires when an admin
-- row stops being one, so venues that have no admin today aren't blocked.
--
-- Allowed: the last admin leaving a venue nobody else is in, and deleting the
-- venue itself (its memberships go with it).

CREATE FUNCTION "private"."keep_a_venue_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_name TEXT;
BEGIN
    IF OLD.role_level < 40
       OR (TG_OP = 'UPDATE' AND NEW.role_level >= 40 AND NEW.bar_id = OLD.bar_id) THEN
        RETURN NULL;
    END IF;

    -- One change at a time per venue, so two admins can't demote each other at
    -- once. A venue that's being deleted is already gone: nothing to keep.
    SELECT name INTO v_name FROM public.bars WHERE id = OLD.bar_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM public.user_bars WHERE bar_id = OLD.bar_id)
       AND NOT EXISTS (SELECT 1 FROM public.user_bars WHERE bar_id = OLD.bar_id AND role_level >= 40) THEN
        RAISE EXCEPTION 'Make someone else an Admin of % first. A venue needs at least one Admin.', v_name;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER "keep_a_venue_admin" AFTER UPDATE OR DELETE ON "public"."user_bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."keep_a_venue_admin"();

REVOKE EXECUTE ON FUNCTION "private"."keep_a_venue_admin"() FROM PUBLIC, "anon", "authenticated";
