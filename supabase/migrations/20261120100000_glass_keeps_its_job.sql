-- A venue's glass keeps its job when it's matched to a real glass, after
-- 20261118500000. Kevin, 25 Oct 2026: Caretaker's Cottage matched its Coupe
-- to Nude's Savage Pony, which the catalog files as a Nick & Nora, and the
-- Coupe moved to Nick & Nora. The bar was left with no coupe (its Coupette
-- drinks went back to the stock drawing), and the Pony wasn't its main Nick &
-- Nora, so nothing was drawn in it. "Pony" is a size, not a shape: a bar may
-- pour its coupes into one.
--
-- 1. Picking a real glass no longer changes the venue glass's type
--    (fill_from_model). Its type is the job it does at the venue: the drinks
--    of that type are drawn in it. The app keeps the type when it matches a
--    glass the venue already has, and takes the catalog's for a new one.
-- 2. A venue's drinks are drawn in its main glass's traced outline whatever
--    the catalog files that glass under (item_sketch_outline), and a model
--    traced again redraws them (refresh_glass_model_sketches). A drink that
--    names a real glass itself still takes it only for that glass's type, as
--    before: picking one sets the drink's type (items_glass_model).
-- 3. Caretaker's Cottage's Pony goes back to being its main coupe, which
--    redraws its coupe and Nick & Nora drinks (bar_glassware's
--    refresh_sketch_variant trigger). 20261120200000 points it at the
--    Savage Pony from Nude's own catalog.
--
-- No RLS or grant changes; no AI jobs (item_sketches updates queue none).
-- Running it again changes nothing.

-- --- 1. The type stays the venue's ---

-- As 20261103230000, but the row keeps its type, and the model's drawing only
-- when the model is that type.
CREATE OR REPLACE FUNCTION "private"."bar_glassware_fill_from_model"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    m public.glass_models;
BEGIN
    IF NEW.model_id IS NULL THEN
        RETURN NEW;
    END IF;
    -- Its maker, series and designer are the model's, read from it.
    NEW.maker := NULL;
    NEW.maker_profile_id := NULL;
    NEW.series := NULL;
    NEW.designer := NULL;
    IF TG_OP = 'UPDATE' AND NEW.model_id IS NOT DISTINCT FROM OLD.model_id THEN
        RETURN NEW;
    END IF;
    -- Picking a model makes the row that glass, drawn its way unless the bar drew it its own.
    SELECT * INTO m FROM public.glass_models WHERE id = NEW.model_id;
    IF NEW.glass = m.glass THEN
        NEW.variant := coalesce(NEW.variant, m.variant);
    END IF;
    NEW.name := coalesce(NEW.name, left(m.name, 80));
    RETURN NEW;
END;
$$;

-- --- 2. Drawn in the main glass's outline, whatever the catalog calls it ---

-- As 20261118500000, but the venue's main glass's model counts whatever its type.
CREATE OR REPLACE FUNCTION "private"."item_sketch_outline"("p_item_id" "uuid", "p_glass" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN split_part(i.sketch_variant, '_', 1) = p_glass THEN NULL
    WHEN m.id IS NOT NULL THEN m.outline
    ELSE (SELECT coalesce(g.outline, bm.outline)
            FROM public.bar_glassware g
            LEFT JOIN public.glass_models bm ON bm.id = g.model_id
           WHERE g.profile_id = private.item_bar_profile(i.id) AND g.glass = p_glass AND g.is_default
           LIMIT 1)
  END - 'traced_from'
  FROM public.items i
  LEFT JOIN public.glass_models m ON m.id = i.glass_model_id AND m.glass = p_glass
  WHERE i.id = p_item_id;
$$;

-- As 20261113100000, but a bar's main glass redraws the drinks of the type it
-- does the job of, not the type its model is filed under.
CREATE OR REPLACE FUNCTION "private"."refresh_glass_model_sketches"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    WITH changed AS (
        SELECT n.id, n.glass FROM new_models n JOIN old_models o ON o.id = n.id
         WHERE o.outline IS DISTINCT FROM n.outline OR o.glass IS DISTINCT FROM n.glass
    )
    UPDATE public.item_sketches s SET inputs = s.inputs
      FROM public.items i
     WHERE i.id = s.item_id
       AND (EXISTS (SELECT 1 FROM changed c WHERE c.id = i.glass_model_id AND c.glass = s.inputs ->> 'glass')
            OR EXISTS (SELECT 1 FROM changed c
                         JOIN public.bar_glassware g ON g.model_id = c.id AND g.is_default
                         JOIN public.profiles p ON p.id = g.profile_id
                        WHERE g.glass = s.inputs ->> 'glass'
                          AND (i.origin_bar_profile_id = g.profile_id OR i.bar_id = p.bar_id)));
    RETURN NULL;
END;
$$;

-- --- 3. Caretaker's Cottage's Pony is its coupe again ---

-- Its only coupe was the one matched to the Pony; it becomes the main one
-- unless the bar has added another main coupe since.
UPDATE public.bar_glassware g
   SET glass = 'coupe',
       variant = NULL,
       is_default = NOT EXISTS (SELECT 1 FROM public.bar_glassware o
                                 WHERE o.profile_id = g.profile_id AND o.glass = 'coupe' AND o.is_default)
  FROM public.profiles p, public.glass_models m
 WHERE p.id = g.profile_id AND p.handle = 'caretakers.cottage' AND p.kind = 'bar'
   AND m.id = g.model_id AND m.name IN ('Savage Pony', 'Savage 4 oz. Pony Glass')
   AND g.glass = 'nick' AND NOT g.is_default;
