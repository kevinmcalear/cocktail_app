-- House prep recipes from Australian native ingredients (after
-- 20261018040000). Stage 4G of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * Four house preps get a recipe from the pages they cite, Australian
--     producers' own recipes first (three are new catalog rows; Macadamia
--     orgeat existed and moves from Syrup to Orgeat): lemon myrtle syrup (Warndu),
--     wattleseed syrup (Outback Spirit), macadamia orgeat (the Australian
--     Macadamia Society, two sources) and anise myrtle syrup (Warndu). FSANZ
--     lists lemon myrtle and wattleseed as traditional, not novel, foods.
--   * Strawberry gum waits for a toxicity check (it's a eucalyptus, and
--     FSANZ has no record of it as a food); other natives had no published
--     recipe with amounts this round.
--   * One new plain ingredient: Anise myrtle.
--   * An independent second check of every fact in this stage (16) against
--     the cited pages found none wrong.
--
-- Written by scripts/prep-recipes.mjs from supabase/seeds/preps/g_australian_natives.json;
-- edit the seed, not this file. Matched by name key: a second run changes
-- nothing, rows that are missing are made, and venue preps aren't touched.

SET statement_timeout = 0;
SET "app.image_worker" = 'on';
-- No paid flavour jobs: note the queue now and put it back at the end.
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

CREATE TEMP TABLE stub_in (name text PRIMARY KEY, description text, kind_of text);
CREATE TEMP TABLE prep_in (
    name text PRIMARY KEY, kind_of text, kind_of_force boolean NOT NULL, description text, abv numeric, has_abv boolean NOT NULL,
    yield_amount numeric, yield_unit text, keeps_hours integer, storage text, actions text[] NOT NULL, replace boolean NOT NULL
);
CREATE TEMP TABLE alias_in (name text NOT NULL, alias text NOT NULL);
CREATE TEMP TABLE line_in (name text NOT NULL, pos integer NOT NULL, ingredient text NOT NULL, amount numeric, unit text, note text, optional boolean NOT NULL, PRIMARY KEY (name, pos));
CREATE TEMP TABLE step_in (name text NOT NULL, pos integer NOT NULL, body text NOT NULL, timer_seconds integer, PRIMARY KEY (name, pos));
CREATE TEMP TABLE source_in (name text NOT NULL, field text NOT NULL, url text NOT NULL, kind text NOT NULL, checked_on date NOT NULL, note text);

INSERT INTO stub_in VALUES
($q$Anise myrtle$q$, $q$Dried, milled leaf of an Australian rainforest tree (Syzygium anisatum) with a sweet aniseed and liquorice flavour. Used in teas, syrups and baking.$q$, $q$Spices$q$);

INSERT INTO prep_in VALUES
($q$Anise myrtle syrup$q$, $q$Syrup$q$, false, $q$A sugar syrup made on an overnight anise myrtle tea, with a soft aniseed and liquorice flavour. For sours, highballs and anywhere a gentle anise note suits.$q$, 0, true, 750, $q$ml$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$, $q$Syrup$q$]::text[], false),
($q$Lemon myrtle syrup$q$, $q$Syrup$q$, false, $q$Raw sugar ground with dried lemon myrtle leaf and a little finger lime, then dissolved in an equal volume of water. A bright, lemongrass-scented syrup for gin sours, Collinses and native-botanical highballs.$q$, 0, true, 540, $q$ml$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Blend$q$]::text[], false),
($q$Macadamia orgeat$q$, $q$Orgeat$q$, true, $q$An orgeat made with ground macadamias in place of almonds, steeped overnight in a hot sugar syrup with a little orange flower water. Rich and buttery, for tiki drinks, sours and long drinks with soda.$q$, 0, true, 900, $q$ml$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Wattleseed syrup$q$, $q$Syrup$q$, false, $q$Caster and brown sugar simmered with roasted ground wattleseed and reduced by a third, for a rich syrup with a nutty, coffee-like flavour. Made for whisky and brandy drinks such as an Athol Brose, Espresso Martini riffs and desserts.$q$, 0, true, 500, $q$ml$q$, NULL, $q$Sterile bottle sealed hot; fridge once open$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false);


