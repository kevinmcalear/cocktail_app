-- Data tidy from the 27 Oct 2026 database health check (npm run db:health).
--
-- 1. Caretaker's Cottage has "Lemon Drop Batch" five times. The 8 Aug one is
--    the batch its Lemon Drop uses (Pisco, Pierre Ferrand Dry Curaçao,
--    Osmanthus Lillet Blanc, Meyer Lemon, Saline) and stays. The 30 Jul
--    10:33 one has the same five lines with a plain Curaçao and nothing uses
--    it; the three made 30 Jul 14:00 to 14:02 are a name and a drawing, with
--    no spec, and nothing points at them. All four merge into the kept one
--    (private.merge_ingredient): their specs go, as it has its own.
--
-- 2. "Noble One Semillion" there twice, 3 seconds apart on 8 Aug: the bottle
--    (the Lemon Drop uses it) and a house-made item whose one line is that
--    bottle, used by nothing. The wrapper's line goes first, so the bottle
--    doesn't take a line pointing at itself, then it merges into the bottle.
--
--    merge_ingredient moves every row, drawings too, so each copy's own
--    generated drawing goes first: the kept one has its own. Ingredient
--    merges keep no item_merges record, as the 8 Oct ones didn't.
--
-- 3. "Shaky Pete's Ginger Brew" twice on Hawksmoor Spitalfields' page: the
--    catalog classic 20261121500000 added (2008, its source and story) and
--    the older copy the bar awards seed made (30 Sep). As the 22 Oct tidy
--    did for 17 such pairs (20261102100000), the classic is kept and the
--    copy merges into it: what points at the copy (its readable link) moves,
--    and its own spec, drawing, notes and figures go, kept in item_merges.
--
-- 4. "Eddie's Bar" was a test of venue setup on 26 Oct (Kevin, 27 Oct). Its
--    workspace and the bar page added in setup's first step are renamed
--    "Eddie's Bar (Demo)" and hidden the way Demo Bar (App Review) is: the
--    workspace's page Locked, and the bar page no longer public, so it is off
--    Discover and search. (An unlinked page's own setting always reads
--    'description': set_profile_page_visibility takes it from its workspace.)
--    They stay unlinked.
--
-- Every step names production ids checked read-only on 27 Oct 2026 and only
-- acts while the rows still look as they did then, so a rerun, or a row
-- already gone, changes nothing.

SET "app.image_worker" = 'on';

DO $$
DECLARE
    v_caretakers constant uuid := '532e5250-161e-4439-b8d1-9dd4b403ef19';
    v_bottle constant uuid := 'f8928523-c57e-4569-b4ca-1513d5455f3f';
    v_hawksmoor constant uuid := 'faf2e0dc-cf99-4c0c-a28a-7776e043a098';
    v_classic constant uuid := '6f6a2451-8a74-4fd4-8bb0-e4c02b21cc92';
    v_copy constant uuid := '5e5a848d-a796-4f41-93fc-6ad97672f478';
    v_images uuid[];
    r record;
BEGIN
    -- --- 1 and 2. Lemon Drop Batch and Noble One Semillion ---
    FOR r IN
        SELECT c.id AS from_id, k.id AS into_id
        FROM (VALUES
            -- copy, kept, name
            ('8836c29b-fdcf-4062-8946-de08ab086377', '7019d072-e326-47e9-9653-8764bc0fb9b2', 'Lemon Drop Batch'),
            ('0c7c2ee4-e4bd-482a-9e44-2b7d613ebf7f', '7019d072-e326-47e9-9653-8764bc0fb9b2', 'Lemon Drop Batch'),
            ('c3efd5f3-5a0f-4bf0-a731-8f8a32aec91d', '7019d072-e326-47e9-9653-8764bc0fb9b2', 'Lemon Drop Batch'),
            ('f77881e5-1c44-4259-ae77-556a482c42cb', '7019d072-e326-47e9-9653-8764bc0fb9b2', 'Lemon Drop Batch'),
            ('66bce21c-7fce-492a-a33c-9192081ea701', 'f8928523-c57e-4569-b4ca-1513d5455f3f', 'Noble One Semillion')
        ) AS v(from_id, into_id, name)
        JOIN public.items c ON c.id = v.from_id::uuid
        JOIN public.items k ON k.id = v.into_id::uuid
        -- Still the same ingredient at Caretaker's Cottage, and still used by
        -- nothing but its own spec and drawing.
        WHERE c.name = v.name AND k.name = v.name
          AND c.item_type = 'ingredient' AND k.item_type = 'ingredient'
          AND c.bar_id = v_caretakers AND k.bar_id = v_caretakers
          AND NOT EXISTS (SELECT 1 FROM public.recipes x WHERE x.ingredient_item_id = c.id)
          AND NOT EXISTS (SELECT 1 FROM public.menu_drinks x WHERE x.item_id = c.id)
          AND NOT EXISTS (SELECT 1 FROM public.back_bar_items x WHERE x.item_id = c.id)
    LOOP
        IF r.into_id = v_bottle THEN
            -- Nothing but the bottle in it, or it stays.
            CONTINUE WHEN EXISTS (SELECT 1 FROM public.recipes WHERE recipe_item_id = r.from_id AND ingredient_item_id IS DISTINCT FROM v_bottle);
            DELETE FROM public.recipes WHERE recipe_item_id = r.from_id;
        END IF;
        WITH gone AS (
            DELETE FROM public.item_images WHERE item_id = r.from_id AND is_generated RETURNING image_id
        )
        SELECT array_agg(image_id) INTO v_images FROM gone;
        DELETE FROM public.images im
         WHERE im.id = ANY (COALESCE(v_images, '{}'))
           AND NOT EXISTS (SELECT 1 FROM public.item_images ii WHERE ii.image_id = im.id)
           AND NOT EXISTS (SELECT 1 FROM public.drink_photos p WHERE p.image_id = im.id)
           AND NOT EXISTS (SELECT 1 FROM public.made_drinks m WHERE m.image_id = im.id);
        PERFORM private.merge_ingredient(r.from_id, r.into_id);
    END LOOP;

    -- --- 3. Shaky Pete's Ginger Brew ---
    IF EXISTS (SELECT 1 FROM public.items k JOIN public.items c ON c.id = v_copy
               WHERE k.id = v_classic
                 AND k.name = 'Shaky Pete''s Ginger Brew' AND c.name = k.name
                 AND k.item_type = 'cocktail' AND c.item_type = 'cocktail'
                 AND k.bar_id IS NULL AND c.bar_id IS NULL
                 AND k.is_catalog AND NOT c.is_catalog
                 AND k.origin_bar_profile_id = v_hawksmoor AND c.origin_bar_profile_id = v_hawksmoor) THEN
        PERFORM private.merge_item(v_copy, v_classic);
    END IF;
END;
$$;

RESET "app.image_worker";

-- --- 4. Eddie's Bar (Demo) ---

UPDATE public.bars
   SET name = 'Eddie’s Bar (Demo)', page_visibility = 'locked'
 WHERE id = '1ba50170-9658-456a-b828-3018640afa70' AND name = 'Eddie’s Bar';

UPDATE public.profiles
   SET display_name = 'Eddie’s Bar (Demo)', is_public = false
 WHERE id = '6412f4ed-6340-40f2-beef-c58e1b6987d5' AND kind = 'bar' AND display_name = 'Eddie’s Bar'
   AND bar_id IS NULL AND NOT is_claimed;
