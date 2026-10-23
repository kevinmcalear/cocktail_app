-- A drink's ice and its ice build can't disagree (database audit, 22 Oct, 2.6).
--
-- The audit counted ice in three places on items. They are three facts, not
-- one: ice_id is the ice a drink is served over (332 drinks), method_ice_id
-- the ice it's made with (20261029100000), and ice_build how the ice sits,
-- layer by layer (20261029500000), whose top layer is ice_id. There is
-- nothing to backfill: a build says more than one ice does, so it can't be
-- made up from ice_id, and ice_id stays what everything that reads one ice
-- reads.
--
-- The one overlap is that top layer, and nothing kept it in step: picking a
-- single ice on a drink that had a build changed ice_id and left the build,
-- so the drink page showed the build's ice and the rest of the app the new
-- one. Now, on every write of a drink:
--
--   * a build sets ice_id to its top layer
--   * a new ice_id that isn't the build's top layer lets the build go: the
--     drink is served over one plain ice again
--
-- refresh_ice_build redrew the drink only when a write named ice_build; it
-- now fires on any change to it, so a build let go here redraws too.
--
-- No RLS changes: items keeps its policies and table grants.

CREATE FUNCTION "private"."keep_ice_top_layer"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_top uuid := (NEW.ice_build -> -1 ->> 'ice')::uuid;
BEGIN
    IF NEW.ice_build IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.ice_build IS NOT DISTINCT FROM OLD.ice_build
       AND NEW.ice_id IS DISTINCT FROM OLD.ice_id AND NEW.ice_id IS DISTINCT FROM v_top THEN
        NEW.ice_build := NULL;
    ELSE
        NEW.ice_id := v_top;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."keep_ice_top_layer"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "keep_ice_top_layer" BEFORE INSERT OR UPDATE OF "ice_id", "ice_build" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."keep_ice_top_layer"();

DROP TRIGGER "refresh_ice_build" ON "public"."items";
CREATE TRIGGER "refresh_ice_build" AFTER UPDATE ON "public"."items"
    FOR EACH ROW WHEN (OLD."ice_build" IS DISTINCT FROM NEW."ice_build")
    EXECUTE FUNCTION "private"."refresh_ice_build"();

-- Drinks whose build and ice already disagree keep the build (it is the
-- newer, fuller answer) and take its top layer as their ice.
UPDATE public.items
   SET ice_id = (ice_build -> -1 ->> 'ice')::uuid
 WHERE ice_build IS NOT NULL AND ice_id IS DISTINCT FROM (ice_build -> -1 ->> 'ice')::uuid;
