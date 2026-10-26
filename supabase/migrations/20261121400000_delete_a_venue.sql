-- A venue's Admin can delete their venue (E53): public.delete_venue(bar id,
-- the venue's name typed back). Account deletion now removes a bar its last
-- member leaves behind the same way (private.remove_venue), instead of
-- deleting every row by hand.
--
-- What goes: the venue (bars row) and everything only its staff could see:
-- team, roles, invites, join requests, menus, run sheets, drafts, private
-- drinks and house-made recipes, kit, ice, glassware costs, suppliers, stock,
-- events, releases, calendar, allergen checks, comments and settings.
--
-- What stays, detached from the venue:
-- * The bar's public page (profiles row). It goes back to unclaimed, so the
--   page, its awards, credits to people who worked there and other people's
--   rankings "at" it stay, and it can be claimed again.
-- * Drinks the public could already see on that page (an open or description
--   page, not a private one or names only). They become research drinks of the
--   page again (no venue, no owner, description only), so rankings, made
--   drinks and credits to people on them stay. Their specs stop being public.
-- * The venue's own ingredients that a drink outside the venue uses, as a
--   name only (their recipe and prep are removed).
-- * Started menus, the page's public menu history: they move back to
--   profile_menu_editions, and saved copies follow them.
--
-- Picture files can't be removed from SQL. Their paths go into
-- private.storage_cleanup; scripts/storage-cleanup.mjs removes the ones
-- nothing points at any more.

-- --- audit ---
CREATE TABLE private.venue_deletions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id uuid NOT NULL,
    bar_name text NOT NULL,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reason text NOT NULL CHECK (reason IN ('admin', 'account_deleted')),
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    deleted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.venue_deletions ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE private.venue_deletions IS 'One row per deleted venue: who, why, and what stayed. Written by private.remove_venue.';

-- --- picture files to remove ---
CREATE TABLE private.storage_cleanup (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bucket_id text NOT NULL,
    name text NOT NULL,
    reason text NOT NULL,
    queued_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (bucket_id, name)
);
ALTER TABLE private.storage_cleanup ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE private.storage_cleanup IS 'Storage files that may be unused now. scripts/storage-cleanup.mjs removes each one nothing points at (public.storage_cleanup_batch checks).';

