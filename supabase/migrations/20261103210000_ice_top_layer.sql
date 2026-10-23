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
-- one. The editor now lets the build go when a single ice is picked
-- (hooks/useCocktailEditor.ts). Here, on every write of a drink:
--
--   * a build sets ice_id to its top layer
--   * a new ice_id written on its own becomes the build's top layer, so a
--     writer that only knows ice_id (merge_item moving a merged ice, an
--     import) keeps the two in step without losing the layers under it
--
-- refresh_ice_build redrew the drink only when a write named ice_build; it
-- now fires on any change to it, so a top layer moved here redraws too.
-- Production has no builds yet, so no row needs fixing.
--
-- No RLS changes: items keeps its policies and table grants.

CREATE FUNCTION "private"."keep_ice_top_layer"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.ice_build IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.ice_build IS NOT DISTINCT FROM OLD.ice_build AND NEW.ice_id IS DISTINCT FROM OLD.ice_id THEN
        -- A new ice on its own: it is the top layer now (no ice at all is no build).
        NEW.ice_build := CASE WHEN NEW.ice_id IS NULL THEN NULL
                              ELSE jsonb_set(NEW.ice_build, ARRAY[(jsonb_array_length(NEW.ice_build) - 1)::text, 'ice'], to_jsonb(NEW.ice_id::text)) END;
    ELSE
        NEW.ice_id := (NEW.ice_build -> -1 ->> 'ice')::uuid;
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
