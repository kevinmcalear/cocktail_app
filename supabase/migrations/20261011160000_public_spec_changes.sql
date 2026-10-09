-- A bar can show the public how its specs changed. Local stack only until
-- Kevin's OK.
--
-- Spec versions (20261001170000_versions_and_notes.sql) are the team's: read
-- with the specs capability. A bar that publishes its specs may want guests to
-- see how a drink got where it is, so:
--   * bars.show_spec_changes, off by default. Changing it needs the publish
--     permission, like page_visibility.
--   * public.public_spec_changes(item): the versions of one drink for someone
--     outside the venue, when its bar turned this on and the drink is
--     published with its spec (private.published_listing, so a locked or
--     names-only page, a private drink, a moderated one or a blocked maker
--     shows none). Signed in only: signed out never sees a spec.
--     Each snapshot is cut down to what the public spec already shows:
--     ingredients by their generic (as app_recipe_presentation shows a
--     public reader), named only when that ingredient is in the shared
--     catalog or published in its own right (a private house prep is not),
--     amounts, units, optional, at service, methods, glass and ice. No
--     preparation notes, bartender notes, dilution or service style, and no
--     version notes or who saved it.

ALTER TABLE "public"."bars" ADD COLUMN "show_spec_changes" boolean DEFAULT false NOT NULL;

CREATE FUNCTION "private"."guard_bar_show_spec_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.show_spec_changes IS NOT DISTINCT FROM OLD.show_spec_changes OR auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.id NOT IN (SELECT private.bars_with_capability('publish')) THEN
        RAISE EXCEPTION 'Showing spec changes to the public needs the publish permission.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_bar_show_spec_changes" BEFORE UPDATE OF "show_spec_changes" ON "public"."bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_bar_show_spec_changes"();

-- ponytail: one setting per bar, not per drink. Upgrade path: an
-- items.show_spec_changes override, read here with COALESCE, if a bar wants
-- some drinks' history kept back.
CREATE FUNCTION "public"."public_spec_changes"("p_item" "uuid")
    RETURNS TABLE ("version" integer, "snapshot" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT v.version,
    jsonb_build_object(
      'lines', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'ingredient_item_id', g.id,
          'name', CASE WHEN (g.bar_id IS NULL AND g.created_by IS NULL) OR EXISTS (SELECT 1 FROM private.published_listing pl WHERE pl.id = g.id) THEN g.name END,
          'amount', l.value -> 'amount',
          'unit', l.value -> 'unit',
          'note', NULL,
          'optional', l.value -> 'optional',
          'at_service', l.value -> 'at_service') ORDER BY l.ordinality)
        FROM jsonb_array_elements(v.snapshot -> 'lines') WITH ORDINALITY l
        LEFT JOIN public.items s ON s.id = (l.value ->> 'ingredient_item_id')::uuid
        LEFT JOIN public.items g ON g.id = COALESCE(s.generic_id, s.id)), '[]'::jsonb),
      'methods', COALESCE(v.snapshot -> 'methods', '[]'::jsonb),
      'glass', v.snapshot -> 'glass',
      'ice', v.snapshot -> 'ice',
      'notes', NULL,
      'dilution_pct', NULL,
      'service_style', NULL),
    v.created_at
  FROM public.item_versions v
  JOIN private.published_listing p ON p.id = v.item_id AND p.effective_mode = 'spec'
  JOIN public.bars b ON b.id = p.bar_id AND b.show_spec_changes
  WHERE v.item_id = p_item AND auth.uid() IS NOT NULL
  ORDER BY v.version DESC;
$$;

REVOKE ALL ON FUNCTION "public"."public_spec_changes"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."public_spec_changes"("uuid") TO "authenticated", "service_role";