INSERT INTO line_in VALUES
($q$Anise myrtle syrup$q$, 0, $q$Anise myrtle$q$, 4, $q$tsp$q$, $q$dried, milled leaf$q$, false),
($q$Anise myrtle syrup$q$, 1, $q$Water$q$, 480, $q$ml$q$, $q$boiling$q$, false),
($q$Anise myrtle syrup$q$, 2, $q$Caster sugar$q$, 500, $q$g$q$, NULL, false),
($q$Lemon myrtle syrup$q$, 0, $q$Raw sugar$q$, 300, $q$g$q$, NULL, false),
($q$Lemon myrtle syrup$q$, 1, $q$Lemon myrtle$q$, 72, $q$leaf$q$, $q$dried leaves$q$, false),
($q$Lemon myrtle syrup$q$, 2, $q$Finger lime$q$, 8, $q$tsp$q$, $q$dried finger lime chips; up to double for more tang$q$, false),
($q$Lemon myrtle syrup$q$, 3, $q$Water$q$, 360, $q$ml$q$, NULL, false),
($q$Macadamia orgeat$q$, 0, $q$Caster sugar$q$, 600, $q$g$q$, $q$raw caster sugar$q$, false),
($q$Macadamia orgeat$q$, 1, $q$Water$q$, 600, $q$ml$q$, NULL, false),
($q$Macadamia orgeat$q$, 2, $q$Macadamia$q$, 536, $q$g$q$, $q$finely ground$q$, false),
($q$Macadamia orgeat$q$, 3, $q$Orange blossom water$q$, 1, $q$tsp$q$, NULL, false),
($q$Wattleseed syrup$q$, 0, $q$Caster sugar$q$, 200, $q$g$q$, NULL, false),
($q$Wattleseed syrup$q$, 1, $q$Brown sugar$q$, 150, $q$g$q$, NULL, false),
($q$Wattleseed syrup$q$, 2, $q$Water$q$, 240, $q$ml$q$, NULL, false),
($q$Wattleseed syrup$q$, 3, $q$Wattleseed$q$, 20, $q$g$q$, $q$roasted and ground$q$, false);

