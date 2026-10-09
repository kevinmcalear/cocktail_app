-- Taxonomy v2: the "kind of" tree splits on what a drink is, legally and
-- physically (after 20261010600000). Step 0 of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
-- No new bottles. What changes:
--   * Two new shelves at the top of the tree. Mixer holds the sodas and
--     tonics that were 18 separate roots. Non-Alcoholic Drink holds the
--     zero-proof spirits, beer, wine, sake and cider, which sat inside the
--     drinks they imitate, so a bottle of zero-proof beer counted as Beer in
--     "can I make this". EU law keeps legal drink names off imitations
--     (Reg. (EU) 2019/787 Art. 10(7); CJEU C-563/24).
--   * Aromatised Wine (vermouth, quinquina, americano) stands on its own, not
--     inside Wine (Reg. (EU) No 251/2014), so vermouth no longer counts as wine.
--   * Tequila, Mezcal, Bacanora and Raicilla are kinds of Agave Spirit
--     (27 CFR 5.148), and Bourbon and Corn Whiskey kinds of American Whiskey
--     (27 CFR 5.143 and 5.154), so a spec asking for either finds them.
--   * Sweetened means liqueur: Sloe Gin is a liqueur, not a gin (Reg. (EU)
--     2019/787 Annex I cat. 35; 27 CFR 5.150), so a bottle of sloe gin no
--     longer makes a Martini. Peanut Butter Whiskey is a Whiskey Liqueur.
--   * Ambrato Vermouth is a kind of Bianco Vermouth: the Vermouth di Torino
--     rules (decree of 22 March 2017) make "bianco" run from straw to amber.
--   * A new Sour Mixer style under Acid, for bottled citrus replacements.
--   * 40 "X or Y" styles ("Gin or Vodka", "Olive or Lemon Twist") fold into
--     the first thing they name, or the style both share. Each spec line keeps
--     the other choice in its note ("or vodka"), and the folded name stays an
--     alias.
--   * Checked bottle fixes: 4 vermouths filed by colour; 9 bars' bottles
--     that had no role (or were filed as house preps) become bottles with
--     maker, ABV and label name; 4 copies fold into their bottle ("Lillet
--     Blanc Vermouth" is Lillet Blanc, an aperitif wine); Sūpāsawā goes to
--     Sour Mixer; 5 retail spellings become aliases ("Hong Xing Erguotou" is
--     Red Star). Each was checked against the producer or a major retailer;
--     the review sheet lists the page for every row.
--
-- Matched by name key; rows that don't exist are skipped and a second run
-- changes nothing more. Venue ingredients aren't touched: their names are
-- private. Bottles under styles named for a place ("Japanese Gin") stay put
-- until bottles carry a country of their own (step 1).

SET "app.image_worker" = 'on';

-- No paid flavour jobs (same rule as 20261010600000): note the queue now and
-- put it back at the end. A new parent changes a few drinks' flavour rules;
-- that refill runs separately, once it's OK'd.
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

-- The shared style with exactly this name (core or not).
CREATE FUNCTION pg_temp.style(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT i.id FROM public.items i
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role = 'generic'
       AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
     ORDER BY i.is_core DESC, i.created_at LIMIT 1;
$$;
-- The shared row a name means right now: its own name, else an alias.
CREATE FUNCTION pg_temp.shared(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT public.resolve_ingredient(p_name);
$$;
-- The shared row with exactly this name (no alias), never a core one.
CREATE FUNCTION pg_temp.own(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT i.id FROM public.items i
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND NOT i.is_core
       AND public.ingredient_key(i.name) = public.ingredient_key(p_name);
$$;

-- ---------------------------------------------------------------------------
-- New styles
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE generic_in (name text PRIMARY KEY, kind_of text);
INSERT INTO generic_in VALUES
($q$Mixer$q$, NULL),
($q$Non-Alcoholic Drink$q$, NULL),
($q$Non-Alcoholic Wine$q$, $q$Non-Alcoholic Drink$q$),
($q$Sour Mixer$q$, $q$Acid$q$);

CREATE TEMP TABLE "made_now" ("id" uuid PRIMARY KEY);

WITH ins AS (
    INSERT INTO public.items (name, item_type, ingredient_role, hide_from_search)
    SELECT g.name, 'ingredient', 'generic', false FROM generic_in g
     WHERE pg_temp.shared(g.name) IS NULL
    RETURNING id
)
INSERT INTO made_now SELECT id FROM ins;

-- A new name can pick up a core suffix as its kind ("... Wine"); set it as meant.
UPDATE public.items i SET generic_id = pg_temp.style(g.kind_of)
  FROM generic_in g
 WHERE i.id = pg_temp.shared(g.name) AND i.id IN (SELECT id FROM made_now)
   AND i.generic_id IS DISTINCT FROM pg_temp.style(g.kind_of);

-- ---------------------------------------------------------------------------
-- Where each style sits
-- ---------------------------------------------------------------------------

-- kind_of NULL makes a top-level shelf.
CREATE TEMP TABLE move_in (name text PRIMARY KEY, kind_of text);
INSERT INTO move_in VALUES
-- Mixer: carbonated and soft drinks for topping a drink.
($q$Bitter Lemon$q$, $q$Mixer$q$),
($q$Chinotto$q$, $q$Mixer$q$),
($q$Cola$q$, $q$Mixer$q$),
($q$Cream Soda$q$, $q$Mixer$q$),
($q$Energy Drink$q$, $q$Mixer$q$),
($q$Ginger Ale$q$, $q$Mixer$q$),
($q$Ginger Beer$q$, $q$Mixer$q$),
($q$Grapefruit Soda$q$, $q$Mixer$q$),
($q$Guava Soda$q$, $q$Mixer$q$),
($q$Lemon-lime Soda$q$, $q$Mixer$q$),
($q$Lemonade$q$, $q$Mixer$q$),
($q$Orange Soda$q$, $q$Mixer$q$),
($q$Peach Soda$q$, $q$Mixer$q$),
($q$Pineapple Soda$q$, $q$Mixer$q$),
($q$Root Beer$q$, $q$Mixer$q$),
($q$Sarsaparilla$q$, $q$Mixer$q$),
($q$Soda Water$q$, $q$Mixer$q$),
($q$Tonic Water$q$, $q$Mixer$q$),
-- Non-Alcoholic Drink: imitations sit beside, not inside, what they imitate.
($q$Non-alcoholic Spirit$q$, $q$Non-Alcoholic Drink$q$),
($q$Non-Alcoholic Beer$q$, $q$Non-Alcoholic Drink$q$),
($q$Non-Alcoholic Sake$q$, $q$Non-Alcoholic Drink$q$),
($q$Non-Alcoholic Pear Cider$q$, $q$Non-Alcoholic Drink$q$),
($q$Non-Alcoholic Sparkling Wine$q$, $q$Non-Alcoholic Wine$q$),
($q$Alcohol Free Rosé Wine$q$, $q$Non-Alcoholic Wine$q$),
($q$Alcohol Free White Wine$q$, $q$Non-Alcoholic Wine$q$),
($q$Non-Alcoholic Shiraz$q$, $q$Non-Alcoholic Wine$q$),
($q$Non-Alc Prosecco$q$, $q$Non-Alcoholic Sparkling Wine$q$),
-- Aromatised wine is its own category (Reg. (EU) No 251/2014), not a wine.
($q$Aromatised Wine$q$, NULL),
-- Agave spirits (27 CFR 5.148; the Bacanora and Raicilla appellations).
($q$Tequila$q$, $q$Agave Spirit$q$),
($q$Mezcal$q$, $q$Agave Spirit$q$),
($q$Bacanora$q$, $q$Agave Spirit$q$),
($q$Raicilla$q$, $q$Agave Spirit$q$),
($q$Agave Blanco$q$, $q$Agave Spirit$q$),
($q$Quarter Proof Blanco Agave Spirit$q$, $q$Agave Spirit$q$),
-- American whiskey types (27 CFR 5.143; bourbon is a distinctive US product, 5.154).
($q$Bourbon$q$, $q$American Whiskey$q$),
($q$Corn Whiskey$q$, $q$American Whiskey$q$),
-- Sweetened is a liqueur (Reg. (EU) 2019/787 Annex I cat. 35; 27 CFR 5.150).
($q$Sloe Gin$q$, $q$Liqueur$q$),
($q$Peanut Butter Whiskey$q$, $q$Whiskey Liqueur$q$),
-- Vermouth di Torino: "bianco" runs from straw to amber (decree of 22 March 2017).
($q$Ambrato Vermouth$q$, $q$Bianco Vermouth$q$);

UPDATE public.items i SET generic_id = pg_temp.style(m.kind_of)
  FROM move_in m
 WHERE i.id = pg_temp.style(m.name)
   AND (m.kind_of IS NULL OR (pg_temp.style(m.kind_of) IS NOT NULL AND pg_temp.style(m.kind_of) <> i.id))
   AND i.generic_id IS DISTINCT FROM pg_temp.style(m.kind_of);

-- ---------------------------------------------------------------------------
-- "X or Y" styles fold into one
-- ---------------------------------------------------------------------------

-- into_name: the first thing named, or the style both share. note: the other
-- choice, added to each spec line that used the folded row.
CREATE TEMP TABLE fold_in (from_name text PRIMARY KEY, into_name text NOT NULL, note text);
INSERT INTO fold_in VALUES
($q$Absolut Vodka Or Beefeater Gin$q$, $q$Absolut Vodka$q$, $q$or Beefeater Gin$q$),
($q$Aperol or Campari$q$, $q$Aperol$q$, $q$or Campari$q$),
($q$Appleton 12 Year or Plantation Jamaica 2001 Aged Jamaican Rum$q$, $q$Aged Jamaican Rum$q$, $q$Appleton 12 Year or Plantation Jamaica 2001$q$),
($q$Blackberry Brandy / Cassis$q$, $q$Crème de Mûre$q$, $q$or crème de cassis$q$),
($q$Bourbon or Rye$q$, $q$Bourbon$q$, $q$or rye$q$),
($q$Bourbon, Scotch or Tequila$q$, $q$Bourbon$q$, $q$or Scotch, or tequila$q$),
($q$Brandied cherry (preferably Luxardo) or lemon twist$q$, $q$Brandied cherry$q$, $q$preferably Luxardo, or a lemon twist$q$),
($q$Choice Of Spirit$q$, $q$Spirit$q$, $q$your choice$q$),
($q$Clément Créole Shrubb or Pierre Ferrand Dry Curaçao$q$, $q$Orange Liqueur$q$, $q$Clément Créole Shrubb or Pierre Ferrand Dry Curaçao$q$),
($q$Cognac or Gin$q$, $q$Cognac$q$, $q$or gin$q$),
($q$Cold Brew Or Cream$q$, $q$Cold Brew$q$, $q$or cream$q$),
($q$Dark/blackstrap Rum$q$, $q$Dark Rum$q$, $q$or blackstrap rum$q$),
($q$Dash Absinthe / Suze$q$, $q$Absinthe$q$, $q$or Suze$q$),
($q$Dehydrated orange or orange peel twist$q$, $q$Dried Orange$q$, $q$or an orange peel twist$q$),
($q$Dry/Bianco Vermouth$q$, $q$Dry Vermouth$q$, $q$or bianco vermouth$q$),
($q$Dubonnet or Byrrh$q$, $q$Dubonnet Rouge$q$, $q$or Byrrh$q$),
($q$Edible flower or freeze-dried raspberry$q$, $q$Edible flower$q$, $q$or a freeze-dried raspberry$q$),
($q$Fever-Tree or Fentimans$q$, $q$Ginger Beer$q$, $q$Fever-Tree or Fentimans$q$),
($q$Float Claret / Blackberry Wine$q$, $q$Red Wine$q$, $q$claret or blackberry wine, floated$q$),
($q$Ford's Gin Or Elijah Craig Bourbon$q$, $q$Ford's Gin$q$, $q$or Elijah Craig bourbon$q$),
($q$Gin or Botanical Cane Distillate$q$, $q$Gin$q$, $q$or a botanical cane distillate$q$),
($q$Gin or Vodka$q$, $q$Gin$q$, $q$or vodka$q$),
($q$Jamaican or Blackstrap Rum$q$, $q$Jamaican Rum$q$, $q$or blackstrap rum$q$),
($q$Lemon peel or lemon wheel$q$, $q$Lemon Peel$q$, $q$or a lemon wheel$q$),
($q$Lemon twist or olives$q$, $q$Lemon Twist$q$, $q$or olives$q$),
($q$Lemon wedge, or fresh currants in season$q$, $q$Lemon Wedge$q$, $q$or fresh currants in season$q$),
($q$Lime wedge or wheel$q$, $q$Lime Wedge$q$, $q$or a wheel$q$),
($q$Maraschino cherry and/or lime wedge$q$, $q$Maraschino Cherry$q$, $q$and/or a lime wedge$q$),
($q$Nocellara Green Olive or Lemon Zest$q$, $q$Nocellara Olives$q$, $q$or lemon zest$q$),
($q$Olive or lemon peel$q$, $q$Olive$q$, $q$or lemon peel$q$),
($q$Olive or Lemon Twist$q$, $q$Olive$q$, $q$or a lemon twist$q$),
($q$Orange or lemon peel$q$, $q$Orange Peel$q$, $q$or lemon peel$q$),
($q$Orange slice or orange peel$q$, $q$Orange slice$q$, $q$or orange peel$q$),
($q$Orgeat Works or Small Hand Foods$q$, $q$Orgeat$q$, $q$Orgeat Works or Small Hand Foods$q$),
($q$Passoã or De Kuyper$q$, $q$Passion Fruit Liqueur$q$, $q$Passoã or De Kuyper$q$),
($q$Prosecco or Other Dry Sparkling Wine, To Top$q$, $q$Prosecco$q$, $q$or another dry sparkling wine, to top$q$),
($q$Quill Gin Or Vodka$q$, $q$Quill Gin$q$, $q$or vodka$q$),
($q$Rhubarb stick or fresh raspberries$q$, $q$Rhubarb$q$, $q$a stick, or fresh raspberries$q$),
($q$Salt or Tajín rim$q$, $q$Salt$q$, $q$or a Tajín rim$q$),
($q$Tequila Or Whisky$q$, $q$Tequila$q$, $q$or whisky$q$);

-- Spec lines keep the other choice in their note.
UPDATE public.recipes r SET preparation_notes = concat_ws('; ', NULLIF(btrim(r.preparation_notes), ''), f.note)
  FROM fold_in f
 WHERE r.ingredient_item_id = pg_temp.style(f.from_name)
   AND f.note IS NOT NULL
   AND pg_temp.shared(f.into_name) IS NOT NULL
   AND pg_temp.shared(f.into_name) <> pg_temp.style(f.from_name)
   AND position(lower(f.note) IN lower(coalesce(r.preparation_notes, ''))) = 0;

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT f.from_name, f.into_name FROM fold_in f ORDER BY f.from_name LOOP
        CONTINUE WHEN pg_temp.style(r.from_name) IS NULL OR pg_temp.shared(r.into_name) IS NULL
                   OR pg_temp.style(r.from_name) = pg_temp.shared(r.into_name);
        PERFORM private.merge_ingredient(pg_temp.style(r.from_name), pg_temp.shared(r.into_name));
    END LOOP;
END;
$$;

-- A bourbon-and-rye prep the fold left under Bourbon belongs to both.
UPDATE public.items i SET generic_id = pg_temp.style($q$American Whiskey$q$)
 WHERE i.id = pg_temp.own($q$Bourbon and Rye Infused with Vanilla Bean$q$)
   AND pg_temp.style($q$American Whiskey$q$) IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Checked bottle fixes
-- ---------------------------------------------------------------------------

-- Each row below was checked on 2026-10-09 against the producer or a major
-- retailer (the review sheet has the page for every one). Rows a source
-- couldn't settle stay as they are: brand names that cover several bottles
-- ("Dolin", "Carpano Vermouth", "Capel Pisco"), and vermouths no source
-- gave a colour for.

-- Bottles that were bars' names with no role yet.
CREATE TEMP TABLE bottle_in (name text PRIMARY KEY, kind_of text NOT NULL, maker text NOT NULL, abv numeric);
INSERT INTO bottle_in VALUES
($q$Casa Dragones Reposado Mizunara$q$, $q$Reposado Tequila$q$, $q$Casa Dragones$q$, 40),
($q$Centenario Reposado Tequila$q$, $q$Reposado Tequila$q$, $q$Gran Centenario$q$, 40),
($q$Citadelle Jardin Gin$q$, $q$Gin$q$, $q$Citadelle$q$, 41.5),
($q$Glendalough Wild Botanical Gin$q$, $q$Gin$q$, $q$Glendalough$q$, 41),
($q$Knob Creek Single Barrel Bourbon$q$, $q$Bourbon$q$, $q$Knob Creek$q$, 60),
($q$Monkey 47 Gin$q$, $q$Gin$q$, $q$Monkey 47$q$, 47),
($q$Redemption High Rye Bourbon$q$, $q$Bourbon$q$, $q$Redemption$q$, 46),
($q$Widow Jane Apple Whiskey$q$, $q$Whiskey$q$, $q$Widow Jane$q$, 45.5),
($q$Wyoming Small Batch Bourbon$q$, $q$Bourbon$q$, $q$Wyoming Whiskey$q$, 44),
-- Monin's Paragon range: bought cordials, not house preps.
($q$Paragon Timur Berry$q$, $q$Cordial$q$, $q$Monin$q$, NULL),
($q$Paragon Vetiver$q$, $q$Cordial$q$, $q$Monin$q$, NULL);

UPDATE public.items i SET
    ingredient_role = 'product',
    made_from_id = NULL,
    generic_id = pg_temp.style(b.kind_of),
    brand_maker = COALESCE(NULLIF(btrim(i.brand_maker), ''), b.maker),
    abv = COALESCE(i.abv, b.abv)
  FROM bottle_in b
 WHERE i.id = pg_temp.own(b.name)
   AND i.ingredient_role IS DISTINCT FROM 'generic'
   AND pg_temp.style(b.kind_of) IS NOT NULL;

-- Bottles on a better style: vermouths by colour, Sūpāsawā as a sour mixer,
-- a zero-proof sparkling wine with the zero-proof wines.
CREATE TEMP TABLE restyle_in (name text PRIMARY KEY, kind_of text NOT NULL);
INSERT INTO restyle_in VALUES
($q$Bordiga Excelsior Vermouth$q$, $q$Sweet Vermouth$q$),
($q$Gotha Marcvs Vermouth$q$, $q$Sweet Vermouth$q$),
($q$Giovannoni Torrontés Vermouth$q$, $q$Dry Vermouth$q$),
($q$Unico Zelo Pomelo Vermouth$q$, $q$Dry Vermouth$q$),
($q$Supasawa$q$, $q$Sour Mixer$q$),
-- Its own label says it's alcohol-free.
($q$Noughty Non-Alcoholic Sparkling Chardonnay$q$, $q$Non-Alcoholic Sparkling Wine$q$);

UPDATE public.items i SET generic_id = pg_temp.style(r.kind_of)
  FROM restyle_in r
 WHERE i.id = pg_temp.own(r.name)
   AND i.ingredient_role = 'product'
   AND pg_temp.style(r.kind_of) IS NOT NULL
   AND i.generic_id IS DISTINCT FROM pg_temp.style(r.kind_of);

-- Copies of the same bottle.
CREATE TEMP TABLE merge_in (from_name text PRIMARY KEY, into_name text NOT NULL);
INSERT INTO merge_in VALUES
($q$Casa Dragones Reposado Tequila$q$, $q$Casa Dragones Reposado Mizunara$q$),
($q$Lillet Blanc Vermouth$q$, $q$Lillet Blanc$q$),
($q$Monkey 47 Dry Gin$q$, $q$Monkey 47 Gin$q$),
($q$Monkey 47 Schwarzwald Dry Gin$q$, $q$Monkey 47 Gin$q$);

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT m.from_name, m.into_name FROM merge_in m ORDER BY m.from_name LOOP
        CONTINUE WHEN pg_temp.own(r.from_name) IS NULL OR pg_temp.shared(r.into_name) IS NULL
                   OR pg_temp.own(r.from_name) = pg_temp.shared(r.into_name);
        PERFORM private.merge_ingredient(pg_temp.own(r.from_name), pg_temp.shared(r.into_name));
    END LOOP;
END;
$$;

-- Other names a bottle goes by (retail spellings, the old brand name).
CREATE TEMP TABLE alias_in (alias text PRIMARY KEY, name text NOT NULL);
INSERT INTO alias_in VALUES
($q$Hong Xing Erguotou$q$, $q$Red Star Erguotou$q$),
($q$Hongxing Erguotou$q$, $q$Red Star Erguotou$q$),
($q$Plantation XO 20th Anniversary$q$, $q$Planteray XO Rum$q$),
($q$Plantation XO$q$, $q$Planteray XO Rum$q$),
($q$Grant's Family Reserve$q$, $q$Grant's Triple Wood$q$);

INSERT INTO public.ingredient_aliases (key, item_id)
SELECT public.ingredient_key(a.alias), pg_temp.shared(a.name)
  FROM alias_in a
 WHERE pg_temp.shared(a.name) IS NOT NULL
   AND pg_temp.shared(a.alias) IS NULL
ON CONFLICT (key) DO NOTHING;

-- Proper label names, brand first; the old name stays an alias. Skipped when
-- another shared row already has that name.
CREATE TEMP TABLE rename_in (name text PRIMARY KEY, new_name text NOT NULL);
INSERT INTO rename_in VALUES
($q$Absolut Raspberry Vodka$q$, $q$Absolut Raspberri$q$),
($q$Centenario Reposado Tequila$q$, $q$Gran Centenario Reposado$q$),
($q$Citadelle Jardin Gin$q$, $q$Citadelle Jardin d'Été$q$),
($q$Glendalough Wild Botanical Gin$q$, $q$Glendalough Wild Botanical Irish Gin$q$),
($q$Knob Creek Single Barrel Bourbon$q$, $q$Knob Creek Single Barrel Reserve$q$),
($q$Monkey 47 Gin$q$, $q$Monkey 47 Schwarzwald Dry Gin$q$),
($q$Paragon Timur Berry$q$, $q$Paragon Timur Berry Cordial$q$),
($q$Paragon Vetiver$q$, $q$Paragon Vetiver Cordial$q$),
($q$Planteray XO Rum$q$, $q$Planteray XO 20th Anniversary$q$),
($q$Supasawa$q$, $q$Sūpāsawā$q$),
($q$Widow Jane Apple Whiskey$q$, $q$Widow Jane Applewood Rye Whiskey$q$),
($q$Wyoming Small Batch Bourbon$q$, $q$Wyoming Whiskey Small Batch Bourbon$q$);

SET "app.ingredient_merge" = 'on';
CREATE TEMP TABLE "renamed" AS
SELECT pg_temp.own(r.name) AS id, r.name AS old_name, r.new_name
  FROM rename_in r
 WHERE pg_temp.own(r.name) IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM public.items o
        WHERE o.item_type = 'ingredient' AND o.bar_id IS NULL AND o.id <> pg_temp.own(r.name)
          AND public.ingredient_key(o.name) = public.ingredient_key(r.new_name));
UPDATE public.items i SET name = r.new_name FROM renamed r WHERE i.id = r.id;
DELETE FROM public.ingredient_aliases a USING renamed r
 WHERE a.key = public.ingredient_key(r.new_name);
INSERT INTO public.ingredient_aliases (key, item_id)
SELECT public.ingredient_key(r.old_name), r.id FROM renamed r
 WHERE public.ingredient_key(r.old_name) <> public.ingredient_key(r.new_name)
ON CONFLICT (key) DO UPDATE SET item_id = EXCLUDED.item_id;
RESET "app.ingredient_merge";

DROP TABLE "bottle_in", "restyle_in", "merge_in", "alias_in", "rename_in", "renamed";

-- ---------------------------------------------------------------------------
-- No loops ("A is a kind of B is a kind of A"): drop a non-core link in each.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_id uuid;
BEGIN
    LOOP
        WITH RECURSIVE walk(start, cur, depth, path) AS (
            SELECT id, generic_id, 1, ARRAY[id] FROM public.items WHERE item_type = 'ingredient' AND generic_id IS NOT NULL
            UNION ALL
            SELECT w.start, i.generic_id, w.depth + 1, w.path || i.id
              FROM walk w JOIN public.items i ON i.id = w.cur
             WHERE i.generic_id IS NOT NULL AND NOT i.id = ANY (w.path[2:]) AND w.depth < 12
        )
        SELECT w.start INTO v_id FROM walk w JOIN public.items i ON i.id = w.start
         WHERE w.cur = w.start ORDER BY i.is_core, w.start LIMIT 1;
        EXIT WHEN v_id IS NULL;
        UPDATE public.items SET generic_id = NULL WHERE id = v_id;
    END LOOP;
END;
$$;

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;
DROP TABLE "flavor_jobs_before";

DROP TABLE "made_now", "generic_in", "move_in", "fold_in";
DROP FUNCTION pg_temp.style(text);
DROP FUNCTION pg_temp.shared(text);
DROP FUNCTION pg_temp.own(text);
RESET "app.image_worker";