-- A storage URL (or the drinks thumbnail beside it) into the queue.
CREATE FUNCTION private.queue_storage_url(p_url text, p_reason text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
    WITH p AS (
        SELECT substring(p_url FROM '/storage/v1/(?:object|render/image)/(?:public|sign|authenticated)/([^?#]+)') AS path
    ), f AS (
        SELECT split_part(path, '/', 1) AS bucket_id, substr(path, strpos(path, '/') + 1) AS name
        FROM p WHERE path LIKE '%/%'
    )
    INSERT INTO private.storage_cleanup (bucket_id, name, reason)
    SELECT bucket_id, name, p_reason FROM f
    UNION ALL
    SELECT 'drinks', 'thumbs/' || regexp_replace(name, '\.[^./]+$', '') || '.jpg', p_reason FROM f WHERE bucket_id = 'drinks'
    ON CONFLICT (bucket_id, name) DO NOTHING;
$$;

-- Every file a row points at, as "bucket/name". The same columns as the
-- unreferenced_files check in scripts/db-health.mjs, plus the columns that
-- hold a bare path. A new column that stores pictures belongs in both.
CREATE FUNCTION private.storage_paths_in_use() RETURNS SETOF text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    WITH urls AS (
        SELECT url AS u FROM public.images
        UNION ALL SELECT source_url FROM public.images
        UNION ALL SELECT avatar_url FROM public.profiles
        UNION ALL SELECT logo_url FROM public.bars
        UNION ALL SELECT icon_url FROM public.bars
        UNION ALL SELECT icon_url FROM public.items
        UNION ALL SELECT photo_url FROM public.bar_zones
        UNION ALL SELECT photo_url FROM public.item_locations
        UNION ALL SELECT image_url FROM public.collected_items
        UNION ALL SELECT cover_url FROM public.collected_releases
        UNION ALL SELECT cover_url FROM public.releases
        UNION ALL SELECT cover_url FROM public.menus
        UNION ALL SELECT (regexp_matches(draft_data::text, '/storage/v1/[^"\s]+', 'g'))[1] FROM public.drafts
        UNION ALL SELECT (regexp_matches(snapshot::text, '/storage/v1/[^"\s]+', 'g'))[1] FROM public.item_versions
        UNION ALL SELECT (regexp_matches(snapshot::text, '/storage/v1/[^"\s]+', 'g'))[1] FROM private.profile_merges
    ), paths AS (
        SELECT substring(u FROM '/storage/v1/(?:object|render/image)/(?:public|sign|authenticated)/([^?#]+)') AS path
        FROM urls WHERE u IS NOT NULL
    )
    SELECT path FROM paths WHERE path IS NOT NULL
    UNION ALL
    SELECT 'drinks/thumbs/' || regexp_replace(substr(path, 8), '\.[^./]+$', '') || '.jpg' FROM paths WHERE path LIKE 'drinks/%'
    UNION ALL SELECT 'glass-photos/' || photo_path FROM public.bar_glassware WHERE photo_path IS NOT NULL
    UNION ALL SELECT 'glass-photos/' || photo_path FROM public.home_glassware WHERE photo_path IS NOT NULL
    UNION ALL SELECT 'feedback/' || photo_path FROM public.feedback_notes WHERE photo_path IS NOT NULL;
$$;

-- The next files to remove. Files something points at again leave the queue
-- and stay.
CREATE FUNCTION public.storage_cleanup_batch(p_limit integer DEFAULT 100)
    RETURNS TABLE (id bigint, bucket_id text, name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
    DELETE FROM private.storage_cleanup q
    WHERE q.bucket_id || '/' || q.name IN (SELECT private.storage_paths_in_use());
    RETURN QUERY
    SELECT q.id, q.bucket_id, q.name FROM private.storage_cleanup q
    ORDER BY q.id
    LIMIT least(greatest(coalesce(p_limit, 100), 1), 1000);
END;
$$;

-- Files the cleanup removed.
CREATE FUNCTION public.storage_cleanup_done(p_ids bigint[]) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
    DELETE FROM private.storage_cleanup WHERE id = ANY (p_ids);
$$;

REVOKE ALL ON FUNCTION private.queue_storage_url(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.storage_paths_in_use() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storage_cleanup_batch(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storage_cleanup_done(bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_cleanup_batch(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.storage_cleanup_done(bigint[]) TO service_role;

-- --- removing a venue ---
-- No permission checks: callers check first (delete_venue, prepare_account_deletion).
CREATE FUNCTION private.remove_venue(p_bar_id uuid, p_by uuid, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_bar public.bars;
    v_profile_id uuid;
    v_kept uuid[];
    v_shared uuid[];
    v_gone uuid[];
    v_images uuid[];
    v_menus integer := 0;
    v_edition uuid;
    v_summary jsonb;
    m record;
BEGIN
    SELECT * INTO v_bar FROM public.bars WHERE id = p_bar_id FOR UPDATE;
    IF v_bar.id IS NULL THEN
        RAISE EXCEPTION 'That venue has already been deleted.' USING ERRCODE = 'P0002';
    END IF;

    -- From here on this runs as the server, as account deletion does: the
    -- caller was checked, and the guards on drinks and pages that stop staff
    -- from moving drinks out of a venue don't apply to the venue's removal.
    -- Local to this transaction.
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    SELECT p.id INTO v_profile_id FROM public.profiles p
    WHERE p.bar_id = p_bar_id AND p.kind = 'bar'
    ORDER BY p.created_at LIMIT 1;

    -- Drinks the public could see on the bar's page, with a description (not
    -- names only): they stay on the page.
    SELECT coalesce(array_agg(l.id), '{}') INTO v_kept
    FROM private.published_listing l
    WHERE l.bar_id = p_bar_id AND NOT l.page_locked
      AND l.item_type IN ('cocktail', 'beer', 'wine');

    -- The venue's ingredients that a drink outside the venue uses.
    SELECT coalesce(array_agg(DISTINCT r.ingredient_item_id), '{}') INTO v_shared
    FROM public.recipes r
    JOIN public.items ing ON ing.id = r.ingredient_item_id AND ing.bar_id = p_bar_id
    JOIN public.items d ON d.id = r.recipe_item_id
    WHERE d.bar_id IS DISTINCT FROM p_bar_id
      AND NOT (ing.id = ANY (v_kept));

    SELECT coalesce(array_agg(i.id), '{}') INTO v_gone
    FROM public.items i
    WHERE i.bar_id = p_bar_id AND NOT (i.id = ANY (v_kept || v_shared));

    -- Picture files of everything that goes. The cleanup keeps any file
    -- something still points at (a page avatar can be the venue's logo).
    PERFORM private.queue_storage_url(f.u, 'venue deleted')
    FROM (
        SELECT v_bar.logo_url AS u
        UNION ALL SELECT v_bar.icon_url
        UNION ALL SELECT photo_url FROM public.bar_zones WHERE bar_id = p_bar_id
        UNION ALL SELECT photo_url FROM public.item_locations WHERE bar_id = p_bar_id
        UNION ALL SELECT cover_url FROM public.releases WHERE bar_id = p_bar_id
        UNION ALL SELECT cover_url FROM public.menus WHERE bar_id = p_bar_id
        UNION ALL SELECT icon_url FROM public.items WHERE id = ANY (v_gone)
        UNION ALL SELECT (regexp_matches(draft_data::text, '/storage/v1/[^"\s]+', 'g'))[1] FROM public.drafts WHERE bar_id = p_bar_id
        UNION ALL SELECT im.url FROM public.images im
            WHERE im.id IN (SELECT image_id FROM public.item_images WHERE item_id = ANY (v_gone)
                            UNION SELECT image_id FROM public.drink_photos WHERE item_id = ANY (v_gone))
    ) f
    WHERE f.u IS NOT NULL;

    SELECT coalesce(array_agg(DISTINCT x.image_id), '{}') INTO v_images
    FROM (
        SELECT image_id FROM public.item_images WHERE item_id = ANY (v_gone)
        UNION ALL SELECT image_id FROM public.drink_photos WHERE item_id = ANY (v_gone)
    ) x
    WHERE x.image_id IS NOT NULL;

    -- Kept drinks become the page's research drinks; ingredients other
    -- drinks use keep their name only.
    DELETE FROM public.recipes WHERE recipe_item_id = ANY (v_shared);
    DELETE FROM public.item_prep WHERE item_id = ANY (v_shared);
    DELETE FROM public.item_steps WHERE item_id = ANY (v_shared);

    UPDATE public.items SET
        bar_id = NULL,
        created_by = NULL,
        override_visibility_level = NULL,
        -- On this page, where the public saw it, even if it credited another bar
        -- (that bar's page never listed the venue's copy).
        origin_bar_profile_id = CASE WHEN id = ANY (v_kept) THEN v_profile_id ELSE origin_bar_profile_id END,
        publish_mode = CASE WHEN id = ANY (v_kept) THEN 'description'::public.item_publish_mode ELSE publish_mode END
    WHERE id = ANY (v_kept || v_shared);

    -- Started menus are the page's public menu history: back to the page.
    IF v_profile_id IS NOT NULL THEN
        FOR m IN
            SELECT mn.id, left(btrim(mn.name), 120) AS name, left(mn.description, 300) AS theme,
                mn.starts_at AT TIME ZONE 'UTC' AS started_on,
                CASE WHEN mn.ends_at <= now() THEN (mn.ends_at - interval '1 microsecond') AT TIME ZONE 'UTC' END AS ended_on
            FROM public.menus mn
            WHERE mn.bar_id = p_bar_id AND mn.kind = 'menu' AND mn.starts_at <= now()
              AND btrim(mn.name) <> ''
            ORDER BY mn.starts_at
        LOOP
            INSERT INTO public.profile_menu_editions AS e (profile_id, name, year, month, end_year, end_month, is_current, theme)
            VALUES (
                v_profile_id, m.name,
                extract(year FROM m.started_on)::smallint, extract(month FROM m.started_on)::smallint,
                extract(year FROM m.ended_on)::smallint, extract(month FROM m.ended_on)::smallint,
                m.ended_on IS NULL, m.theme
            )
            ON CONFLICT ON CONSTRAINT profile_menu_editions_once DO UPDATE SET name = e.name
            RETURNING e.id INTO v_edition;

            INSERT INTO public.profile_menu_edition_drinks (edition_id, item_id, sort_order)
            SELECT v_edition, d.item_id,
                (SELECT coalesce(max(o.sort_order) + 1, 0) FROM public.profile_menu_edition_drinks o WHERE o.edition_id = v_edition)
                    + row_number() OVER (ORDER BY d.section_order, d.drink_order, d.item_id) - 1
            FROM (
                SELECT md.item_id, min(coalesce(ms.sort_order, 2147483647)) AS section_order, min(md.sort_order) AS drink_order
                FROM public.menu_drinks md
                LEFT JOIN public.menu_sections ms ON ms.id = md.menu_section_id
                JOIN public.items i ON i.id = md.item_id
                -- What page history holds (private.guard_menu_edition_drink).
                WHERE md.menu_id = m.id
                  AND i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id = v_profile_id
                GROUP BY md.item_id
            ) d
            ON CONFLICT DO NOTHING;

            UPDATE public.saved_menu_editions s SET menu_id = NULL, edition_id = v_edition
            WHERE s.menu_id = m.id
              AND NOT EXISTS (SELECT 1 FROM public.saved_menu_editions o WHERE o.user_id = s.user_id AND o.edition_id = v_edition);
            v_menus := v_menus + 1;
        END LOOP;

        -- The venue's glass photos are staff-only; the page's glasses stay without them.
        INSERT INTO private.storage_cleanup (bucket_id, name, reason)
        SELECT 'glass-photos', g.photo_path, 'venue deleted'
        FROM public.bar_glassware g
        WHERE g.profile_id = v_profile_id AND g.photo_path IS NOT NULL
        ON CONFLICT (bucket_id, name) DO NOTHING;
        UPDATE public.bar_glassware SET photo_path = NULL
        WHERE profile_id = v_profile_id AND photo_path IS NOT NULL;
    END IF;

    DELETE FROM public.drafts WHERE bar_id = p_bar_id;
    DELETE FROM public.menus WHERE bar_id = p_bar_id;

    DELETE FROM public.items WHERE id = ANY (v_gone);
    DELETE FROM public.images im
    WHERE im.id = ANY (v_images)
      AND NOT EXISTS (SELECT 1 FROM public.item_images x WHERE x.image_id = im.id)
      AND NOT EXISTS (SELECT 1 FROM public.drink_photos x WHERE x.image_id = im.id)
      AND NOT EXISTS (SELECT 1 FROM public.made_drinks x WHERE x.image_id = im.id);

    DELETE FROM private.rate_events WHERE bar_id = p_bar_id;

    v_summary := jsonb_build_object(
        'drinks_kept', cardinality(v_kept),
        'ingredients_kept', cardinality(v_shared),
        'items_deleted', cardinality(v_gone),
        'menus_to_page', v_menus
    );
    INSERT INTO private.venue_deletions (bar_id, bar_name, profile_id, deleted_by, reason, summary)
    VALUES (p_bar_id, v_bar.name, v_profile_id, p_by, p_reason, v_summary);

    -- Everything else the venue owns goes with it (ON DELETE CASCADE).
    DELETE FROM public.bars WHERE id = p_bar_id;

    -- The page is unclaimed again (its bar_id was cleared by the delete).
    IF v_profile_id IS NOT NULL THEN
        UPDATE public.profiles SET claimed_at = NULL WHERE id = v_profile_id;
    END IF;

    RETURN v_summary || jsonb_build_object('profile_id', v_profile_id);
END;
$$;
REVOKE ALL ON FUNCTION private.remove_venue(uuid, uuid, text) FROM PUBLIC;

-- --- delete a venue (its Admin) ---
CREATE FUNCTION public.delete_venue(p_bar_id uuid, p_confirm_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_name text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to delete a venue.' USING ERRCODE = '42501';
    END IF;
    -- One message for "not an Admin" and "no such venue".
    IF p_bar_id IS NULL OR p_bar_id NOT IN (SELECT private.my_bar_ids(40)) THEN
        RAISE EXCEPTION 'Only an Admin of this venue can delete it.' USING ERRCODE = '42501';
    END IF;
    SELECT name INTO v_name FROM public.bars WHERE id = p_bar_id FOR UPDATE;
    IF lower(btrim(coalesce(p_confirm_name, ''))) <> lower(btrim(v_name)) THEN
        RAISE EXCEPTION 'That isn''t this venue''s name. Type it as it''s shown to delete the venue.' USING ERRCODE = '22023';
    END IF;
    RETURN private.remove_venue(p_bar_id, auth.uid(), 'admin');
END;
$$;
REVOKE ALL ON FUNCTION public.delete_venue(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_venue(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.delete_venue(uuid, text) IS 'A venue''s Admin deletes the venue, typing its name back. See private.remove_venue for what goes and what stays.';

-- --- account deletion removes a solo bar the same way ---
CREATE OR REPLACE FUNCTION public.prepare_account_deletion(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_bar record;
BEGIN
    -- A bar must keep an admin: refuse while this user is the only admin of a
    -- bar that still has other members.
    FOR v_bar IN
        SELECT b.name
        FROM public.user_bars ub
        JOIN public.bars b ON b.id = ub.bar_id
        WHERE ub.user_id = p_user_id
          AND ub.role_level >= 40
          AND EXISTS (
              SELECT 1 FROM public.user_bars o
              WHERE o.bar_id = ub.bar_id AND o.user_id <> p_user_id
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.user_bars o
              WHERE o.bar_id = ub.bar_id AND o.user_id <> p_user_id AND o.role_level >= 40
          )
    LOOP
        RAISE EXCEPTION 'Make someone else an admin of % before deleting your account.', v_bar.name
            USING ERRCODE = 'P0001';
    END LOOP;

    -- Bars where this user is the only member leave with them, as if their
    -- Admin deleted the venue.
    FOR v_bar IN
        SELECT ub.bar_id AS id
        FROM public.user_bars ub
        WHERE ub.user_id = p_user_id
          AND NOT EXISTS (
              SELECT 1 FROM public.user_bars o
              WHERE o.bar_id = ub.bar_id AND o.user_id <> p_user_id
          )
    LOOP
        PERFORM private.remove_venue(v_bar.id, p_user_id, 'account_deleted');
    END LOOP;

    -- Personal menus are private working documents; delete them. Personal
    -- items can be ingredients in other people's recipes, so they stay and are
    -- anonymised by the created_by foreign key.
    DELETE FROM public.menus WHERE bar_id IS NULL AND created_by = p_user_id;
END;
$$;