INSERT INTO step_in VALUES
($q$Anise myrtle syrup$q$, 0, $q$Pour the boiling water over the anise myrtle in a heatproof bowl, cover with a cloth and leave overnight at room temperature.$q$, NULL),
($q$Anise myrtle syrup$q$, 1, $q$Strain into a saucepan, pressing the leaf to get all the liquid out.$q$, NULL),
($q$Anise myrtle syrup$q$, 2, $q$Add the sugar and warm gently, stirring, until it has dissolved. Do not let it boil.$q$, NULL),
($q$Anise myrtle syrup$q$, 3, $q$Cool, bottle and keep in the fridge.$q$, NULL),
($q$Lemon myrtle syrup$q$, 0, $q$Grind the raw sugar, dried lemon myrtle leaves and finger lime chips together in a spice grinder until fine.$q$, NULL),
($q$Lemon myrtle syrup$q$, 1, $q$Put the flavoured sugar and the water in a small pan over medium heat and simmer only until the sugar has dissolved.$q$, NULL),
($q$Lemon myrtle syrup$q$, 2, $q$Let it cool, bottle it and keep it in the fridge.$q$, NULL),
($q$Macadamia orgeat$q$, 0, $q$Pulse the macadamias in a food processor until finely ground.$q$, NULL),
($q$Macadamia orgeat$q$, 1, $q$Bring the sugar and water to the boil, stirring to dissolve, then simmer for 3 to 4 minutes to reduce slightly.$q$, 240),
($q$Macadamia orgeat$q$, 2, $q$Stir in the ground macadamias and bring back to the boil.$q$, NULL),
($q$Macadamia orgeat$q$, 3, $q$Take off the heat, add the orange flower water, cover and leave to stand for about 8 hours or overnight.$q$, 28800),
($q$Macadamia orgeat$q$, 4, $q$Strain through a fine strainer, pressing the nuts, then bottle and keep in the fridge.$q$, NULL),
($q$Wattleseed syrup$q$, 0, $q$Warm the water with the caster and brown sugar in a heavy pan until the sugar has dissolved.$q$, NULL),
($q$Wattleseed syrup$q$, 1, $q$Add the ground wattleseed, bring to the boil, then lower the heat and simmer gently until the volume is down by a third.$q$, NULL),
($q$Wattleseed syrup$q$, 2, $q$Strain through muslin for a clear syrup, twice if needed (or leave the grounds in if you don't mind the specks).$q$, NULL),
($q$Wattleseed syrup$q$, 3, $q$Pour hot into sterilised bottles and seal. The producer says sealed jars keep up to a year; once opened, keep it in the fridge.$q$, NULL);

INSERT INTO source_in VALUES
($q$Anise myrtle syrup$q$, $q$recipe$q$, $q$https://warndu.com/blogs/recipes/anise-myrtle-granita$q$, $q$producer$q$, DATE '2026-10-13', $q$Warndu (native food producer) anise myrtle granita: 4 tsp anise myrtle steeped overnight in 480 ml boiling water, strained, then 500 g caster sugar dissolved without boiling. We stop at that syrup stage, before freezing. Used as given.$q$),
($q$Lemon myrtle syrup$q$, $q$recipe$q$, $q$https://warndu.com/blogs/recipes/lemon-myrtle-finger-lime-gin-muddle$q$, $q$producer$q$, DATE '2026-10-13', $q$Warndu (native food producer): 3 tbsp raw sugar ground with 8 to 10 dried lemon myrtle leaves and 1 to 2 tsp finger lime chips, simmered with 3 tbsp water. Taken as 37.5 g sugar (1 tbsp 12.5 g), 9 leaves, 1 tsp chips, 45 ml water; scaled x8. The method's 'lemon balm' is the page's slip for its lemon myrtle sugar.$q$),
($q$Macadamia orgeat$q$, $q$recipe$q$, $q$https://www.australian-macadamias.org/recipe/macadamia-orgeat/$q$, $q$producer$q$, DATE '2026-10-13', $q$Australian Macadamia Society (the growers' body): 2 cups macadamias, 1.5 cups raw caster sugar, 1.25 cups water, 0.5 tsp orange flower water, steeped about 8 h. Converted (nuts 134 g a cup per USDA FoodData Central 170178, sugar 200 g a cup, 240 ml a cup) and doubled.$q$),
($q$Macadamia orgeat$q$, $q$recipe$q$, $q$https://australianbartender.com.au/2018/01/02/macadamia-orgeat-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$Jono Carr (Door Knock, Sydney): 250 g macadamias simmered in 1 L almond milk, blended with 200 ml bought orgeat, 15 ml each orange blossom and rose water, salt. Much less sweet and built on almond milk; we use the Australian Macadamia Society ratio.$q$),
($q$Wattleseed syrup$q$, $q$recipe$q$, $q$https://outbackspirit.com.au/blogs/recipes/sweet-wattleseed-syrup$q$, $q$producer$q$, DATE '2026-10-13', $q$Outback Spirit (native food producer): 1 cup caster sugar, 3/4 cup brown sugar, 1 cup water, 1 tbsp (20 g) roasted ground wattleseed, reduced by a third. Converted at 1 cup sugar 200 g, 1 cup water 240 ml; batch as written.$q$),
($q$Wattleseed syrup$q$, $q$yield$q$, $q$https://outbackspirit.com.au/blogs/recipes/sweet-wattleseed-syrup$q$, $q$producer$q$, DATE '2026-10-13', $q$The page states the batch makes 2 cups (500 ml).$q$);

-- A shared ingredient by name, else by alias.
CREATE FUNCTION pg_temp.shared(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT public.resolve_ingredient(p_name);
$$;
-- A style (or a prep standing in as one, "Falernum") by name.
CREATE FUNCTION pg_temp.style(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT i.id FROM public.items i
          WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role IN ('generic', 'prep')
            AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
          ORDER BY (i.ingredient_role = 'generic') DESC, i.is_core DESC, i.created_at LIMIT 1),
        (SELECT i.id FROM public.ingredient_aliases a JOIN public.items i ON i.id = a.item_id
          WHERE a.key = public.ingredient_key(p_name) AND i.bar_id IS NULL AND i.ingredient_role IN ('generic', 'prep')));
$$;
-- Changing a style trips guard_ingredient_name when another ingredient goes
-- by the prep's name; those keep the style they have.
CREATE FUNCTION pg_temp.name_free(p_id uuid, p_name text) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT NOT EXISTS (SELECT 1 FROM public.ingredient_aliases a
                        WHERE a.key = public.ingredient_key(p_name) AND a.item_id <> p_id);
$$;

-- --- Plain ingredients the lines need ---
DO $$
DECLARE s record; v uuid;
BEGIN
    FOR s IN SELECT * FROM stub_in ORDER BY name LOOP
        IF pg_temp.shared(s.name) IS NULL THEN
            INSERT INTO public.items (name, item_type, ingredient_role, description, hide_from_search)
            VALUES (s.name, 'ingredient', 'generic', s.description, false) RETURNING id INTO v;
            -- A new name can pick up a core suffix as its kind; set it as meant.
            UPDATE public.items SET generic_id = pg_temp.style(s.kind_of)
             WHERE id = v AND generic_id IS DISTINCT FROM pg_temp.style(s.kind_of);
        END IF;
    END LOOP;
END $$;

-- --- The prep each recipe lands on ---
-- The shared catalog prep by that name or alias. A bottle or a style by the
-- name isn't a prep, and someone's own prep isn't the catalog's: skipped. A
-- correction may land on a style that already carries a recipe (Elderflower
-- cordial, which bottles file under).
CREATE TEMP TABLE prep_row AS
SELECT p.*, i.id, (i.id IS NULL) AS is_new
  FROM prep_in p
  LEFT JOIN public.items i ON i.id = pg_temp.shared(p.name);
DELETE FROM prep_row r USING public.items i
 WHERE i.id = r.id
   AND (i.bar_id IS NOT NULL OR i.created_by IS NOT NULL OR i.item_type <> 'ingredient'
        OR (COALESCE(i.ingredient_role, 'prep') <> 'prep'
            AND NOT (r.replace AND i.ingredient_role = 'generic'
                     AND EXISTS (SELECT 1 FROM public.recipes x WHERE x.recipe_item_id = i.id AND x.amount IS NOT NULL))));

WITH ins AS (
    INSERT INTO public.items (name, item_type, ingredient_role, description, abv, hide_from_search)
    SELECT r.name, 'ingredient', 'prep', r.description, r.abv, false
      FROM prep_row r WHERE r.id IS NULL
    RETURNING id, name
)
UPDATE prep_row r SET id = ins.id FROM ins WHERE r.id IS NULL AND r.name = ins.name;

-- The style: set where there's none (and on a new row), or where the seed
-- says the one it has is wrong.
UPDATE public.items i SET generic_id = pg_temp.style(r.kind_of)
  FROM prep_row r
 WHERE i.id = r.id AND r.kind_of IS NOT NULL AND pg_temp.style(r.kind_of) IS NOT NULL
   AND pg_temp.style(r.kind_of) <> i.id
   AND (i.generic_id IS NULL OR r.is_new OR (r.kind_of_force AND i.generic_id <> pg_temp.style(r.kind_of)))
   AND pg_temp.name_free(i.id, i.name);
UPDATE public.items i SET ingredient_role = 'prep'
  FROM prep_row r WHERE i.id = r.id AND i.ingredient_role IS NULL;

-- A description where there's none; a corrected recipe brings its own.
UPDATE public.items i SET description = r.description
  FROM prep_row r
 WHERE i.id = r.id AND r.description IS NOT NULL
   AND (NULLIF(btrim(i.description), '') IS NULL OR (r.replace AND i.description IS DISTINCT FROM r.description));

-- A corrected recipe brings its strength when a source gives one; an unknown
-- one only clears a 0 (orgeat with brandy in it isn't 0%).
UPDATE public.items i SET abv = r.abv
  FROM prep_row r
 WHERE i.id = r.id AND r.replace AND r.has_abv AND i.abv IS DISTINCT FROM r.abv
   AND (r.abv IS NOT NULL OR i.abv = 0);

-- Other names people write it under, when nobody else has them.
INSERT INTO public.ingredient_aliases (key, item_id)
SELECT DISTINCT ON (public.ingredient_key(a.alias)) public.ingredient_key(a.alias), r.id
  FROM alias_in a JOIN prep_row r ON r.name = a.name
 WHERE public.ingredient_key(a.alias) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.items i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL
                      AND public.ingredient_key(i.name) = public.ingredient_key(a.alias))
ON CONFLICT (key) DO NOTHING;

-- --- Lines ---
-- Which preps get these lines: no line with an amount yet, or a correction.
CREATE TEMP TABLE prep_lines AS
SELECT r.id, r.name FROM prep_row r
 WHERE EXISTS (SELECT 1 FROM line_in l WHERE l.name = r.name)
   AND (r.replace OR NOT EXISTS (SELECT 1 FROM public.recipes x WHERE x.recipe_item_id = r.id AND x.amount IS NOT NULL));

DO $$
DECLARE missing text;
BEGIN
    SELECT string_agg(DISTINCT l.name || ': ' || l.ingredient, ', ') INTO missing
      FROM line_in l JOIN prep_lines p ON p.name = l.name
     WHERE pg_temp.shared(l.ingredient) IS NULL OR pg_temp.shared(l.ingredient) = p.id;
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'Recipe lines with no shared ingredient: %', missing;
    END IF;
END $$;

DELETE FROM public.recipes x USING prep_lines p WHERE x.recipe_item_id = p.id;
INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, sort_order)
SELECT p.id, pg_temp.shared(l.ingredient), l.amount, l.unit, l.note, l.optional, l.pos
  FROM line_in l JOIN prep_lines p ON p.name = l.name;

-- The strength trigger reads a batch as one serve. These are prep recipes:
-- clear that, and keep the ABV written by hand.
UPDATE public.items i SET serve_ml = NULL, serve_abv = NULL
  FROM prep_lines p
 WHERE i.id = p.id AND i.abv_source = 'manual' AND (i.serve_ml IS NOT NULL OR i.serve_abv IS NOT NULL);

-- --- Yield, keep, storage and how it's made ---
INSERT INTO public.item_prep AS ip (item_id, yield_amount, yield_unit, shelf_life_hours, storage, actions)
SELECT r.id, r.yield_amount, r.yield_unit, r.keeps_hours, r.storage, r.actions FROM prep_row r
ON CONFLICT (item_id) DO UPDATE SET
    -- A corrected recipe's yield is its own, even none: the old one was for other amounts.
    yield_amount = CASE WHEN (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id) THEN EXCLUDED.yield_amount
                        WHEN ip.yield_amount IS NULL THEN EXCLUDED.yield_amount ELSE ip.yield_amount END,
    yield_unit = CASE WHEN (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id) THEN EXCLUDED.yield_unit
                      WHEN ip.yield_amount IS NULL THEN EXCLUDED.yield_unit ELSE ip.yield_unit END,
    shelf_life_hours = CASE WHEN (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id) THEN EXCLUDED.shelf_life_hours
                            ELSE COALESCE(ip.shelf_life_hours, EXCLUDED.shelf_life_hours) END,
    storage = CASE WHEN EXCLUDED.storage IS NOT NULL AND (NULLIF(btrim(ip.storage), '') IS NULL OR (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id))
                   THEN EXCLUDED.storage ELSE ip.storage END,
    actions = ip.actions || ARRAY(SELECT u.t FROM unnest(EXCLUDED.actions) WITH ORDINALITY u(t, n)
                                   WHERE u.t <> ALL (ip.actions) ORDER BY u.n),
    updated_at = now();

-- --- Steps ---
CREATE TEMP TABLE prep_steps AS
SELECT r.id, r.name FROM prep_row r
 WHERE EXISTS (SELECT 1 FROM step_in s WHERE s.name = r.name)
   AND (r.replace OR NOT EXISTS (SELECT 1 FROM public.item_steps x WHERE x.item_id = r.id));
DELETE FROM public.item_steps x USING prep_steps p WHERE x.item_id = p.id;
INSERT INTO public.item_steps (item_id, position, body, timer_seconds)
SELECT p.id, s.pos, s.body, s.timer_seconds FROM step_in s JOIN prep_steps p ON p.name = s.name;

-- --- Where each fact comes from ---
-- A corrected recipe's old sources for the facts it rewrites go first.
DELETE FROM public.item_sources s USING prep_row r
 WHERE r.replace AND s.item_id = r.id AND s.field IN ('recipe', 'yield', 'keeps')
   AND NOT EXISTS (SELECT 1 FROM source_in n WHERE n.name = r.name AND n.field = s.field AND n.url = s.url);
INSERT INTO public.item_sources (item_id, field, url, kind, checked_on, note)
SELECT r.id, s.field, s.url, s.kind, s.checked_on, s.note
  FROM source_in s JOIN prep_row r ON r.name = s.name
ON CONFLICT ON CONSTRAINT "item_sources_one_per_page" DO UPDATE
   SET note = EXCLUDED.note, kind = EXCLUDED.kind, checked_on = EXCLUDED.checked_on
 WHERE item_sources.note IS DISTINCT FROM EXCLUDED.note OR item_sources.kind IS DISTINCT FROM EXCLUDED.kind;

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;

DROP TABLE "flavor_jobs_before", "stub_in", "prep_in", "alias_in", "line_in", "step_in", "source_in",
           "prep_row", "prep_lines", "prep_steps";
DROP FUNCTION pg_temp.shared(text);
DROP FUNCTION pg_temp.style(text);
DROP FUNCTION pg_temp.name_free(uuid, text);
RESET "app.image_worker";
