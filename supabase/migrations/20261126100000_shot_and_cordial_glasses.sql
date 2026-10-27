-- Shot and Cordial glass types (d66 on the open decisions page; Kevin, 27 Oct
-- 2026: "Shot and Cordial glass types: let's add them").
--
-- 1. private.is_glass_type takes 'shot' and 'cordial': 18 types, the same list
--    as lib/sketch/types.ts SKETCH_GLASSES (lib/glassware.check.ts holds them
--    together). Every check reads it, so glass_models, bar_glassware,
--    home_glassware, items.glass and saved drawings take the two.
-- 2. The catalog's shapes for them: shared glassware items "Shot" (60 ml) and
--    "Cordial" (80 ml), each its own kind, made when the catalog has none.
-- 3. The glass catalog's shot and cordial glasses move to them, chosen by their
--    own data, not by hand:
--    - Shot: every glass whose name says shot or shooter (not Cocktail
--      Kingdom's Mini Mule Shots, copper mugs with a handle), and every Rocks
--      glass the loads drew as a shot (variant rocks_shot: named shot or
--      shooter, or 90 ml or less) with no stem in its traced outline, but the
--      one whose name says it's a rocks glass (Arcoroc's Arcadie 3 oz. Rocks /
--      Old Fashioned Glass).
--    - Cordial: every other glass named cordial, liqueur or pousse-cafe,
--      whatever its type, and the Rocks glass drawn as a shot whose traced
--      outline has a stem (Bobo's Nubbe). So the Rocks glasses drawn as shots
--      that are named liqueur or cordial but have no stem (Luigi Bormioli's
--      Bach Liqueur, Libbey's Chicago Cordial Super Sham) are shot glasses.
--    Built from the migrations, that is 109 rows: 93 to Shot (90 from Rocks, 2
--    from Snifter: Krosno's Xno Shot 55 and 75 Axis, 1 from Julep: Sertodo's
--    Tequilero Copper Shot Cup) and 16 to Cordial (13 from Snifter, 1 from
--    Rocks, 1 from Martini: Cocktail Kingdom's Cordial Cocktail Glass, 1 from
--    Wine: Toyo-Sasaki's 310 Line Liqueur). The notice says what it moved.
--    Grappa, digestif, sherry and port glasses stay where they are. Each keeps
--    its traced outline; its drawing becomes its new type's own (variant null).
-- 4. A drink served in one of those glasses (items.glass_model_id) follows it
--    to the new shape, as picking the glass would, drops its own pick of a
--    drawing of the old type (a Rocks "Shot"), and is redrawn. A venue's or
--    a home's own glass keeps its type: a glass's type is its job (#876), so a
--    venue moves its shot glass to Shot in Kit (the Rocks drawing "Shot" stays
--    for the ones it keeps as rocks).
-- 5. Shared glassware items named for the two (Shot, Shot Glass, Shooter,
--    Cordial, Cordial Glass, Liqueur Glass, Chartreuse Glass) take the kind, as
--    the name rules now read them; a venue's own item only when it has no kind
--    yet, and never a catalog glass's shape. Chartreuse Glass was a Nick & Nora
--    in the 26 Oct backfill. Setting a kind redraws its drinks (refresh_kind).

-- None of this may queue paid pictures (merge_item does the same).
SELECT set_config('app.image_worker', 'on', true);

-- --- 1. The glass types ---

CREATE OR REPLACE FUNCTION "private"."is_glass_type"("p" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p IN ('coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute',
               'wine', 'spritz', 'snifter', 'julep', 'tiki', 'mug', 'ceramic', 'beer', 'shot', 'cordial');
$$;

-- --- 2. The catalog's shapes ---

INSERT INTO public.items (name, item_type, glass, capacity_ml)
SELECT s.name, 'glassware', s.glass, s.ml
  FROM (VALUES ('Shot', 'shot', 60), ('Cordial', 'cordial', 80)) s(name, glass, ml)
 WHERE NOT EXISTS (SELECT 1 FROM public.items i WHERE i.item_type = 'glassware' AND i.bar_id IS NULL AND lower(btrim(i.name)) = lower(s.name));

-- --- 5 (first, so the shapes have their kind before the catalog moves). Items named for them ---

CREATE TEMP TABLE kind_named ON COMMIT DROP AS
SELECT i.id
  FROM public.items i
  JOIN (VALUES ('shot', 'shot'), ('shots', 'shot'), ('shot glass', 'shot'), ('shooter', 'shot'), ('shooter glass', 'shot'),
               ('cordial', 'cordial'), ('cordial glass', 'cordial'), ('liqueur glass', 'cordial'), ('chartreuse glass', 'cordial')) AS m(name, kind)
    ON lower(btrim(i.name)) = m.name
 WHERE i.item_type = 'glassware' AND i.glass IS DISTINCT FROM m.kind
   AND (i.bar_id IS NULL OR i.glass IS NULL)
   AND NOT EXISTS (SELECT 1 FROM public.glass_models g WHERE g.shape_item_id = i.id);

UPDATE public.items i SET glass = CASE WHEN lower(btrim(i.name)) IN ('shot', 'shots', 'shot glass', 'shooter', 'shooter glass') THEN 'shot' ELSE 'cordial' END
  FROM kind_named k
 WHERE k.id = i.id;

-- --- 3. The catalog ---

CREATE TEMP TABLE glass_moves ON COMMIT DROP AS
WITH c AS (
    SELECT m.id, m.glass, m.name, m.shape_item_id,
           coalesce((m.outline ->> 'stemmed')::boolean, false) AS stemmed,
           m.glass = 'rocks' AND m.variant = 'rocks_shot' AND m.name !~* 'rocks|old fashioned' AS drawn_shot
      FROM public.glass_models m
     WHERE m.glass NOT IN ('shot', 'cordial')
)
SELECT c.id, c.glass AS was, c.shape_item_id AS was_shape,
       CASE WHEN (c.name ~* '\mshots?\M|shooter' AND c.glass <> 'mug') OR (c.drawn_shot AND NOT c.stemmed) THEN 'shot'
            ELSE 'cordial' END AS glass
  FROM c
 WHERE (c.name ~* '\mshots?\M|shooter' AND c.glass <> 'mug') OR c.drawn_shot OR c.name ~* 'cordial|liqueur|pousse';

UPDATE public.glass_models m
   SET glass = x.glass,
       variant = NULL,
       shape_item_id = (SELECT i.id FROM public.items i
                         WHERE i.item_type = 'glassware' AND i.bar_id IS NULL AND i.glass = x.glass
                           AND lower(btrim(i.name)) = x.glass
                         ORDER BY i.created_at, i.id
                         LIMIT 1)
  FROM glass_moves x
 WHERE x.id = m.id;

-- --- 4. Drinks served in them follow ---

CREATE TEMP TABLE drinks_moved ON COMMIT DROP AS
SELECT d.id, m.shape_item_id, x.was
  FROM public.items d
  JOIN glass_moves x ON x.id = d.glass_model_id
  JOIN public.glass_models m ON m.id = x.id
 WHERE d.glassware_id IS NOT DISTINCT FROM x.was_shape AND m.shape_item_id IS NOT NULL;

UPDATE public.items d
   SET glassware_id = x.shape_item_id,
       sketch_variant = CASE WHEN split_part(d.sketch_variant, '_', 1) = x.was THEN NULL ELSE d.sketch_variant END
  FROM drinks_moved x
 WHERE x.id = d.id;

-- The drawing takes the new glass, its outline and no variant (set_glass_and_ice, set_variant).
UPDATE public.item_sketches s SET inputs = s.inputs
  FROM drinks_moved x
 WHERE x.id = s.item_id;

DO $$
BEGIN
    RAISE NOTICE 'Moved % catalog glasses to Shot (%) and % to Cordial (%); % drinks followed them; % glass items named for them took the kind.',
        (SELECT count(*) FROM glass_moves WHERE glass = 'shot'),
        coalesce((SELECT string_agg(was || ' ' || n, ', ' ORDER BY was) FROM (SELECT was, count(*) n FROM glass_moves WHERE glass = 'shot' GROUP BY was) s), 'none'),
        (SELECT count(*) FROM glass_moves WHERE glass = 'cordial'),
        coalesce((SELECT string_agg(was || ' ' || n, ', ' ORDER BY was) FROM (SELECT was, count(*) n FROM glass_moves WHERE glass = 'cordial' GROUP BY was) s), 'none'),
        (SELECT count(*) FROM drinks_moved),
        (SELECT count(*) FROM kind_named);
END;
$$;
