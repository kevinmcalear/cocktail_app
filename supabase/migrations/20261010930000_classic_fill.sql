-- Filling in the classics bars pour, step 8 of the served-at plan, as Kevin
-- OK'd it on 2026-10-09 (plan: https://claude.ai/artifact/4d72TeruptQYbcXgB3b1cx).
--
-- Bars' drinks scraped from menus often have a name and nothing else. Where
-- the name says which classic it is, the drink gets that classic's spec and a
-- link to it, never over a recipe a bar wrote:
--   * items.spec_source says where a spec came from: 'bar' (the default) or
--     'classic' (filled in here from spec_from_id). A filled spec is never the
--     bar's choice: its verdict is "unlisted", and the drink page says it came
--     from the classic. The first time anyone signed in edits its spec, it is
--     the bar's ('bar' again). Only app admins can mark a spec 'classic'.
--   * A bar's drink with no lines and a classic's exact name (or one of its
--     aliases) gets the classic's lines.
--   * A classic's name plus an ingredient ("Pandan Negroni") gets the classic's
--     lines plus that ingredient with no amount; a named spirit swaps the base
--     ("Tequila Gimlet"); a fruit swaps a Bellini's purée. A classic's name
--     plus other words ("Guest Negroni"), a "-tini" ("Watermelon Martini") or a
--     style word ("Gold Rush Fizz") is linked as a riff, with nothing added.
--   * public.classic_aliases: true synonyms only, each with a source ("Soixante
--     Quinze" for the French 75). An alias counts as the classic's name for
--     linking and the same-spec check; it never writes a recipe.
--   * A seeded drink named exactly like one classic but linked to another
--     (14 "Dirty Martini"s linked to the Martini) moves to its own classic.
-- Only shared, credited drinks the seeds made (no venue, no owner) are touched;
-- nothing with a recipe line gets lines. Linked drinks take the seeds' linked
-- label ('Varient').
--
-- Then the flavour refill Kevin OK'd: every drink whose spec no longer matches
-- its saved flavour profile (the ingredient tree fills 20261010720000 and
-- 20261010920000, and the specs filled here) is queued. With FLAVOR_MODEL=live,
-- ingredients the rules don't know and no cached answer reach the model once
-- per drink (estimated under $10).

SET "app.image_worker" = 'on';

-- --- Where a spec came from ---

ALTER TABLE "public"."items"
    ADD COLUMN "spec_source" "text" DEFAULT 'bar' NOT NULL CHECK ("spec_source" IN ('bar', 'classic')),
    ADD COLUMN "spec_from_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."items"."spec_source" IS
    'bar: the spec is the drink''s own. classic: filled in from spec_from_id (a classic) because the bar published none.';

-- Only an app admin (or a migration) marks a spec as the classic's.
CREATE FUNCTION "private"."guard_spec_source"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    IF NEW.spec_source = 'classic' AND (TG_OP = 'INSERT' OR OLD.spec_source IS DISTINCT FROM 'classic') THEN
        RAISE EXCEPTION 'Only the catalog can mark a spec as the classic''s.';
    END IF;
    IF NEW.spec_from_id IS DISTINCT FROM (CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.spec_from_id END) AND NEW.spec_from_id IS NOT NULL THEN
        RAISE EXCEPTION 'Only the catalog can mark a spec as the classic''s.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_spec_source" BEFORE INSERT OR UPDATE OF "spec_source", "spec_from_id" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_spec_source"();

-- Someone signed in edited the spec: it's the bar's now. Named to fire before
-- the spec_match triggers (alphabetical), so the verdict sees it.
CREATE FUNCTION "private"."claim_spec_on_edit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'DELETE' THEN
        UPDATE public.items i SET spec_source = 'bar', spec_from_id = NULL
          WHERE i.spec_source = 'classic' AND i.id IN (SELECT recipe_item_id FROM old_lines);
    ELSE
        UPDATE public.items i SET spec_source = 'bar', spec_from_id = NULL
          WHERE i.spec_source = 'classic' AND i.id IN (SELECT recipe_item_id FROM new_lines);
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "claim_spec_on_edit_inserted" AFTER INSERT ON "public"."recipes"
    REFERENCING NEW TABLE AS "new_lines" FOR EACH STATEMENT EXECUTE FUNCTION "private"."claim_spec_on_edit"();
CREATE TRIGGER "claim_spec_on_edit_updated" AFTER UPDATE ON "public"."recipes"
    REFERENCING NEW TABLE AS "new_lines" OLD TABLE AS "old_lines" FOR EACH STATEMENT EXECUTE FUNCTION "private"."claim_spec_on_edit"();
CREATE TRIGGER "claim_spec_on_edit_deleted" AFTER DELETE ON "public"."recipes"
    REFERENCING OLD TABLE AS "old_lines" FOR EACH STATEMENT EXECUTE FUNCTION "private"."claim_spec_on_edit"();

REVOKE ALL ON FUNCTION "private"."guard_spec_source"() FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."claim_spec_on_edit"() FROM PUBLIC, "anon", "authenticated";

-- --- Classic aliases ---

CREATE TABLE "public"."classic_aliases" (
    "classic_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "alias" "text" NOT NULL CHECK (char_length(btrim("alias")) BETWEEN 1 AND 80),
    "alias_key" "text" GENERATED ALWAYS AS (private.drink_name_key("alias")) STORED PRIMARY KEY,
    "source" "text" NOT NULL CHECK ("source" ~ '^https://')
);
CREATE INDEX "classic_aliases_classic_idx" ON "public"."classic_aliases" ("classic_id");
ALTER TABLE "public"."classic_aliases" ENABLE ROW LEVEL SECURITY;
-- Reference data: everyone reads, only SQL and the service role write.
CREATE POLICY "classic_aliases_select" ON "public"."classic_aliases" FOR SELECT TO "anon", "authenticated" USING (true);
GRANT SELECT ON "public"."classic_aliases" TO "anon", "authenticated";
GRANT ALL ON "public"."classic_aliases" TO "service_role";

CREATE TEMP TABLE alias_in (classic text NOT NULL, alias text NOT NULL, source text NOT NULL);
INSERT INTO alias_in VALUES
($q$French 75$q$, $q$Soixante Quinze$q$, $q$https://www.diffordsguide.com/encyclopedia/1267/cocktails/french-75-cocktail-history$q$),
($q$Ramos Gin Fizz$q$, $q$New Orleans Fizz$q$, $q$https://en.wikipedia.org/wiki/Fizz_(cocktail)$q$),
($q$Ramos Gin Fizz$q$, $q$Ramos Fizz$q$, $q$https://en.wikipedia.org/wiki/Fizz_(cocktail)$q$),
($q$Espresso Martini$q$, $q$Pharmaceutical Stimulant$q$, $q$https://punchdrink.com/articles/how-espresso-martini-became-modern-classic-cocktail-recipe/$q$),
($q$Hemingway Daiquiri$q$, $q$Hemingway Special$q$, $q$https://www.diffordsguide.com/cocktails/recipe/954/hemingway-special-daiquiri-papa-doble$q$),
($q$Death in the Afternoon$q$, $q$Hemingway Champagne$q$, $q$https://en.wikipedia.org/wiki/Death_in_the_Afternoon_(cocktail)$q$),
($q$Cape Codder$q$, $q$Vodka Cranberry$q$, $q$https://punchdrink.com/articles/rescuing-cape-codder-vodka-cranberry/$q$),
($q$Cape Codder$q$, $q$Cape Cod$q$, $q$https://tastingtable.com/1520446/origin-cape-codder-vodka-cranberry$q$),
($q$Caesar$q$, $q$Bloody Caesar$q$, $q$https://en.wikipedia.org/wiki/Caesar_(cocktail)$q$),
($q$Kir$q$, $q$Blanc Cassis$q$, $q$https://en.wikipedia.org/wiki/Kir_(cocktail)$q$),
($q$Kir Royale$q$, $q$Kir Royal$q$, $q$https://falstaff.com/en/news/the-mayors-legacy-the-kir-royal$q$),
($q$Fernet con Coca$q$, $q$Fernandito$q$, $q$https://en.wikipedia.org/wiki/Fernet_con_coca$q$),
($q$Fernet con Coca$q$, $q$Fernet and Coke$q$, $q$https://en.wikipedia.org/wiki/Fernet_con_coca$q$),
($q$Kalimotxo$q$, $q$Calimocho$q$, $q$https://en.wikipedia.org/wiki/Kalimotxo$q$),
($q$Gin Basil Smash$q$, $q$Gin Pesto$q$, $q$https://www.diffordsguide.com/cocktails/recipe/3282/gin-basil-smash-gin-pesto$q$),
($q$Vodka Martini$q$, $q$Kangaroo$q$, $q$https://australianbartender.com.au/2018/11/06/kangaroo-cocktail/$q$),
($q$Porn Star Martini$q$, $q$Pornstar Martini$q$, $q$https://vinepair.com/cocktail-recipe/pornstar-martini$q$),
($q$Porn Star Martini$q$, $q$Maverick Martini$q$, $q$https://vinepair.com/cocktail-recipe/pornstar-martini$q$),
($q$Reverse Martini$q$, $q$Upside Down Martini$q$, $q$https://themartinisocialist.com/the-upside-down-martini/$q$),
($q$Milano Torino$q$, $q$Mi-To$q$, $q$https://www.diffordsguide.com/cocktails/recipe/3495/milano-torino-mi-to$q$),
($q$Garibaldi$q$, $q$Campari Orange$q$, $q$https://www.acouplecooks.com/garibaldi-cocktail-campari-orange/print/80515/$q$),
($q$Caipiroska$q$, $q$Caipivodka$q$, $q$https://en.wikipedia.org/wiki/Caipiroska$q$),
($q$De La Louisiane$q$, $q$La Louisiane$q$, $q$https://punchdrink.com/recipes/de-la-louisiane/$q$),
($q$De La Louisiane$q$, $q$Cocktail à la Louisiane$q$, $q$https://punchdrink.com/recipes/de-la-louisiane/$q$),
($q$De La Louisiane$q$, $q$A La Louisiane$q$, $q$https://imbibemagazine.com/a-la-louisiane/$q$),
($q$White Lady$q$, $q$Delilah$q$, $q$https://en.wikipedia.org/wiki/White_lady_(cocktail)$q$),
($q$White Lady$q$, $q$Chelsea Sidecar$q$, $q$https://en.wikipedia.org/wiki/White_lady_(cocktail)$q$),
($q$Ti' Punch$q$, $q$Petit Punch$q$, $q$https://www.diffordsguide.com/en-au/cocktails/recipe/1952/ti-punch$q$),
($q$Dark 'n Stormy$q$, $q$Dark and Stormy$q$, $q$https://en.wikipedia.org/wiki/Dark_%27n%27_stormy$q$),
($q$Corpse Reviver #2$q$, $q$Corpse Reviver No. 2$q$, $q$https://punchdrink.com/recipes/corpse-reviver-2/$q$),
($q$Corpse Reviver #1$q$, $q$Corpse Reviver No. 1$q$, $q$https://www.diffordsguide.com/cocktails/recipe/471/corpse-reviver-no-1$q$),
($q$Sbagliato$q$, $q$Negroni Sbagliato$q$, $q$https://archive.jamesbeard.org/recipes/negroni-sbagliato$q$),
($q$Rob Roy$q$, $q$Scotch Manhattan$q$, $q$https://en.wikipedia.org/wiki/Rob_Roy_(cocktail)$q$),
($q$Gin and It$q$, $q$Gin and Italian$q$, $q$https://www.diffordsguide.com/cocktails/recipe/833/gin-and-it$q$),
($q$Pompier$q$, $q$Vermouth Cassis$q$, $q$https://www.diffordsguide.com/cocktails/recipe/5809/pompier$q$),
($q$Agavoni$q$, $q$Tequila Negroni$q$, $q$https://cold-glass.com/2012/05/24/tequila-and-mezcal-messing-with-the-negroni/$q$),
($q$Agavoni$q$, $q$Tegroni$q$, $q$https://cold-glass.com/2012/05/24/tequila-and-mezcal-messing-with-the-negroni/$q$),
($q$Negroski$q$, $q$Vodka Negroni$q$, $q$https://www.foodrepublic.com/recipes/the-negroski/$q$),
($q$Gin Buck$q$, $q$London Buck$q$, $q$https://bar-vademecum.eu/gin-buck/$q$),
($q$Appletini$q$, $q$Apple Martini$q$, $q$https://www.diffordsguide.com/cocktails/recipe/1797/appletini-sour-apple-martini$q$),
($q$Appletini$q$, $q$Sour Apple Martini$q$, $q$https://www.diffordsguide.com/cocktails/recipe/1797/appletini-sour-apple-martini$q$),
($q$Cosmopolitan$q$, $q$Cosmo$q$, $q$https://en.wikipedia.org/wiki/Cosmopolitan_(cocktail)$q$),
($q$Hugo$q$, $q$Hugo Spritz$q$, $q$https://www.diffordsguide.com/cocktails/recipe/5039/hugo-spritz$q$),
($q$Lemon Drop$q$, $q$Lemon Drop Martini$q$, $q$https://vinepair.com/cocktail-recipe/lemon-drop-recipe/$q$),
($q$Twentieth Century$q$, $q$20th Century$q$, $q$https://en.wikipedia.org/wiki/20th_century_(cocktail)$q$),
($q$Ward 8$q$, $q$Ward Eight$q$, $q$https://www.diffordsguide.com/en-au/cocktails/recipe/2062/ward-eight$q$),
($q$Southside$q$, $q$South Side$q$, $q$https://en.wikipedia.org/wiki/South_Side_(cocktail)$q$),
($q$Vesper$q$, $q$Vesper Martini$q$, $q$https://en.wikipedia.org/wiki/Vesper_(cocktail)$q$),
($q$Whiskey Sour$q$, $q$Whisky Sour$q$, $q$https://en.wikipedia.org/wiki/Whiskey_sour$q$),
($q$Gin and Tonic$q$, $q$G&T$q$, $q$https://en.wikipedia.org/wiki/Gin_and_tonic$q$),
($q$Café Brûlot$q$, $q$Café Brûlot Diabolique$q$, $q$https://www.neworleans.com/drink/cocktails/cafe-brulot-diabolique$q$),
($q$Fifty-Fifty$q$, $q$Fifty-Fifty Martini$q$, $q$https://punchdrink.com/recipes/plymouth-gin-fifty-fifty-martini/$q$),
($q$Fifty-Fifty$q$, $q$50/50 Martini$q$, $q$https://tastingtable.com/1176848/what-is-a-5050-martini-composed-of$q$),
($q$Floridita Daiquiri$q$, $q$Daiquiri No. 4$q$, $q$https://punchdrink.com/recipes/daiquiri-4-daiquiri-floridita-hemingway-daiquiri/$q$),
($q$Black Velvet$q$, $q$Champagne Velvet$q$, $q$https://www.diffordsguide.com/cocktails/recipe/237/black-velvet$q$),
($q$Rum Swizzle$q$, $q$Bermuda Rum Swizzle$q$, $q$https://www.smithsonianmag.com/travel/story-behind-bermudas-rum-swizzle-cocktail-180971701/$q$);

-- An alias never shadows a classic with that exact name, and names one classic.
INSERT INTO public.classic_aliases (classic_id, alias, source)
SELECT c.id, a.alias, a.source
  FROM alias_in a
  JOIN public.items c ON c.is_catalog AND c.item_type = 'cocktail' AND private.drink_name_key(c.name) = private.drink_name_key(a.classic)
 WHERE NOT EXISTS (SELECT 1 FROM public.items o WHERE o.is_catalog AND o.item_type = 'cocktail'
                    AND private.drink_name_key(o.name) = private.drink_name_key(a.alias))
ON CONFLICT (alias_key) DO NOTHING;

-- --- The same-spec check knows aliases and filled specs ---

CREATE OR REPLACE FUNCTION "private"."spec_match_compute"("p_item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_item public.items;
    v_classic public.items;
    v_verdict text;
    v_diff jsonb;
    v_has_amounts boolean;
    v_core integer;
    v_extra integer;
    v_drop integer;
    v_measures integer;
BEGIN
    SELECT * INTO v_item FROM public.items WHERE id = p_item_id;
    IF NOT FOUND OR v_item.item_type <> 'cocktail' OR v_item.is_catalog OR v_item.riff_of_id IS NULL THEN
        DELETE FROM private.item_spec_matches WHERE item_id = p_item_id;
        RETURN;
    END IF;
    SELECT * INTO v_classic FROM public.items WHERE id = v_item.riff_of_id;
    IF NOT FOUND OR NOT v_classic.is_catalog OR v_classic.item_type <> 'cocktail' THEN
        DELETE FROM private.item_spec_matches WHERE item_id = p_item_id;
        RETURN;
    END IF;

    WITH RECURSIVE lines AS (
        SELECT r.id, r.recipe_item_id = p_item_id AS bar, r.ingredient_item_id AS ing, r.parent_ingredient_id AS pg,
               i.name, i.ingredient_role AS role, i.generic_id AS g1, r.amount,
               -- Garnishes and optional lines, as My Bar reads them (20261010300000).
               (coalesce(r.is_optional, false)
                OR coalesce(r.preparation_notes ~* '\mgarnish', false)
                OR coalesce(lower(r.unit) IN ('peel', 'twist', 'wheel', 'rim', 'slice', 'wedge', 'sprig', 'leaf', 'leaves', 'piece', 'each'), false)
                OR coalesce(i.name ~* '(\m(twist|peel|zest|wheel|coin)s?|^(lemon|lime|orange|grapefruit) oil|\m(maraschino|luxardo|brandied|amarena|cocktail) cherr(y|ies)|\molives?|^(cocktail|pickled|pearl) onions?)$', false)
                -- Seasoning a spec doesn't change it: bitters, dashes, saline, water.
                OR coalesce(lower(r.unit) IN ('dash', 'dashes', 'drop', 'drops', 'pinch', 'spray', 'mist', 'top'), false)
                OR coalesce(i.name ~* '(bitters|saline|salt solution|^salt$|^water$|^ice$)', false)) AS minor,
               CASE lower(r.unit) WHEN 'ml' THEN r.amount WHEN 'oz' THEN r.amount * 30 WHEN 'cl' THEN r.amount * 10
                    WHEN 'g' THEN r.amount WHEN 'tsp' THEN r.amount * 5 WHEN 'bsp' THEN r.amount * 5
                    WHEN 'barspoon' THEN r.amount * 5 WHEN 'tbsp' THEN r.amount * 15 END AS ml,
               -- Sugar in any plain form is one sweetener.
               coalesce(i.name ~* '^((white|raw|brown|cane|demerara|caster|turbinado) )?(sugar( cube| syrup)?|simple syrup|rich( simple)? syrup|demerara syrup|cane syrup|gomme( syrup)?|1:1 sugar syrup|2:1 (sugar|simple) syrup|sugar cubes?)$', false) AS sweet,
               coalesce(i.ingredient_role = 'prep' OR i.name ~* '\m(wash(ed)?|infused|infusion|house|smoked|barrel[- ]aged|clarified|fat[- ]washed)\M', false) AS house
          FROM public.recipes r
          JOIN public.items i ON i.id = r.ingredient_item_id
         WHERE r.recipe_item_id IN (p_item_id, v_classic.id)
    ), core AS (
        SELECT * FROM lines WHERE NOT minor
    ), seeds AS (
        SELECT c.id AS line, c.ing AS a FROM core c
        UNION SELECT c.id, c.pg FROM core c WHERE c.pg IS NOT NULL
    ), up AS (
        SELECT s.line, s.a, 0 AS depth FROM seeds s
        UNION
        SELECT u.line, it.generic_id, u.depth + 1
          FROM up u JOIN public.items it ON it.id = u.a
         WHERE it.generic_id IS NOT NULL AND u.depth < 8
    ), lined AS (
        -- Each core line with everything it is a kind of. Roots of the tree
        -- (Spirit, Liqueur, Fruit) say too little to count as a match.
        SELECT c.*, array_agg(DISTINCT u.a) AS ancs,
               array_agg(DISTINCT u.a) FILTER (WHERE ri.generic_id IS NOT NULL) AS specific,
               bool_or(ri.generic_id IS NULL AND ri.name = 'Spirit') AS spirit
          FROM core c
          JOIN up u ON u.line = c.id
          JOIN public.items ri ON ri.id = u.a
         GROUP BY c.id, c.bar, c.ing, c.pg, c.name, c.role, c.g1, c.amount, c.minor, c.ml, c.sweet, c.house
    ), pairs AS (
        SELECT b.id AS b_line, c.id AS c_line, b.ml AS b_ml, c.ml AS c_ml
          FROM lined b JOIN lined c ON b.bar AND NOT c.bar
         WHERE c.ing = ANY (b.ancs)                                                       -- a kind or bottle of it
            OR (b.ing = ANY (c.specific) AND b.ing = ANY (b.specific))                    -- said less exactly ("Vermouth")
            OR (b.role = 'product' AND b.g1 = ANY (c.specific) AND b.g1 = ANY (b.specific)) -- a bottle filed under its wider style
            OR (b.sweet AND c.sweet)
    ), extra AS (
        SELECT b.* FROM lined b WHERE b.bar AND NOT EXISTS (SELECT 1 FROM pairs p WHERE p.b_line = b.id)
    ), dropped AS (
        SELECT c.* FROM lined c WHERE NOT c.bar AND NOT EXISTS (SELECT 1 FROM pairs p WHERE p.c_line = c.id)
    ), swapped AS (
        -- An added line and a missing one of the same kind read as a swap.
        SELECT DISTINCT ON (e.id) e.id AS line, d.id AS c_line, d.name AS from_name, d.spirit AS base
          FROM extra e JOIN dropped d ON e.specific && d.specific
         ORDER BY e.id, d.name
    ), measured AS (
        SELECT p.b_line FROM pairs p
         WHERE (SELECT bool_and(l.ml IS NOT NULL) FROM lined l)
           AND abs(p.b_ml - p.c_ml) > greatest(5, 0.1 * p.c_ml)
    )
    SELECT
        (SELECT count(*) FROM lined WHERE bar),
        (SELECT count(*) FROM extra),
        (SELECT count(*) FROM dropped),
        (SELECT count(DISTINCT b_line) FROM measured),
        (SELECT coalesce(bool_or(amount IS NOT NULL), false) FROM lines WHERE bar),
        jsonb_strip_nulls(jsonb_build_object(
            'swaps', (SELECT jsonb_agg(jsonb_build_object('line', s.line, 'from', s.from_name, 'base', s.base) ORDER BY s.from_name) FROM swapped s),
            'adds', (SELECT jsonb_agg(jsonb_build_object('line', e.id, 'house', e.house) ORDER BY e.name)
                       FROM extra e WHERE NOT EXISTS (SELECT 1 FROM swapped s WHERE s.line = e.id)),
            'drops', (SELECT jsonb_agg(d.name ORDER BY d.name)
                        FROM dropped d WHERE NOT EXISTS (SELECT 1 FROM swapped s WHERE s.c_line = d.id)),
            'measures', (SELECT jsonb_agg(DISTINCT m.b_line) FROM measured m)))
    INTO v_core, v_extra, v_drop, v_measures, v_has_amounts, v_diff;

    v_verdict := CASE
        -- Another name is a riff, unless it's one of the classic's aliases.
        WHEN private.drink_name_key(v_item.name) <> private.drink_name_key(v_classic.name)
             AND NOT EXISTS (SELECT 1 FROM public.classic_aliases ca
                              WHERE ca.classic_id = v_classic.id AND ca.alias_key = private.drink_name_key(v_item.name)) THEN 'riff'
        -- A spec filled in from the classic is not the bar's choice.
        WHEN v_item.spec_source = 'classic' THEN 'unlisted'
        WHEN v_core = 0 THEN 'unlisted'
        WHEN v_extra = 0 AND v_measures = 0 AND v_drop = 0 THEN 'same'
        WHEN v_extra = 0 AND v_measures = 0 THEN 'unlisted'
        ELSE 'variation'
    END;
    -- Only a change has anything to say.
    IF v_verdict IN ('same', 'unlisted') THEN
        v_diff := '{}'::jsonb;
    END IF;

    INSERT INTO private.item_spec_matches AS m (item_id, classic_id, verdict, diff, has_amounts, computed_at)
    VALUES (p_item_id, v_classic.id, v_verdict, v_diff, v_has_amounts, now())
    ON CONFLICT (item_id) DO UPDATE SET
        classic_id = EXCLUDED.classic_id, verdict = EXCLUDED.verdict, diff = EXCLUDED.diff,
        has_amounts = EXCLUDED.has_amounts, computed_at = EXCLUDED.computed_at,
        -- A different classic means the old override no longer applies.
        override = CASE WHEN m.classic_id = EXCLUDED.classic_id THEN m.override END,
        override_by = CASE WHEN m.classic_id = EXCLUDED.classic_id THEN m.override_by END,
        override_at = CASE WHEN m.classic_id = EXCLUDED.classic_id THEN m.override_at END;
END;
$$;

-- --- The data ---

SET "app.spec_match" = 'off';

CREATE TEMP TABLE classic_keys AS
SELECT k.key, (array_agg(k.id))[1] AS id
  FROM (SELECT private.drink_name_key(c.name) AS key, c.id FROM public.items c WHERE c.is_catalog AND c.item_type = 'cocktail'
        UNION ALL
        SELECT a.alias_key, a.classic_id FROM public.classic_aliases a) k
 GROUP BY k.key
HAVING count(DISTINCT k.id) = 1;

-- Seeded, credited drinks: shared, from a bar, nobody owns them.
CREATE TEMP TABLE seeded AS
SELECT i.id, i.name, i.riff_of_id, private.drink_name_key(i.name) AS key,
       NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.recipe_item_id = i.id) AS empty
  FROM public.items i
 WHERE i.item_type = 'cocktail' AND NOT i.is_catalog AND i.bar_id IS NULL AND i.created_by IS NULL
   AND i.origin_bar_profile_id IS NOT NULL;

-- Named exactly like one classic (or its alias), linked to another: move it.
UPDATE public.items i SET riff_of_id = k.id
  FROM seeded s JOIN classic_keys k ON k.key = s.key
 WHERE i.id = s.id AND s.riff_of_id IS NOT NULL AND s.riff_of_id <> k.id;

-- Named exactly like one classic, nothing in it: the classic's spec.
CREATE TEMP TABLE filled AS
SELECT s.id, k.id AS classic_id
  FROM seeded s JOIN classic_keys k ON k.key = s.key
 WHERE s.empty AND (s.riff_of_id IS NULL OR s.riff_of_id = k.id)
   AND EXISTS (SELECT 1 FROM public.recipes r WHERE r.recipe_item_id = k.id);

INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, parent_ingredient_id, sort_order, at_service)
SELECT f.id, r.ingredient_item_id, r.amount, r.unit, r.preparation_notes, r.is_optional, r.parent_ingredient_id, r.sort_order, r.at_service
  FROM filled f JOIN public.recipes r ON r.recipe_item_id = f.classic_id;

UPDATE public.items i SET riff_of_id = f.classic_id, spec_source = 'classic', spec_from_id = f.classic_id,
       origin = CASE WHEN i.origin = 'Original' THEN 'Varient' ELSE i.origin END
  FROM filled f WHERE i.id = f.id;

-- A classic's name and more: link, and for an ingredient, add or swap it.
CREATE TEMP TABLE contains_in (name text, handle text, classic text, act text, extra text, swap_from text);
INSERT INTO contains_in VALUES
($q$PS40's Batanga!$q$, $q$ps40bar$q$, $q$batanga$q$, $q$link$q$, NULL, NULL),
($q$Alpine Sazerac$q$, $q$disco_pantera$q$, $q$sazerac$q$, $q$link$q$, NULL, NULL),
($q$Single Origin Negroni$q$, $q$argobarhk$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Paloma de sur$q$, $q$sietenegronis$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Pandan Negroni$q$, $q$sidehustlelondon$q$, $q$negroni$q$, $q$add$q$, $q$Pandan$q$, NULL),
($q$Guest Negroni$q$, $q$sietenegronis$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Eight Limb Daiquiri$q$, $q$deathandcompany.la$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Chelsea Sidecar$q$, $q$overstory$q$, $q$sidecar$q$, $q$link$q$, NULL, NULL),
($q$Earl Grey Martini$q$, $q$mizunarathelibrary$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Hazelnut Martini$q$, $q$gimlet.melbourne$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Sidecar Tropicana$q$, $q$gibsonbarsg$q$, $q$sidecar$q$, $q$link$q$, NULL, NULL),
($q$Paloma Wilde$q$, $q$thedragonflyhk$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Prosecco Bellini$q$, $q$69colebrookerow$q$, $q$bellini$q$, $q$link$q$, NULL, NULL),
($q$Mezcal Martinez$q$, $q$hemingwaybarprague$q$, $q$martinez$q$, $q$swap$q$, $q$Mezcal$q$, $q$Old Tom Gin$q$),
($q$One Sip Martini$q$, $q$tayer_elementary$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Golden Sbagliato$q$, $q$dantenewyorkcity$q$, $q$sbagliato$q$, $q$link$q$, NULL, NULL),
($q$Orange Blossom Martini$q$, $q$atlasbarsg$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Cardamom Horse's Neck$q$, $q$hemingwaybarprague$q$, $q$horse s neck$q$, $q$link$q$, NULL, NULL),
($q$Matcha Martini$q$, $q$handshake_bar$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Teaspresso Martini$q$, $q$theotherroomsg$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Cacio e Pepe Vesper$q$, $q$thecourtrome$q$, $q$vesper$q$, $q$link$q$, NULL, NULL),
($q$All Day Bloody Mary$q$, $q$dantenewyorkcity$q$, $q$bloody mary$q$, $q$link$q$, NULL, NULL),
($q$Mizunara Old Fashioned$q$, $q$mizunarathelibrary$q$, $q$old fashioned$q$, $q$add$q$, $q$Mizunara$q$, NULL),
($q$Dry Daiquiri$q$, $q$thelobo_syd$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Fluffy Penicillin$q$, $q$moebiusmilano$q$, $q$penicillin$q$, $q$link$q$, NULL, NULL),
($q$Gold Rush Fizz$q$, $q$coupettelondon$q$, $q$gold rush$q$, $q$link$q$, NULL, NULL),
($q$Spectre Martini$q$, $q$atlasbarsg$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Fat Ol' Sazerac$q$, $q$dantenewyorkcity$q$, $q$sazerac$q$, $q$link$q$, NULL, NULL),
($q$Phony Negroni$q$, $q$barsnack.nyc$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Mango Vesper$q$, $q$amarobarlondon$q$, $q$vesper$q$, $q$add$q$, $q$Mango$q$, NULL),
($q$Sips Sgroppino$q$, $q$sips.barcelona$q$, $q$sgroppino$q$, $q$link$q$, NULL, NULL),
($q$Is This Really Boulevardier?$q$, $q$nutmegandclove$q$, $q$boulevardier$q$, $q$link$q$, NULL, NULL),
($q$Dancefloor Martini$q$, $q$lbsrecordbar$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Frozen Calvados Daiquiri$q$, $q$lesyndicat$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Isle of Negroni$q$, $q$thunderboltla$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Kumquat & Hop Paloma$q$, $q$argobarhk$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Pork Belly Martini$q$, $q$hemingwaybarprague$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Watermelon Martini$q$, $q$andy_wahloo$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Smokey Citrus Negroni$q$, $q$andy_wahloo$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Yuzu Negroni$q$, $q$barleonehk$q$, $q$negroni$q$, $q$add$q$, $q$Yuzu$q$, NULL),
($q$Salty Plum Margarita$q$, $q$kinjo.nyc$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Fitness Margarita$q$, $q$svanen.oslo$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Black Walnut Martini$q$, $q$sagerandwilde$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Penrose Gibson$q$, $q$penrose.kl$q$, $q$gibson$q$, $q$link$q$, NULL, NULL),
($q$Martini Royale$q$, $q$freniefrizioni$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Zero Cal Mojito$q$, $q$baba_au_rum$q$, $q$mojito$q$, $q$link$q$, NULL, NULL),
($q$Central Americano$q$, $q$deathandcompany.la$q$, $q$americano$q$, $q$link$q$, NULL, NULL),
($q$Dashi Margarita$q$, $q$lobsterbarhk$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Aviation Collins$q$, $q$hemingwaybarprague$q$, $q$aviation$q$, $q$link$q$, NULL, NULL),
($q$Flavio Daiquiri$q$, $q$andy_wahloo$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Ruby Harvard$q$, $q$hemingwaybarprague$q$, $q$harvard$q$, $q$link$q$, NULL, NULL),
($q$Jerome's Daiquiri$q$, $q$thecambridge_paris$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Salted Soy Milk Martini$q$, $q$dio.cafebar.lck$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Autumn in Manhattan$q$, $q$amoryamargo$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Milk Punch Palais$q$, $q$atlasbarsg$q$, $q$milk punch$q$, $q$link$q$, NULL, NULL),
($q$Osmanthus Negroni$q$, $q$69colebrookerow$q$, $q$negroni$q$, $q$add$q$, $q$Osmanthus$q$, NULL),
($q$Brightside Negroni$q$, $q$thekeeferbar$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Emerald Isle$q$, $q$employeesonlyny$q$, $q$emerald$q$, $q$link$q$, NULL, NULL),
($q$Margarita (cilantro & passion fruit)$q$, $q$alquimicocartagena$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Marigold Martini$q$, $q$argobarhk$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Mr Martinez$q$, $q$sastreriamartinezlima$q$, $q$martinez$q$, $q$link$q$, NULL, NULL),
($q$X.Old Fashioned$q$, $q$solange.barcelona$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Whiskey Business$q$, $q$dearirving$q$, $q$business$q$, $q$link$q$, NULL, NULL),
($q$Garden Sazerac$q$, $q$gibsonbarsg$q$, $q$sazerac$q$, $q$link$q$, NULL, NULL),
($q$Flick Saffron Gold Rush$q$, $q$bartilda.sydney$q$, $q$gold rush$q$, $q$link$q$, NULL, NULL),
($q$Wild Strawberry Bellini$q$, $q$69colebrookerow$q$, $q$bellini$q$, $q$swap$q$, $q$Wild Strawberry$q$, $q$White Peach Purée$q$),
($q$Almond Boulevardier$q$, $q$thebaxterinnsydney$q$, $q$boulevardier$q$, $q$add$q$, $q$Almond$q$, NULL),
($q$Champignon Old Fashioned$q$, $q$juneoncambie$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Emerald Grove$q$, $q$deathandcompany.la$q$, $q$emerald$q$, $q$link$q$, NULL, NULL),
($q$Marygold Gimlet$q$, $q$lyanessbar$q$, $q$gimlet$q$, $q$link$q$, NULL, NULL),
($q$Godfather Part Two$q$, $q$dearirving$q$, $q$godfather$q$, $q$link$q$, NULL, NULL),
($q$Switched Negroni$q$, $q$pandaandsons$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Imperial Scorpion Trunk$q$, $q$goldenmonkeybar$q$, $q$scorpion$q$, $q$link$q$, NULL, NULL),
($q$Chinoto Manhattan$q$, $q$apolloniabar$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Star-5-Zombie$q$, $q$baba_au_rum$q$, $q$zombie$q$, $q$link$q$, NULL, NULL),
($q$Plum Sazerac$q$, $q$dantenewyorkcity$q$, $q$sazerac$q$, $q$add$q$, $q$Plum$q$, NULL),
($q$Guava Pisco Sour$q$, $q$amarobarlondon$q$, $q$pisco sour$q$, $q$add$q$, $q$Guava$q$, NULL),
($q$Wagyu Old Fashioned$q$, $q$sipandguzzlenyc$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Shiso Painkiller$q$, $q$el_pinguino_greenpoint$q$, $q$painkiller$q$, $q$add$q$, $q$Shiso$q$, NULL),
($q$Banana Adonis$q$, $q$barmauromx$q$, $q$adonis$q$, $q$add$q$, $q$Banana$q$, NULL),
($q$Martinican Daiquiri$q$, $q$camparinoingalleria$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Lychee Clover Club$q$, $q$amarobarlondon$q$, $q$clover club$q$, $q$add$q$, $q$Lychee$q$, NULL),
($q$Jerry Thomas Martini$q$, $q$barhemingway$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Siesta Swizzle$q$, $q$dearirving$q$, $q$siesta$q$, $q$link$q$, NULL, NULL),
($q$Scarlett Negroni$q$, $q$rubycph$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Improved Aviation$q$, $q$jerrythomas.speakeasy$q$, $q$aviation$q$, $q$link$q$, NULL, NULL),
($q$Foie Gras Sidecar$q$, $q$shinjisbar$q$, $q$sidecar$q$, $q$link$q$, NULL, NULL),
($q$Mr. Martínez$q$, $q$sastreriamartinezlima$q$, $q$martinez$q$, $q$link$q$, NULL, NULL),
($q$Dry Daiquiri$q$, $q$satans_whiskers$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Children's Aged Manhattan$q$, $q$hemingwaybarprague$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Strawberry Daiquiri (JL Remix)$q$, $q$sweetlibertymia$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Garden State Martini$q$, $q$muchobligednyc$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Paloma Unggu$q$, $q$kenshinkl$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$The Velvet Old Fashioned$q$, $q$bartilda.sydney$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Oh My Jasmine$q$, $q$nutmegandclove$q$, $q$jasmine$q$, $q$link$q$, NULL, NULL),
($q$Whiskey Barrel Negroni$q$, $q$hemingwaybarprague$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Banana Sazerac$q$, $q$the_bellwood$q$, $q$sazerac$q$, $q$add$q$, $q$Banana$q$, NULL),
($q$Nordic Old Fashioned$q$, $q$tayer_elementary$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Casino Perfecto$q$, $q$abvsf$q$, $q$casino$q$, $q$link$q$, NULL, NULL),
($q$Din Tai Fung Manhattan$q$, $q$moebiusmilano$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Dr Pepper Whiskey Sour$q$, $q$southsideparlor$q$, $q$whiskey sour$q$, $q$link$q$, NULL, NULL),
($q$Watermelon Negroni$q$, $q$amarobarlondon$q$, $q$negroni$q$, $q$add$q$, $q$Watermelon$q$, NULL),
($q$Igneous Gibson$q$, $q$argobarhk$q$, $q$gibson$q$, $q$link$q$, NULL, NULL),
($q$The Salamanca Martini$q$, $q$atlasbarsg$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Avery Milk Punch$q$, $q$rayocdmx$q$, $q$milk punch$q$, $q$link$q$, NULL, NULL),
($q$Gimlet on the Vine$q$, $q$scarfesbar$q$, $q$gimlet$q$, $q$link$q$, NULL, NULL),
($q$Oolong Old-Fashioned$q$, $q$tellcamellia$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Coffee Pearl Diver$q$, $q$dirtydickparis$q$, $q$pearl diver$q$, $q$add$q$, $q$Coffee$q$, NULL),
($q$Celery Kir$q$, $q$69colebrookerow$q$, $q$kir$q$, $q$add$q$, $q$Celery$q$, NULL),
($q$Eight Amaro Sazerac$q$, $q$amoryamargo$q$, $q$sazerac$q$, $q$link$q$, NULL, NULL),
($q$Manhattan Deluxe$q$, $q$overstory$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Harry's Martini$q$, $q$mirrorbarcarlton$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Orchid Fifty Fifty$q$, $q$originbarsg$q$, $q$fifty fifty$q$, $q$link$q$, NULL, NULL),
($q$Sultan Negroni$q$, $q$magazine_63$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Margarita Royale$q$, $q$dantenewyorkcity$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Butter Mushroom Old Fashioned$q$, $q$handshake_bar$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Hawksmoor Blinker$q$, $q$hawksmoorrestaurants$q$, $q$blinker$q$, $q$link$q$, NULL, NULL),
($q$Miami Vice Milk Punch$q$, $q$caretakers.cottage$q$, $q$milk punch$q$, $q$link$q$, NULL, NULL),
($q$Fluxus Milk Punch$q$, $q$baba_au_rum$q$, $q$milk punch$q$, $q$link$q$, NULL, NULL),
($q$Burnt Maple Toronto$q$, $q$overstory$q$, $q$toronto$q$, $q$link$q$, NULL, NULL),
($q$Manhattan Steel Corp.$q$, $q$69colebrookerow$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Old Fashioned Whiskey Cocktail$q$, $q$dantenewyorkcity$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Penicillin G$q$, $q$baccanoroma$q$, $q$penicillin$q$, $q$link$q$, NULL, NULL),
($q$Bacon Old Fashioned$q$, $q$oto.ph$q$, $q$old fashioned$q$, $q$add$q$, $q$Bacon$q$, NULL),
($q$Voodoo Milk Punch$q$, $q$cloverclubny$q$, $q$milk punch$q$, $q$link$q$, NULL, NULL),
($q$Oaxacan Old Fashioned$q$, $q$sidehustlelondon$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$The Negroni Experiment$q$, $q$canonseattle$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$MF Martini$q$, $q$gibsonbarsg$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Horizon Daiquiri$q$, $q$lobsterbarhk$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Milk Punch for a Cause$q$, $q$catbiteclub$q$, $q$milk punch$q$, $q$link$q$, NULL, NULL),
($q$Martini di Mare$q$, $q$orientalbar_venice$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Vesper Martini$q$, $q$ralphsbarchengdu$q$, $q$vesper$q$, $q$link$q$, NULL, NULL),
($q$Daiquiri No. 4$q$, $q$floridita_cuba$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Red Sky Negroni$q$, $q$dantenewyorkcity$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Porcini Negroni$q$, $q$camparinoingalleria$q$, $q$negroni$q$, $q$add$q$, $q$Porcini$q$, NULL),
($q$Betty New York Sour$q$, $q$bartilda.sydney$q$, $q$new york sour$q$, $q$link$q$, NULL, NULL),
($q$Sips Adonis$q$, $q$sips.barcelona$q$, $q$adonis$q$, $q$link$q$, NULL, NULL),
($q$Anti-Novel Margarita$q$, $q$baba_au_rum$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Batida Express$q$, $q$lemaryceleste$q$, $q$batida$q$, $q$link$q$, NULL, NULL),
($q$Gone Bamboo$q$, $q$overstory$q$, $q$bamboo$q$, $q$link$q$, NULL, NULL),
($q$Flamenco Martini$q$, $q$theotherroomsg$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Four Season Daiquiri$q$, $q$huuma_nyc$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Bloody Caesar$q$, $q$bar.animahk$q$, $q$caesar$q$, $q$link$q$, NULL, NULL),
($q$Big Gate Martini$q$, $q$kinsman.hk$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Cesar Daiquiri$q$, $q$andy_wahloo$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$6 Months Barrel Aged Manhattan$q$, $q$quinaryhk$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Sous-vide Negroni$q$, $q$frequenceparis$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Oaxacan Old Fashioned$q$, $q$viajantebar$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Negroni di Colombo$q$, $q$localefirenze$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Dried Grapes Negroni$q$, $q$manchupenang$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Casoni Martini$q$, $q$drywavecocktailstudio$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Mandarin Garibaldi$q$, $q$amarobarlondon$q$, $q$garibaldi$q$, $q$add$q$, $q$Mandarin$q$, NULL),
($q$Cape Old Fashioned$q$, $q$sin_tax_bar$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Monkey Business$q$, $q$employeesonlyny$q$, $q$business$q$, $q$link$q$, NULL, NULL),
($q$Thai Red Curry Martini$q$, $q$bouvardiamelbourne$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Quintessential Negroni$q$, $q$apothecary_hk$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Truffle Martini$q$, $q$69colebrookerow$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$El Diablo Milk Punch$q$, $q$caretakers.cottage$q$, $q$milk punch$q$, $q$link$q$, NULL, NULL),
($q$Bitter Paloma$q$, $q$moebiusmilano$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Kimchi Margarita$q$, $q$ruffian_nyc$q$, $q$margarita$q$, $q$add$q$, $q$Kimchi$q$, NULL),
($q$Deathless Old Fashioned$q$, $q$argobarhk$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Sakura Martini$q$, $q$deanandnancyon22$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$50/50 Martini$q$, $q$victoraudiobar$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Beeswax Appletini$q$, $q$dantenewyorkcity$q$, $q$appletini$q$, $q$add$q$, $q$Beeswax$q$, NULL),
($q$Gibson Please$q$, $q$scarfesbar$q$, $q$gibson$q$, $q$link$q$, NULL, NULL),
($q$Olive Oil Gimlet$q$, $q$handshake_bar$q$, $q$gimlet$q$, $q$add$q$, $q$Olive Oil$q$, NULL),
($q$Cacao Negroni$q$, $q$handshake_bar$q$, $q$negroni$q$, $q$add$q$, $q$Cacao$q$, NULL),
($q$Wimbledon Bellini$q$, $q$69colebrookerow$q$, $q$bellini$q$, $q$link$q$, NULL, NULL),
($q$Opuntia and Grapefruit Caipiroska$q$, $q$hemingwaybarprague$q$, $q$caipiroska$q$, $q$link$q$, NULL, NULL),
($q$Scandi Gibson$q$, $q$amoryamargo$q$, $q$gibson$q$, $q$link$q$, NULL, NULL),
($q$Dashi Martini$q$, $q$overstory$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$She's So Old Fashioned$q$, $q$doublechickenpleasenyc$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$The Three Sip Martini$q$, $q$handshake_bar$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Filthy Martini$q$, $q$barleonehk$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Voyager Negroni$q$, $q$originbarsg$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Piña Colada Deconstruction$q$, $q$deathandcompany$q$, $q$pina colada$q$, $q$link$q$, NULL, NULL),
($q$Cherry Cosmopolitan$q$, $q$hemingwaybarprague$q$, $q$cosmopolitan$q$, $q$add$q$, $q$Cherry$q$, NULL),
($q$Amazake Bellini$q$, $q$gibsonbarsg$q$, $q$bellini$q$, $q$add$q$, $q$Amazake$q$, NULL),
($q$Pear Bellini$q$, $q$69colebrookerow$q$, $q$bellini$q$, $q$swap$q$, $q$Pear$q$, $q$White Peach Purée$q$),
($q$Lost Marguerite$q$, $q$scarfesbar$q$, $q$marguerite$q$, $q$link$q$, NULL, NULL),
($q$Dr. J Negroni$q$, $q$argobarhk$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Negroni Sbagliato$q$, $q$littlereddoor_paris$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Solera-Aged Negroni$q$, $q$manhattan_sg$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Where is the Daiquiri$q$, $q$paradiso_barcelona$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Palo Santo Gimlet$q$, $q$tayer_elementary$q$, $q$gimlet$q$, $q$add$q$, $q$Palo Santo$q$, NULL),
($q$PS40's Dark 'n' Stormy$q$, $q$ps40bar$q$, $q$dark n stormy$q$, $q$link$q$, NULL, NULL),
($q$Strawberry and Chocolate Caipiroska$q$, $q$hemingwaybarprague$q$, $q$caipiroska$q$, $q$link$q$, NULL, NULL),
($q$Roma Gimlet$q$, $q$southsideparlor$q$, $q$gimlet$q$, $q$link$q$, NULL, NULL),
($q$Paloma Café$q$, $q$viajantebar$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$1970 Negroni$q$, $q$amarobarlondon$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Kulim Old Fashioned$q$, $q$chezchez.pg$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Chocolate Boulevardier$q$, $q$viceversamiami$q$, $q$boulevardier$q$, $q$add$q$, $q$Chocolate$q$, NULL),
($q$Kiwi Bellini$q$, $q$swiftsoho$q$, $q$bellini$q$, $q$swap$q$, $q$Kiwi$q$, $q$White Peach Purée$q$),
($q$Wild Strawberry Bellini with Neroli$q$, $q$69colebrookerow$q$, $q$bellini$q$, $q$link$q$, NULL, NULL),
($q$Barrel-Aged Old Fashioned$q$, $q$thehouseofmachines_cpt$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Clarified Milk Punch$q$, $q$dantenewyorkcity$q$, $q$milk punch$q$, $q$link$q$, NULL, NULL),
($q$Umeboshi Milk Punch$q$, $q$overstory$q$, $q$milk punch$q$, $q$add$q$, $q$Umeboshi$q$, NULL),
($q$S.F.A. Negroni$q$, $q$solange.barcelona$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Blackberry and Vanilla Caipiroska$q$, $q$hemingwaybarprague$q$, $q$caipiroska$q$, $q$link$q$, NULL, NULL),
($q$Negroni Arrabbiato$q$, $q$svanen.oslo$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Royal Mojito$q$, $q$theotherroomsg$q$, $q$mojito$q$, $q$link$q$, NULL, NULL),
($q$Midnight Vesper Martini$q$, $q$andy_wahloo$q$, $q$vesper$q$, $q$link$q$, NULL, NULL),
($q$Bolognese Americano$q$, $q$nuloungebar$q$, $q$americano$q$, $q$link$q$, NULL, NULL),
($q$Elizabeth Spicy Paloma$q$, $q$bartilda.sydney$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Pineapple & Coconut Manhattan$q$, $q$calloohcallaybar$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Vesper Dolores$q$, $q$brujasmex$q$, $q$vesper$q$, $q$link$q$, NULL, NULL),
($q$White Gold Rush$q$, $q$pearlboxnyc$q$, $q$gold rush$q$, $q$link$q$, NULL, NULL),
($q$Vintage Manhattan$q$, $q$69colebrookerow$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Ponzu Old Fashioned$q$, $q$deadwax.enmore$q$, $q$old fashioned$q$, $q$add$q$, $q$Ponzu$q$, NULL),
($q$Revisited Bramble$q$, $q$line.athens$q$, $q$bramble$q$, $q$link$q$, NULL, NULL),
($q$Daiquiri X$q$, $q$rubycph$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$French Soup Manhattan$q$, $q$two.schmucks$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Martini de Nanche$q$, $q$tlecan$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Mermaid Gimlet$q$, $q$copperbay_paris$q$, $q$gimlet$q$, $q$link$q$, NULL, NULL),
($q$Sbagliato bianco$q$, $q$barmauromx$q$, $q$sbagliato$q$, $q$link$q$, NULL, NULL),
($q$Piña Colada Malaka$q$, $q$andy_wahloo$q$, $q$pina colada$q$, $q$link$q$, NULL, NULL),
($q$Martini Amalfitano$q$, $q$solange.barcelona$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Dry Martini$q$, $q$1862drybar$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Rock Paloma$q$, $q$tellcamellia$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$The Blackcurrant and Liquorice Bellini$q$, $q$69colebrookerow$q$, $q$bellini$q$, $q$link$q$, NULL, NULL),
($q$Coffee Black Velvet$q$, $q$americanbarsavoy$q$, $q$black velvet$q$, $q$add$q$, $q$Coffee$q$, NULL),
($q$The Conference of the Birds$q$, $q$forbina_bar$q$, $q$conference$q$, $q$link$q$, NULL, NULL),
($q$Nude Mai Tai$q$, $q$naked.athens$q$, $q$mai tai$q$, $q$link$q$, NULL, NULL),
($q$Negroni Sbagliato$q$, $q$dearirving$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Trashcan Milk Punch$q$, $q$ps40bar$q$, $q$milk punch$q$, $q$link$q$, NULL, NULL),
($q$0 Proof Paloma$q$, $q$ps40bar$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Knickerbocker Martini$q$, $q$atlasbarsg$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Emerald Martini$q$, $q$rubycph$q$, $q$emerald$q$, $q$link$q$, NULL, NULL),
($q$Seasonal Margarita$q$, $q$sidehustlelondon$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Tu vuo' fa l'americano?$q$, $q$copperbay_paris$q$, $q$americano$q$, $q$link$q$, NULL, NULL),
($q$Midnight Old Fashioned$q$, $q$rubycph$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Omija Paloma$q$, $q$southsideparlor$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Scorched Fjord Martini$q$, $q$rubycph$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Horse's Neck with a Kick$q$, $q$nightjar$q$, $q$horse s neck$q$, $q$link$q$, NULL, NULL),
($q$Jeju Negroni$q$, $q$bar.cham$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Mojito Criollo$q$, $q$cafelatrovamiami$q$, $q$mojito$q$, $q$link$q$, NULL, NULL),
($q$Different Blood and Sand$q$, $q$hemingwaybarprague$q$, $q$blood and sand$q$, $q$link$q$, NULL, NULL),
($q$Winter Rob Roy$q$, $q$caretakers.cottage$q$, $q$rob roy$q$, $q$link$q$, NULL, NULL),
($q$Pornstar Cheese Martini$q$, $q$carnavalbar$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Martini au Lait$q$, $q$the_bellwood$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Bergamot & Wood Gimlet$q$, $q$argobarhk$q$, $q$gimlet$q$, $q$link$q$, NULL, NULL),
($q$Combat Margarita$q$, $q$combat.belleville$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Line's Strawberry Daiquiri$q$, $q$line.athens$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Caper Leaf Martini$q$, $q$69colebrookerow$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Blossom Bellini$q$, $q$andy_wahloo$q$, $q$bellini$q$, $q$link$q$, NULL, NULL),
($q$Blenheim Gimlet$q$, $q$69colebrookerow$q$, $q$gimlet$q$, $q$link$q$, NULL, NULL),
($q$Mirror Margarita$q$, $q$hachabar$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Butter Martini$q$, $q$tayer_elementary$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Oaxaca Espresso Martini$q$, $q$solange.barcelona$q$, $q$espresso martini$q$, $q$link$q$, NULL, NULL),
($q$Gyokuru Martini$q$, $q$overstory$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Re-Presidente$q$, $q$lpmdubai$q$, $q$presidente$q$, $q$link$q$, NULL, NULL),
($q$Bellini Sgroppino$q$, $q$hemingwaybarprague$q$, $q$bellini$q$, $q$link$q$, NULL, NULL),
($q$Tequila Gimlet$q$, $q$tjoget$q$, $q$gimlet$q$, $q$swap$q$, $q$Tequila$q$, $q$Gin$q$),
($q$CC Mizuwari$q$, $q$lyanessbar$q$, $q$mizuwari$q$, $q$link$q$, NULL, NULL),
($q$Naked Mai Tai$q$, $q$pch_sf$q$, $q$mai tai$q$, $q$link$q$, NULL, NULL),
($q$Grossi Negroni$q$, $q$arlechinmelbourne$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Dec's Martini$q$, $q$amarobarlondon$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Smoked Beet Negroni$q$, $q$ruffian_nyc$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Boat Snack Martini$q$, $q$barsnack.nyc$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Phish Food Old Fashioned$q$, $q$barsnack.nyc$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Corn Milk Punch$q$, $q$saxonandparole$q$, $q$milk punch$q$, $q$add$q$, $q$Corn$q$, NULL),
($q$Dante Martini$q$, $q$dantenewyorkcity$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Pornstar Mojito$q$, $q$sipandguzzlenyc$q$, $q$mojito$q$, $q$link$q$, NULL, NULL),
($q$Revival Negroni$q$, $q$paradiso_barcelona$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Apple Manhattan$q$, $q$sipandguzzlenyc$q$, $q$manhattan$q$, $q$add$q$, $q$Apple$q$, NULL),
($q$Arnaud's French 75$q$, $q$lobbybar.hotelchelsea$q$, $q$french 75$q$, $q$link$q$, NULL, NULL),
($q$XO Negroni$q$, $q$argobarhk$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Coconut Old Fashioned$q$, $q$hopeandsesame$q$, $q$old fashioned$q$, $q$add$q$, $q$Coconut$q$, NULL),
($q$Spiced Daiquiri$q$, $q$canonseattle$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Dark Whiskey Sour$q$, $q$bar.orai$q$, $q$whiskey sour$q$, $q$link$q$, NULL, NULL),
($q$Solange's Margarita$q$, $q$solange.barcelona$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Ridgway Margarita$q$, $q$ralphsbarchengdu$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Hermés Sgroppino$q$, $q$hemingwaybarprague$q$, $q$sgroppino$q$, $q$link$q$, NULL, NULL),
($q$Ernestino Daiquiri$q$, $q$hemingwaybarprague$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Blossom Daiquiri$q$, $q$andy_wahloo$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Winter Sherry Cobbler$q$, $q$handsdownmelbourne$q$, $q$sherry cobbler$q$, $q$link$q$, NULL, NULL),
($q$Frozen Strawberry Daiquiri$q$, $q$yachtclubbar$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Loba Margarita$q$, $q$officialcafepacifico$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Gingerbread Negroni$q$, $q$dantenewyorkcity$q$, $q$negroni$q$, $q$add$q$, $q$Gingerbread$q$, NULL),
($q$Mini Martini$q$, $q$handshake_bar$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Rosita Sunrise$q$, $q$alquimicocartagena$q$, $q$rosita$q$, $q$link$q$, NULL, NULL),
($q$Cure's Sazerac$q$, $q$curenola$q$, $q$sazerac$q$, $q$link$q$, NULL, NULL),
($q$Rested de la Louisiane$q$, $q$hemingwaybarprague$q$, $q$de la louisiane$q$, $q$link$q$, NULL, NULL),
($q$Robusto Negroni$q$, $q$terminisoho$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Garibaldi a lo siete$q$, $q$sietenegronis$q$, $q$garibaldi$q$, $q$link$q$, NULL, NULL),
($q$A Fancy Margarita$q$, $q$bar_raval$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Rose Bellini$q$, $q$69colebrookerow$q$, $q$bellini$q$, $q$add$q$, $q$Rose$q$, NULL),
($q$Bloody Mary de Birria$q$, $q$hemingwaybarprague$q$, $q$bloody mary$q$, $q$link$q$, NULL, NULL),
($q$Frozen Sea Buckthorn Margarita$q$, $q$rubycph$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Business Thyme$q$, $q$ps40bar$q$, $q$business$q$, $q$link$q$, NULL, NULL),
($q$Irish Royal Fizz$q$, $q$flyingdutchmencocktails$q$, $q$royal fizz$q$, $q$link$q$, NULL, NULL),
($q$Raspberry Martini$q$, $q$barhemingway$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$The Fallen Martini$q$, $q$rubycph$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Yuzu Daikon Paloma$q$, $q$gokan.hk$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Banana Old Fashioned$q$, $q$bartilda.sydney$q$, $q$old fashioned$q$, $q$add$q$, $q$Banana$q$, NULL),
($q$Connaught Bloody Mary$q$, $q$connaughtbar$q$, $q$bloody mary$q$, $q$link$q$, NULL, NULL),
($q$Barrel Blend Old Fashioned$q$, $q$hammerandsong$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$BBQ Negroni$q$, $q$calloohcallaybar$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Margarita Silvestre$q$, $q$alquimicocartagena$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$White Mezcal Negroni$q$, $q$flyingdutchmencocktails$q$, $q$mezcal negroni$q$, $q$link$q$, NULL, NULL),
($q$Dr Pepper Old Fashioned$q$, $q$southsideparlor$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Negroni Trio$q$, $q$lantiquario_napoli$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Mango and Red Orange Caipiroska$q$, $q$hemingwaybarprague$q$, $q$caipiroska$q$, $q$link$q$, NULL, NULL),
($q$Rooibos Brandy Sour$q$, $q$causeeffectcpt$q$, $q$brandy sour$q$, $q$add$q$, $q$Rooibos$q$, NULL),
($q$Porn Sam Martini$q$, $q$experimentalcocktailclub$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Martini al Formaggio$q$, $q$hemingwaybarprague$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Dry Martini$q$, $q$line.athens$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Quinary Bloody Mary$q$, $q$quinaryhk$q$, $q$bloody mary$q$, $q$link$q$, NULL, NULL),
($q$Peanut Butter Old Fashioned$q$, $q$amarobarlondon$q$, $q$old fashioned$q$, $q$add$q$, $q$Peanut Butter$q$, NULL),
($q$Teapresso Martini$q$, $q$tellcamellia$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Pisco Bee's Knees$q$, $q$loma_bar$q$, $q$bee s knees$q$, $q$link$q$, NULL, NULL),
($q$Rosa Paloma$q$, $q$scarfesbar$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Vegemite Vesper$q$, $q$bartilda.sydney$q$, $q$vesper$q$, $q$link$q$, NULL, NULL),
($q$Dutch Daiquiri$q$, $q$flyingdutchmencocktails$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Cape Negroni$q$, $q$causeeffectcpt$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Geisha Espresso Martini$q$, $q$gokan.hk$q$, $q$espresso martini$q$, $q$link$q$, NULL, NULL),
($q$White Almond Bellini$q$, $q$69colebrookerow$q$, $q$bellini$q$, $q$add$q$, $q$White Almond$q$, NULL),
($q$Margarita de Sandía$q$, $q$tlecan$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Madeira Negus$q$, $q$cloverclubny$q$, $q$negus$q$, $q$swap$q$, $q$Madeira$q$, $q$Ruby Port$q$),
($q$Watermelon Daiquiri$q$, $q$brokenshaker$q$, $q$daiquiri$q$, $q$add$q$, $q$Watermelon$q$, NULL),
($q$Tangerine Paloma$q$, $q$kaitodelvalle$q$, $q$paloma$q$, $q$add$q$, $q$Tangerine$q$, NULL),
($q$69 Martini$q$, $q$69colebrookerow$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Dry Martini$q$, $q$solange.barcelona$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Sous-vide Vieux Carré$q$, $q$frequenceparis$q$, $q$vieux carre$q$, $q$link$q$, NULL, NULL),
($q$Champagne Grasshopper$q$, $q$sipandguzzlenyc$q$, $q$grasshopper$q$, $q$add$q$, $q$Champagne$q$, NULL),
($q$Reese's Puffs Old Fashioned$q$, $q$brokenshaker$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Barrel-Aged Old Fashioned$q$, $q$slinkandbardot$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Margarita, Margherita$q$, $q$apolloniabar$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Paolo Appletini$q$, $q$pandaandsons$q$, $q$appletini$q$, $q$link$q$, NULL, NULL),
($q$Nitro Espresso Martini$q$, $q$civlibto$q$, $q$espresso martini$q$, $q$link$q$, NULL, NULL),
($q$Rockefeller Martini$q$, $q$peoplesny$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Tom Yum Martini$q$, $q$chiliheadstraitsquay$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Chrysanthemum Spirit$q$, $q$goodwater.melbourne$q$, $q$chrysanthemum$q$, $q$link$q$, NULL, NULL),
($q$Stranger Things Old Fashioned$q$, $q$dandelyan$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Keens Old Fashioned$q$, $q$keenssteakhouse$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Super Vesper$q$, $q$originbarsg$q$, $q$vesper$q$, $q$link$q$, NULL, NULL),
($q$Raval Martini$q$, $q$bar_raval$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Go Back Martini$q$, $q$freniefrizioni$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Los Paloma$q$, $q$lpmdubai$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$A Quail Walks Into a Martini$q$, $q$fura.sg$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Old Fashioned in ice$q$, $q$aviarycocktails$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Glacier Martini$q$, $q$viajantebar$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Al Son de la Batanga$q$, $q$candelariaparis$q$, $q$batanga$q$, $q$link$q$, NULL, NULL),
($q$Sugar Snap Gimlet$q$, $q$69colebrookerow$q$, $q$gimlet$q$, $q$link$q$, NULL, NULL),
($q$Garibaldi Sgroppino$q$, $q$hemingwaybarprague$q$, $q$garibaldi$q$, $q$link$q$, NULL, NULL),
($q$Elder Kir$q$, $q$69colebrookerow$q$, $q$kir$q$, $q$link$q$, NULL, NULL),
($q$Tomato Martini$q$, $q$mostlyharmlessbar$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Pimp My Paloma$q$, $q$copperbay_paris$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Martha Gellhorn Bellini$q$, $q$hemingwaybarprague$q$, $q$bellini$q$, $q$link$q$, NULL, NULL),
($q$Sexy Gimlet$q$, $q$naked.athens$q$, $q$gimlet$q$, $q$link$q$, NULL, NULL),
($q$Miami Vice Negroni$q$, $q$dirtydickparis$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Champs Elysées No.2$q$, $q$hemingwaybarprague$q$, $q$champs elysees$q$, $q$link$q$, NULL, NULL),
($q$Mini Dirty Martini$q$, $q$handshake_bar$q$, $q$dirty martini$q$, $q$link$q$, NULL, NULL),
($q$Seville Negroni$q$, $q$pandaandsons$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Red Rock Sazerac$q$, $q$argobarhk$q$, $q$sazerac$q$, $q$link$q$, NULL, NULL),
($q$50/50 Old Fashioned$q$, $q$drinkmanolo$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Harry's Martini$q$, $q$odo.nyc$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$The Orchard Old Fashioned$q$, $q$argobarhk$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Coconut Kir$q$, $q$69colebrookerow$q$, $q$kir$q$, $q$add$q$, $q$Coconut$q$, NULL),
($q$Bianca Tropical Martini$q$, $q$bartilda.sydney$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Sesame Oil Martini$q$, $q$deadwax.enmore$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Barely Legal Margarita$q$, $q$brokenshaker$q$, $q$margarita$q$, $q$link$q$, NULL, NULL),
($q$Gremolada Negroni$q$, $q$moebiusmilano$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$"Mocha" Martini$q$, $q$thunderboltla$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Hawksmoor Marmalade Martini$q$, $q$hawksmoorrestaurants$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Sparkling Americano$q$, $q$heartbreakerbar$q$, $q$americano$q$, $q$link$q$, NULL, NULL),
($q$Negroni Frappé$q$, $q$dantenewyorkcity$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Fresh Nitro Garibaldi$q$, $q$dirtydickparis$q$, $q$garibaldi$q$, $q$link$q$, NULL, NULL),
($q$Paloma (corozo & rubí)$q$, $q$alquimicocartagena$q$, $q$paloma$q$, $q$link$q$, NULL, NULL),
($q$Original Singapore Sling$q$, $q$longbarsg$q$, $q$singapore sling$q$, $q$link$q$, NULL, NULL),
($q$Eau du Martinez$q$, $q$thedonovanbar$q$, $q$martinez$q$, $q$link$q$, NULL, NULL),
($q$Margarita (strawberry)$q$, $q$alquimicocartagena$q$, $q$margarita$q$, $q$add$q$, $q$Strawberry$q$, NULL),
($q$Manhattan Flight$q$, $q$charleshseoul$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Wai Daiquiri$q$, $q$baba_au_rum$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Truffle Old Fashioned$q$, $q$canonseattle$q$, $q$old fashioned$q$, $q$add$q$, $q$Truffle$q$, NULL),
($q$Lord Chancellor's$q$, $q$scarfesbar$q$, $q$chancellor$q$, $q$link$q$, NULL, NULL),
($q$Signature Negroni$q$, $q$orientalbar_venice$q$, $q$negroni$q$, $q$link$q$, NULL, NULL),
($q$Extra Dry Martini with Vermouth Chaser$q$, $q$butler_the_japanese_bar_hk$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Toffee Apple Manhattan$q$, $q$dantenewyorkcity$q$, $q$manhattan$q$, $q$link$q$, NULL, NULL),
($q$Walter Gibson$q$, $q$sidehustlelondon$q$, $q$gibson$q$, $q$link$q$, NULL, NULL),
($q$Sina Southside$q$, $q$bartilda.sydney$q$, $q$southside$q$, $q$link$q$, NULL, NULL),
($q$Perennial Gimlet$q$, $q$crownshy.nyc$q$, $q$gimlet$q$, $q$link$q$, NULL, NULL),
($q$Skynet Old Fashioned$q$, $q$argobarhk$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Ashachu Martini$q$, $q$southsideparlor$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Smoked Old Fashioned$q$, $q$cobbler_yeonhee$q$, $q$old fashioned$q$, $q$link$q$, NULL, NULL),
($q$Coffee Shochu Martini$q$, $q$gibsonbarsg$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Mirabelle Plum Caipirinha$q$, $q$hemingwaybarprague$q$, $q$caipirinha$q$, $q$add$q$, $q$Mirabelle Plum$q$, NULL),
($q$Clear Espresso Martini$q$, $q$alquimicocartagena$q$, $q$espresso martini$q$, $q$link$q$, NULL, NULL),
($q$Frisky Business$q$, $q$thewoowoonyc$q$, $q$business$q$, $q$link$q$, NULL, NULL),
($q$Kiwi Margarita$q$, $q$amarobarlondon$q$, $q$margarita$q$, $q$add$q$, $q$Kiwi$q$, NULL),
($q$Grilled Corn Bloody Mary$q$, $q$the_bellwood$q$, $q$bloody mary$q$, $q$link$q$, NULL, NULL),
($q$Gyokuro Martini$q$, $q$overstory$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Witty Martini$q$, $q$quinaryhk$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Blood Brown Derby$q$, $q$lyanessbar$q$, $q$brown derby$q$, $q$link$q$, NULL, NULL),
($q$Barreled Boulevardier$q$, $q$barbyeast$q$, $q$boulevardier$q$, $q$link$q$, NULL, NULL),
($q$Bond's Sneaky Martini$q$, $q$lesyndicat$q$, $q$martini$q$, $q$link$q$, NULL, NULL),
($q$Not a Dry Daiquiri$q$, $q$rubycph$q$, $q$daiquiri$q$, $q$link$q$, NULL, NULL),
($q$Vesper Martini$q$, $q$barspiritforward.blr$q$, $q$vesper$q$, $q$link$q$, NULL, NULL),
($q$Raval Spanish Coffee$q$, $q$bar_raval$q$, $q$spanish coffee$q$, $q$link$q$, NULL, NULL),
($q$Fall Pimm's Cup$q$, $q$dantenewyorkcity$q$, $q$pimm s cup$q$, $q$link$q$, NULL, NULL),
($q$Nitro Cuba Libre$q$, $q$anvilhouston$q$, $q$cuba libre$q$, $q$link$q$, NULL, NULL),
($q$Kopiko Espresso Martini$q$, $q$cobracolumbus$q$, $q$espresso martini$q$, $q$link$q$, NULL, NULL);

CREATE TEMP TABLE contained AS
SELECT s.id, s.empty, s.riff_of_id, c.id AS classic_id, ci.act, ci.extra, ci.swap_from
  FROM contains_in ci
  JOIN public.profiles p ON p.handle = ci.handle
  JOIN seeded s ON lower(s.name) = lower(ci.name)
  JOIN public.items si ON si.id = s.id AND si.origin_bar_profile_id = p.id
  JOIN public.items c ON c.is_catalog AND c.item_type = 'cocktail' AND private.drink_name_key(c.name) = private.drink_name_key(ci.classic);

UPDATE public.items i SET riff_of_id = c.classic_id, origin = CASE WHEN i.origin = 'Original' THEN 'Varient' ELSE i.origin END
  FROM contained c WHERE i.id = c.id AND c.riff_of_id IS NULL;

CREATE TEMP TABLE built AS
SELECT c.* FROM contained c
 WHERE c.empty AND c.act IN ('add', 'swap') AND (c.riff_of_id IS NULL OR c.riff_of_id = c.classic_id)
   AND public.resolve_ingredient(c.extra) IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.recipes r WHERE r.recipe_item_id = c.classic_id);

INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, parent_ingredient_id, sort_order, at_service)
SELECT b.id,
       CASE WHEN b.act = 'swap' AND ri.name = b.swap_from THEN public.resolve_ingredient(b.extra) ELSE r.ingredient_item_id END,
       r.amount, r.unit, r.preparation_notes, r.is_optional,
       CASE WHEN b.act = 'swap' AND ri.name = b.swap_from THEN NULL ELSE r.parent_ingredient_id END,
       r.sort_order, r.at_service
  FROM built b
  JOIN public.recipes r ON r.recipe_item_id = b.classic_id
  JOIN public.items ri ON ri.id = r.ingredient_item_id;

INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, sort_order)
SELECT b.id, public.resolve_ingredient(b.extra),
       coalesce((SELECT max(r.sort_order) FROM public.recipes r WHERE r.recipe_item_id = b.id), 0) + 1
  FROM built b WHERE b.act = 'add';

UPDATE public.items i SET spec_source = 'classic', spec_from_id = b.classic_id
  FROM built b WHERE i.id = b.id;

RESET "app.spec_match";
SELECT private.spec_match_refresh_all();

-- --- The flavour refill ---

SELECT private.enqueue_item_flavor_job(f.item_id, interval '0 seconds')
  FROM public.item_flavors f
 WHERE f.spec_fingerprint IS DISTINCT FROM private.item_flavor_fingerprint(f.item_id);
SELECT private.enqueue_item_flavor_job(x.id, interval '0 seconds')
  FROM (SELECT id FROM filled UNION SELECT id FROM built) x;

DROP TABLE "alias_in", "classic_keys", "seeded", "filled", "contains_in", "contained", "built";
RESET "app.image_worker";
