-- A bar edits the drinks credited to it.
--
-- Kevin, 13 Oct: "Yes, let bars edit those drinks too." Researched bar
-- originals are shared drinks credited to the bar (no venue, no creator,
-- origin_bar_profile_id set: private.is_bar_credited_drink). Only catalog
-- admins could edit them, so Caretaker's Cottage could see its own drinks on
-- its menus and not fix a single spec.
--
-- Now a Drink Creator (35) or above at the bar whose page a drink is
-- credited to can edit it, the same level that edits the venue's own drinks:
-- the drink row (name, description, notes, price and the other credited
-- details, which their triggers keep where they belong) and everything that
-- follows private.can_edit_item (recipe, steps, methods, pictures, prep,
-- service notes, categories, attributes, substitutions, co-creators) and
-- save_maker_sketch.
--
-- The drink stays shared and credited. The staff can't take it: a credited
-- drink's bar_id and created_by change only by SQL or a catalog admin
-- (guard_credited_drink_owner), and the policy's check keeps the credit on a
-- bar they edit at. Deleting it, the catalog flag, the family tree, the
-- classic mark, publishing and moderation keep their own admin-only guards.

CREATE FUNCTION "private"."can_edit_credited"("p_bar_id" "uuid", "p_is_catalog" boolean, "p_created_by" "uuid", "p_origin_bar_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT auth.uid() IS NOT NULL
    AND private.is_bar_credited_drink(p_bar_id, p_is_catalog, p_created_by, p_origin_bar_profile_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_origin_bar_profile_id AND p.kind = 'bar'
        AND p.bar_id IN (SELECT private.my_bar_ids(35))
    );
$$;

REVOKE EXECUTE ON FUNCTION "private"."can_edit_credited"("uuid", boolean, "uuid", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."can_edit_credited"("uuid", boolean, "uuid", "uuid") TO "authenticated";

CREATE OR REPLACE FUNCTION "private"."can_edit_item"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (SELECT private.can_write(bar_id, created_by)
         OR private.can_edit_credited(bar_id, is_catalog, created_by, origin_bar_profile_id)
       FROM public.items WHERE id = p_item_id),
    false
  );
$$;

DROP POLICY "items_update" ON "public"."items";
CREATE POLICY "items_update" ON "public"."items" FOR UPDATE TO "authenticated"
    USING (
        "private"."can_write"("bar_id", "created_by")
        OR "private"."can_edit_credited"("bar_id", "is_catalog", "created_by", "origin_bar_profile_id")
    )
    WITH CHECK (
        "private"."can_write"("bar_id", "created_by")
        OR "private"."can_edit_credited"("bar_id", "is_catalog", "created_by", "origin_bar_profile_id")
    );

-- Editing a credited drink never makes it someone's own: without this, a
-- staff member could set created_by to themselves (or bar_id to their venue)
-- and pass can_write on the new row.
CREATE FUNCTION "private"."guard_credited_drink_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    IF private.is_bar_credited_drink(OLD.bar_id, OLD.is_catalog, OLD.created_by, OLD.origin_bar_profile_id)
       AND (NEW.bar_id IS DISTINCT FROM OLD.bar_id OR NEW.created_by IS DISTINCT FROM OLD.created_by) THEN
        RAISE EXCEPTION 'A drink credited to a bar stays shared.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."guard_credited_drink_owner"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_credited_drink_owner" BEFORE UPDATE OF "bar_id", "created_by" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_credited_drink_owner"();

-- Drawing a drink's sketch follows the same rule (it checked can_write).
CREATE OR REPLACE FUNCTION "public"."save_maker_sketch"("p_item_id" "uuid", "p_inputs" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.items i
        WHERE i.id = p_item_id AND i.item_type = 'cocktail' AND private.can_edit_item(i.id)
    ) THEN
        RETURN false;
    END IF;
    IF NOT coalesce(private.valid_sketch_inputs(p_inputs), false) THEN
        RAISE EXCEPTION 'Those drawing inputs can''t be drawn.' USING ERRCODE = '22023';
    END IF;

    -- rules_version 0: no worker rules made it.
    INSERT INTO public.item_sketches AS s (item_id, inputs, source, spec_fingerprint, rules_version, updated_at)
    VALUES (p_item_id, p_inputs, 'maker', private.item_flavor_fingerprint(p_item_id), 0, now())
    ON CONFLICT (item_id) DO UPDATE SET
        inputs = excluded.inputs, source = 'maker', spec_fingerprint = excluded.spec_fingerprint,
        rules_version = 0, updated_at = now();
    RETURN true;
END;
$$;
