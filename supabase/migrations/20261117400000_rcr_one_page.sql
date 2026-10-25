-- One page for RCR Cristalleria Italiana (Kevin, 25 Oct 2026, Open decisions
-- d43: "The one with more links"). Two maker pages were the same company:
-- `rcr.cristalleria.italiana` (20261011173000, glassware makers) and `rcr`
-- (20261017770000, Melbourne suppliers). In production on 25 Oct neither had
-- a glass in the catalog; three suppliers' lines pointed at `rcr` and two at
-- the other, so `rcr` stays and the other folds into it:
--
--   * Everything that points at the old page moves to `rcr`: suppliers'
--     lines, glasses (catalog and venues'), bottles, "glass by" credits,
--     brands, loves, hides, reports and claims. A row `rcr` already has (the
--     same supplier in the same region, say) is dropped and kept in
--     private.profile_merges.dropped.
--   * `rcr` takes the old page's fuller facts where they add something: the
--     company's full name, its city (Colle di Val d'Elsa), that it makes
--     barware too, and its logo, bio, website and Instagram where `rcr` has
--     none.
--   * The old page is kept in private.profile_merges, so /p/rcr.cristalleria.italiana
--     goes to /p/rcr (merged_profile_handle, 20261103300000), then deleted.
--     Anything else still pointing at it stops the migration: nothing is lost.
--   * Its logo file stays in the avatars bucket; the weekly health check lists
--     unused pictures.

DO $$
DECLARE
    v_from public.profiles;
    v_into public.profiles;
    v_dropped jsonb := '{}'::jsonb;
    v_rows jsonb;
    v_ref record;
    v_left boolean;
BEGIN
    SELECT * INTO v_from FROM public.profiles WHERE handle = 'rcr.cristalleria.italiana' AND kind = 'maker';
    SELECT * INTO v_into FROM public.profiles WHERE handle = 'rcr' AND kind = 'maker';
    -- Already one page (or a stack without one of them): nothing to do.
    IF v_from.id IS NULL OR v_into.id IS NULL THEN RETURN; END IF;
    IF v_from.user_id IS NOT NULL OR v_from.bar_id IS NOT NULL THEN
        RAISE EXCEPTION 'rcr.cristalleria.italiana has been claimed; merge it by hand.';
    END IF;

    -- Suppliers' lines: one per supplier and region.
    WITH gone AS (
        DELETE FROM public.supplier_lines f USING public.supplier_lines t
         WHERE f.maker_profile_id = v_from.id AND t.maker_profile_id = v_into.id
           AND t.supplier_profile_id = f.supplier_profile_id AND t.region = f.region
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('supplier_lines', v_rows) END;
    UPDATE public.supplier_lines SET maker_profile_id = v_into.id WHERE maker_profile_id = v_from.id;

    -- Catalog glasses: a glass `rcr` already has (name and size) keeps `rcr`'s,
    -- and venues that picked the old one follow it there.
    UPDATE public.bar_glassware b SET model_id = t.id
      FROM public.glass_models f
      JOIN public.glass_models t ON t.maker_profile_id = v_into.id
       AND public.ingredient_key(t.name) = public.ingredient_key(f.name) AND coalesce(t.capacity_ml, 0) = coalesce(f.capacity_ml, 0)
     WHERE f.maker_profile_id = v_from.id AND b.model_id = f.id;
    WITH gone AS (
        DELETE FROM public.glass_models f USING public.glass_models t
         WHERE f.maker_profile_id = v_from.id AND t.maker_profile_id = v_into.id
           AND public.ingredient_key(t.name) = public.ingredient_key(f.name) AND coalesce(t.capacity_ml, 0) = coalesce(f.capacity_ml, 0)
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('glass_models', v_rows) END;
    UPDATE public.glass_models SET maker_profile_id = v_into.id WHERE maker_profile_id = v_from.id;

    UPDATE public.bar_glassware SET maker_profile_id = v_into.id WHERE maker_profile_id = v_from.id;
    UPDATE public.items SET maker_profile_id = v_into.id WHERE maker_profile_id = v_from.id;
    UPDATE public.profiles SET part_of_profile_id = v_into.id WHERE part_of_profile_id = v_from.id AND id <> v_into.id;

    -- "Glass by" credits.
    WITH gone AS (
        DELETE FROM public.item_maker_credits f USING public.item_maker_credits t
         WHERE f.profile_id = v_from.id AND t.profile_id = v_into.id AND t.item_id = f.item_id AND t.makes = f.makes
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('item_maker_credits', v_rows) END;
    UPDATE public.item_maker_credits SET profile_id = v_into.id WHERE profile_id = v_from.id;

    -- People who loved or hid it.
    WITH gone AS (
        DELETE FROM public.loved_bars f USING public.loved_bars t
         WHERE f.profile_id = v_from.id AND t.profile_id = v_into.id AND t.user_id = f.user_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('loved_bars', v_rows) END;
    UPDATE public.loved_bars SET profile_id = v_into.id WHERE profile_id = v_from.id;
    WITH gone AS (
        DELETE FROM public.hidden_bars f USING public.hidden_bars t
         WHERE f.profile_id = v_from.id AND t.profile_id = v_into.id AND t.user_id = f.user_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('hidden_bars', v_rows) END;
    UPDATE public.hidden_bars SET profile_id = v_into.id WHERE profile_id = v_from.id;

    UPDATE public.reports SET profile_id = v_into.id WHERE profile_id = v_from.id;
    UPDATE public.profile_claims
       SET profile_id = v_into.id,
           evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object('merged_from', jsonb_build_object('id', v_from.id, 'handle', v_from.handle))
     WHERE profile_id = v_from.id;

    -- The fuller facts.
    UPDATE public.profiles SET
        display_name = v_from.display_name,
        city = coalesce(nullif(btrim(city), ''), v_from.city),
        makes = ARRAY(SELECT DISTINCT unnest(makes || v_from.makes) ORDER BY 1),
        avatar_url = coalesce(avatar_url, v_from.avatar_url),
        bio = coalesce(nullif(btrim(bio), ''), v_from.bio),
        website = coalesce(nullif(btrim(website), ''), v_from.website),
        instagram = coalesce(nullif(btrim(instagram), ''), v_from.instagram)
     WHERE id = v_into.id;

    -- Anything still pointing at the old page stops the migration.
    FOR v_ref IN
        SELECT c.conrelid::regclass AS tbl, a.attname AS col
          FROM pg_catalog.pg_constraint c
          JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
         WHERE c.contype = 'f' AND c.confrelid = 'public.profiles'::regclass AND cardinality(c.conkey) = 1
           AND c.conrelid <> 'private.profile_merges'::regclass
    LOOP
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', v_ref.tbl, v_ref.col) INTO v_left USING v_from.id;
        IF v_left THEN
            RAISE EXCEPTION 'Can''t merge the RCR pages: %.% still points at rcr.cristalleria.italiana.', v_ref.tbl, v_ref.col;
        END IF;
    END LOOP;

    INSERT INTO private.profile_merges (from_profile_id, into_profile_id, snapshot, dropped)
    VALUES (v_from.id, v_into.id, to_jsonb(v_from), v_dropped);
    DELETE FROM public.profiles WHERE id = v_from.id;
END;
$$;
