-- drink_lineage: a drink's whole family in one call, for useLineage (hooks/useLineage.ts).
-- The drink page read it in 5 to 16 requests (the drink, its child classics,
-- its riffs twice, then one request per ancestor and the styles), and on
-- 1 Nov 2026 a browser opening drink pages quickly sent 161 of them in 90 s.
-- Additive: a new function, nothing else changes.
--
-- SECURITY INVOKER: items, item_credits, profiles and drink_styles are read
-- as the caller, so their RLS policies decide what shows, exactly as the
-- direct reads did. A parent the caller can't see ends the walk up the line.
-- Each drink comes back in the shape LINEAGE_COLUMNS reads (credits with
-- their profile, the origin bar).

CREATE OR REPLACE FUNCTION "public"."drink_lineage"("p_item_id" "uuid")
    RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
    WITH RECURSIVE up AS (
        -- The drink (depth 0), then what it's based on, up to 12 ancestors (lib/lineage.ts MAX_ANCESTORS).
        SELECT i.id, i.based_on_id, i.based_on_style_id, 0 AS depth, ARRAY[i.id] AS path
        FROM public.items i
        WHERE i.id = p_item_id
        UNION ALL
        SELECT p.id, p.based_on_id, p.based_on_style_id, up.depth + 1, up.path || p.id
        FROM up
        JOIN public.items p ON p.id = up.based_on_id
        WHERE up.depth < 12 AND NOT p.id = ANY (up.path)
    ), riffs AS (
        -- The 100 best-credited riffs: a lead creator or bar that said yes (or a moderator checked) first, then by name.
        SELECT r.id, row_number() OVER (ORDER BY r.sure DESC, r.name) AS ord
        FROM (
            SELECT i.id, i.name,
                EXISTS (
                    SELECT 1 FROM public.item_credits c
                    WHERE c.item_id = i.id AND c.role IN ('creator', 'bar') AND c.status IN ('accepted', 'verified')
                ) AS sure
            FROM public.items i
            WHERE i.based_on_id = p_item_id AND i.based_on_kind = 'riff'
            ORDER BY sure DESC, i.name
            LIMIT 100
        ) r
    ), picked AS (
        SELECT up.id, CASE WHEN up.depth = 0 THEN 'drink' ELSE 'ancestor' END AS part, -up.depth AS ord FROM up
        UNION ALL
        (SELECT i.id, 'classic', 0 FROM public.items i WHERE i.based_on_id = p_item_id AND i.based_on_kind = 'descends' LIMIT 500)
        UNION ALL
        SELECT riffs.id, 'riff', riffs.ord FROM riffs
    ), rows AS (
        SELECT picked.part, picked.ord, jsonb_build_object(
            'id', i.id, 'name', i.name,
            'based_on_id', i.based_on_id, 'based_on_kind', i.based_on_kind, 'based_on_style_id', i.based_on_style_id,
            'origin_year', i.origin_year, 'origin_year_approx', i.origin_year_approx, 'origin_year_guess', i.origin_year_guess,
            'origin', i.origin, 'is_catalog', i.is_catalog, 'lineage_note', i.lineage_note,
            'origin_bar', (
                SELECT jsonb_build_object('id', b.id, 'kind', b.kind, 'handle', b.handle, 'display_name', b.display_name,
                    'avatar_url', b.avatar_url, 'locality', b.locality, 'is_closed', b.is_closed, 'closed_year', b.closed_year)
                FROM public.profiles b WHERE b.id = i.origin_bar_profile_id
            ),
            'credits', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', c.id, 'role', c.role, 'what', c.what, 'profile_id', c.profile_id, 'name', c.name,
                    'sort_order', c.sort_order, 'status', c.status, 'disputed_at', c.disputed_at, 'dispute_note', c.dispute_note,
                    'profile', (
                        SELECT jsonb_build_object('id', p.id, 'kind', p.kind, 'handle', p.handle, 'display_name', p.display_name,
                            'avatar_url', p.avatar_url, 'locality', p.locality, 'is_closed', p.is_closed, 'closed_year', p.closed_year)
                        FROM public.profiles p WHERE p.id = c.profile_id
                    )
                ) ORDER BY c.sort_order, c.id)
                FROM public.item_credits c WHERE c.item_id = i.id
            ), '[]'::jsonb)
        ) AS row
        FROM picked
        JOIN public.items i ON i.id = picked.id
    )
    SELECT jsonb_build_object(
        'drink', (SELECT rows.row FROM rows WHERE rows.part = 'drink'),
        -- Root first; the last is what the drink is based on.
        'ancestors', COALESCE((SELECT jsonb_agg(rows.row ORDER BY rows.ord) FROM rows WHERE rows.part = 'ancestor'), '[]'::jsonb),
        'classics', COALESCE((SELECT jsonb_agg(rows.row) FROM rows WHERE rows.part = 'classic'), '[]'::jsonb),
        'riffs', COALESCE((SELECT jsonb_agg(rows.row ORDER BY rows.ord) FROM rows WHERE rows.part = 'riff'), '[]'::jsonb),
        -- Every historic style (about 25), only when the oldest drink in the line comes from one: the app walks the chain.
        'styles', CASE
            WHEN (SELECT up.based_on_style_id FROM up ORDER BY up.depth DESC LIMIT 1) IS NULL THEN '[]'::jsonb
            ELSE COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', s.id, 'key', s.key, 'name', s.name, 'family', s.family,
                    'parent_style_id', s.parent_style_id, 'year', s.year, 'year_approx', s.year_approx, 'summary', s.summary))
                FROM public.drink_styles s
            ), '[]'::jsonb)
        END
    );
$$;

REVOKE ALL ON FUNCTION "public"."drink_lineage"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."drink_lineage"("uuid") TO "anon", "authenticated", "service_role";
