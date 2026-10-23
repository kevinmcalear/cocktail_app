-- Real glasses where a drink or a bar names one, and a bar's real glass
-- keeps its facts on the model (database audit, 22 Oct, 2.5; Kevin, 22 Oct:
-- a drink starts with the generic glass, and anyone can pick the real glass
-- where they know it). After 20261103220000, which loads these glasses.
--
-- Glassware was in three places: the generic glasses (glassware items, which
-- 1,046 drinks point at through items.glassware_id), the real glasses
-- (glass_models, through items.glass_model_id, 1 drink) and a venue's own
-- glasses (bar_glassware, 39 rows, none naming a real glass). They stay three
-- tables with one job each (docs/drink_data.md):
--
--   * items.glassware_id     the kind of glass. Every drink has one.
--   * items.glass_model_id   the real glass, where someone knows it. Picking it
--                            sets glassware_id to its kind (items_glass_model).
--   * bar_glassware          the glasses a venue pours into: a real glass
--                            (model_id) or one the bar describes.
--
-- 1. A venue's real glass no longer copies the model. Picking a model made
--    the row take the model's maker, maker page, series and designer, so the
--    same facts sat on the model and on every bar that used it. Now a row
--    with a model keeps only what the bar says (its name for it, its
--    drawing, whether it's the main one, a note); the app reads the rest
--    from the model (hooks/useBarGlassware.ts). A check holds it.
-- 2. A Bar with Shapes for a Name names a real glass on 56 of its specs
--    ("Glass: Nude x Savage - Coupetini"). The 36 drinks whose glass is one
--    model, size included, now point at it, and the bar's glassware lists
--    each of those glasses (not as its main glass, so no drawing changes
--    until the bar says so), so its team is offered them first. Its 13
--    "Utopia Outline Tumblers" specs don't say which size and stay as they
--    are, as do the specs that name no maker ("Bar martini glass").
-- 3. Glasses research bars list by maker and name (Bar Leone's four BOBO
--    Popolare glasses, Jigger & Pony's Kimura Crumple) now point at them.
--
-- The kind of glass follows the real one, so 12 of those drinks change kind
-- (a Savage Water glass is a Rocks, no longer a Small Rocks; Kimura's Bambi
-- is a Wine glass, no longer a Small Highball) and are redrawn in it. No
-- paid AI: app.image_worker stops picture jobs, and the flavour jobs these
-- updates queue are removed at the end.
--
-- No RLS or grant changes. Running it again changes nothing.

SET "app.image_worker" = 'on';
CREATE TEMP TABLE "rg_jobs_before" AS SELECT "item_id" FROM "private"."item_flavor_jobs";

-- --- 1. A real glass keeps its facts on the model ---

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
    NEW.variant := CASE WHEN NEW.glass = m.glass AND NEW.variant IS NOT NULL THEN NEW.variant ELSE m.variant END;
    NEW.glass := m.glass;
    NEW.name := coalesce(NEW.name, left(m.name, 80));
    RETURN NEW;
END;
$$;

-- On every write now, not only a new model: a row that names a model can't take its facts back.
DROP TRIGGER "fill_from_model" ON "public"."bar_glassware";
CREATE TRIGGER "fill_from_model" BEFORE INSERT OR UPDATE ON "public"."bar_glassware"
    FOR EACH ROW EXECUTE FUNCTION "private"."bar_glassware_fill_from_model"();

UPDATE public.bar_glassware SET maker = NULL, maker_profile_id = NULL, series = NULL, designer = NULL
 WHERE model_id IS NOT NULL AND (maker, maker_profile_id, series, designer) IS DISTINCT FROM (NULL, NULL, NULL, NULL);

ALTER TABLE "public"."bar_glassware" ADD CONSTRAINT "bar_glassware_model_holds_maker"
    CHECK ("model_id" IS NULL OR ("maker" IS NULL AND "maker_profile_id" IS NULL AND "series" IS NULL AND "designer" IS NULL));

COMMENT ON COLUMN "public"."bar_glassware"."model_id" IS
    'The real glass this is, when the bar has picked one. Its maker, series, designer and size are the model''s; the row keeps the bar''s own name, drawing and main glass.';

-- --- The real glasses named here, by maker page, name and size ---

CREATE TEMP TABLE "rg_named" ("said" text, "maker" text, "name" text, "capacity_ml" numeric);
INSERT INTO "rg_named" VALUES
($q$Nude x Savage - Coupetini$q$, $q$nude$q$, $q$Savage Coupetini$q$, 170),
($q$Nude x Savage - Pony$q$, $q$nude$q$, $q$Savage Pony$q$, 135),
($q$Nude x Savage - Lowball$q$, $q$nude$q$, $q$Savage Lowball$q$, 290),
($q$Nude x Savage - High ball$q$, $q$nude$q$, $q$Savage Highball$q$, 330),
($q$Nude x Savage - Water glass$q$, $q$nude$q$, $q$Savage Water$q$, 260),
($q$Kimura Bambi 8oz$q$, $q$kimura.glass$q$, $q$Bambi 8oz Wine$q$, 240),
($q$CAST Iced tea glass 350ml$q$, $q$kinto$q$, $q$CAST Iced Tea Glass$q$, 350),
($q$Classic Duotone Honey Amber - 0101YA$q$, $q$mamo$q$, $q$Classic Cocktail Glass Duotone Honey Amber$q$, 207),
($q$Duralex Gigogne 90$q$, $q$duralex$q$, $q$Le Gigogne$q$, 90),
($q$Gio tumbler large$q$, $q$lsa.international$q$, $q$Gio Tumbler Large$q$, 560),
($q$HAY Curve stem glass$q$, $q$hay$q$, $q$Curve Stem Glass Small$q$, NULL),
($q$John Jenkins Atlantic Half Martini$q$, $q$john.jenkins$q$, $q$Atlantic Half Martini$q$, 100),
($q$Metropolitan Stemless Glass$q$, $q$lsa.international$q$, $q$Metropolitan Stemless Glass$q$, 360),
($q$Olympia Stemmed Sundae Cup$q$, $q$olympia$q$, $q$Stemmed Sundae Cup$q$, 250),
($q$Sferico n.2 martini$q$, $q$karakter$q$, $q$Sferico No. 2$q$, 180),
($q$Svev Skye Tumbler$q$, $q$svev$q$, $q$Skye Tumbler$q$, 250),
($q$Popolare Martini$q$, $q$bobo$q$, $q$Popolare Martini$q$, NULL),
($q$Popolare Highball$q$, $q$bobo$q$, $q$Popolare Highball$q$, NULL),
($q$Popolare Spritz$q$, $q$bobo$q$, $q$Popolare Spritz$q$, NULL),
($q$Popolare Rock$q$, $q$bobo$q$, $q$Popolare Rock$q$, NULL),
($q$Crumple glass$q$, $q$kimura.glass$q$, $q$Crumple Old$q$, 300);

CREATE TEMP TABLE "rg_model" AS
SELECT n.said, m.id AS model_id
  FROM rg_named n
  JOIN public.profiles p ON p.kind = 'maker' AND p.handle = n.maker
  JOIN public.glass_models m ON m.maker_profile_id = p.id AND public.ingredient_key(m.name) = public.ingredient_key(n.name)
   AND coalesce(m.capacity_ml, 0) = coalesce(n.capacity_ml, 0);

-- --- 2. A Bar with Shapes for a Name's specs ---

CREATE TEMP TABLE "rg_shapes" AS
SELECT i.id AS item_id, r.model_id
  FROM public.items i
  JOIN public.profiles bp ON bp.bar_id = i.bar_id AND bp.kind = 'bar' AND bp.handle = 'abarwithshapesforaname'
  JOIN rg_model r ON r.said = btrim(substring(i.notes FROM 'Glass: ([^\n]+)'))
 WHERE i.item_type = 'cocktail';

UPDATE public.items i SET glass_model_id = s.model_id
  FROM rg_shapes s
 WHERE i.id = s.item_id AND i.glass_model_id IS DISTINCT FROM s.model_id;

-- Its glassware lists each of them, after its own glasses, as it orders them.
INSERT INTO public.bar_glassware (profile_id, glass, model_id, is_default, sort_order)
SELECT bp.id, m.glass, m.id, false,
       (SELECT coalesce(max(g.sort_order), 0) FROM public.bar_glassware g WHERE g.profile_id = bp.id)
         + row_number() OVER (ORDER BY m.glass, m.name)
  FROM public.profiles bp
  JOIN public.glass_models m ON m.id IN (SELECT DISTINCT model_id FROM rg_shapes)
 WHERE bp.kind = 'bar' AND bp.handle = 'abarwithshapesforaname'
   AND NOT EXISTS (SELECT 1 FROM public.bar_glassware g WHERE g.profile_id = bp.id AND g.model_id = m.id);

-- --- 3. Glasses research bars name ---

UPDATE public.bar_glassware g SET model_id = r.model_id
  FROM public.profiles bp, rg_model r
 WHERE g.profile_id = bp.id AND bp.kind = 'bar' AND g.model_id IS NULL
   AND ((bp.handle = 'barleonehk' AND g.name IN ('Popolare Martini', 'Popolare Highball', 'Popolare Spritz', 'Popolare Rock'))
     OR (bp.handle = 'jiggerandponysg' AND g.name = 'Crumple glass'))
   AND r.said = g.name;

-- --- No paid AI: drop the flavour jobs these updates queued ---

DELETE FROM "private"."item_flavor_jobs" j
 WHERE NOT EXISTS (SELECT 1 FROM "rg_jobs_before" b WHERE b.item_id = j.item_id)
   AND j.item_id IN (SELECT item_id FROM rg_shapes);

DROP TABLE "rg_named", "rg_model", "rg_shapes", "rg_jobs_before";
RESET "app.image_worker";
