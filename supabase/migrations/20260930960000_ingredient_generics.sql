-- Generic ingredients: what a bottle is a kind of, on the ingredient itself.
--
-- A recipe line has two ingredient slots: the specific ingredient poured
-- (ingredient_item_id, "Tanqueray") and its generic (parent_ingredient_id,
-- "Gin"). Brand masking shows the generic to staff below the brand level,
-- and spirit search, flavor profiles and "can I make this" all read it. But
-- the drink editor never wrote parent_ingredient_id, so nearly every venue
-- line had no generic: masking fell back to the brand, and a Tanqueray drink
-- didn't count as a gin drink.
--
-- Now the generic lives on the ingredient: items.generic_id, set once per
-- bottle ("Tanqueray" is a kind of "Gin"). A line's generic is its own
-- parent_ingredient_id when it has one, else its ingredient's generic_id.
-- Everything that read the line's parent reads that instead:
--   app_recipe_presentation   display_ingredient_id and parent_ingredient_id
--   app_item_presentation     gains generic_id, so the app can show and edit it
--   get_item_flavor_spec      the generic name and its categories for the rules
--   item_flavor_fingerprint   so changing a generic recomputes the profile
-- Changing an ingredient's generic re-queues every drink that uses it.
--
-- Then the shared bottles are filled in: each known brand or style gets its
-- generic (and a spirit category where it had none), generics that don't
-- exist yet are created as shared ingredients, and any ingredient whose
-- recipe lines all name the same parent takes it as its generic. Venue
-- ingredients aren't touched here (their names are private data).
-- Safe to re-run: only NULL generics and empty category sets are filled.

-- ---------------------------------------------------------------------------
-- The column
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."items"
    ADD COLUMN "generic_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "items_generic_not_self" CHECK ("generic_id" IS NULL OR "generic_id" <> "id");

CREATE INDEX "items_generic_id_idx" ON "public"."items" ("generic_id") WHERE "generic_id" IS NOT NULL;

-- Only ingredients have generics, and a generic is an ingredient.
CREATE FUNCTION "private"."guard_item_generic"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.generic_id IS NULL THEN RETURN NEW; END IF;
    IF NEW.item_type <> 'ingredient' THEN
        RAISE EXCEPTION 'Only an ingredient can have a generic ingredient.' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.items g WHERE g.id = NEW.generic_id AND g.item_type = 'ingredient') THEN
        RAISE EXCEPTION 'The generic must be an ingredient.' USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_item_generic"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_item_generic" BEFORE INSERT OR UPDATE OF "generic_id", "item_type" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_generic"();

-- A changed generic changes the flavor of every drink that pours it.
DROP TRIGGER "queue_item_flavor_job_update" ON "public"."items";
CREATE TRIGGER "queue_item_flavor_job_update" AFTER UPDATE OF "name", "item_type", "generic_id" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_flavor_job"();

-- ---------------------------------------------------------------------------
-- Reads: the line's parent, else the ingredient's generic
-- ---------------------------------------------------------------------------

-- Same columns, order and types as 20260930500400; the two generic columns
-- fall back to the ingredient's generic_id.
CREATE OR REPLACE VIEW "public"."app_recipe_presentation" AS
 SELECT "r"."id",
    "r"."created_at",
    "r"."recipe_item_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."ingredient_item_id"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN "r"."ingredient_item_id"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level")) THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
            WHEN ("ps"."id" IS NOT NULL) THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
            ELSE NULL::"uuid"
        END AS "display_ingredient_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."amount"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level")) THEN "r"."amount"
            WHEN ("ps"."id" IS NOT NULL) THEN "r"."amount"
            ELSE NULL::numeric
        END AS "amount",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."unit"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level")) THEN "r"."unit"
            WHEN ("ps"."id" IS NOT NULL) THEN "r"."unit"
            ELSE NULL::"text"
        END AS "unit",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."preparation_notes"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_prep_level", "b"."default_prep_level")) THEN "r"."preparation_notes"
            ELSE NULL::"text"
        END AS "preparation_notes",
    "r"."is_optional",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level")) THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
            WHEN ("ps"."id" IS NOT NULL) THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
            ELSE NULL::"uuid"
        END AS "parent_ingredient_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."ingredient_item_id"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN "r"."ingredient_item_id"
            ELSE NULL::"uuid"
        END AS "ingredient_item_id",
    "r"."sort_order"
   FROM ((((("public"."recipes" "r"
     JOIN "public"."items" "c" ON (("r"."recipe_item_id" = "c"."id")))
     LEFT JOIN "public"."items" "s" ON (("s"."id" = "r"."ingredient_item_id")))
     LEFT JOIN "public"."bars" "b" ON (("c"."bar_id" = "b"."id")))
     LEFT JOIN "public"."user_bars" "ub" ON ((("ub"."bar_id" = "c"."bar_id") AND ("ub"."user_id" = "auth"."uid"())
        AND NOT EXISTS (
            SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "ub"."venue_role_id" AND "vr"."ends_at" <= "now"()
        ))))
     LEFT JOIN (
        SELECT "pi"."id" FROM "public"."published_items" "pi" WHERE "pi"."publish_mode" = 'spec' AND NOT "pi"."is_reference"
     ) "ps" ON (("ps"."id" = "c"."id")))
  WHERE ((("auth"."uid"() IS NOT NULL)
    AND (("c"."bar_id" IS NULL
          AND ("c"."created_by" IS NULL
            OR "c"."item_type" NOT IN ('cocktail', 'beer', 'wine')
            OR "c"."created_by" = "auth"."uid"()
            OR EXISTS (SELECT 1 FROM "private"."app_admins" "aa" WHERE "aa"."user_id" = "auth"."uid"())))
      OR (("ub"."user_id" IS NOT NULL)
        AND ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level")))))
    OR ("ps"."id" IS NOT NULL));

ALTER VIEW "public"."app_recipe_presentation" SET ("security_invoker" = false);


CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    c.notes,
    c.origin,
    c.price,
    c.status,
    c.brand_maker,
    c.abv,
    c.bar_id,
    c.icon_key,
    c.icon_url,
    c.hide_from_search,
    c.origin_bar_profile_id,
    c.created_by,
    c.creator_profile_id,
    c.generic_id
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);

-- A cocktail's spec lines as the rules read them: names, the generic
-- ingredient, category names (with their parents), amounts, and any cached AI
-- answer for the ingredient under its current name. Raw names: this is for the
-- worker only and never reaches the app.
CREATE OR REPLACE FUNCTION "public"."get_item_flavor_spec"("p_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', r.ingredient_item_id,
    'name', coalesce(s.name, g.name, ''),
    'genericName', g.name,
    'categories', (
      WITH RECURSIVE up AS (
        SELECT c.id, c.name, c.parent_id, 0 AS depth FROM public.item_categories ic
        JOIN public.categories c ON c.id = ic.category_id
        WHERE ic.item_id IN (r.ingredient_item_id, coalesce(r.parent_ingredient_id, s.generic_id))
        UNION
        SELECT p.id, p.name, p.parent_id, up.depth + 1 FROM up JOIN public.categories p ON p.id = up.parent_id
        WHERE up.depth < 4
      )
      SELECT coalesce(jsonb_agg(up.name ORDER BY up.depth, up.name), '[]'::jsonb) FROM up
    ),
    'amount', r.amount,
    'unit', r.unit,
    'ai', f.flavor
  ) ORDER BY r.sort_order, r.id), '[]'::jsonb)
  FROM public.items i
  JOIN public.recipes r ON r.recipe_item_id = i.id
  LEFT JOIN public.items s ON s.id = r.ingredient_item_id
  LEFT JOIN public.items g ON g.id = coalesce(r.parent_ingredient_id, s.generic_id)
  LEFT JOIN private.ingredient_flavors f ON f.item_id = r.ingredient_item_id AND f.name = s.name
  WHERE i.id = p_item_id AND i.item_type = 'cocktail';
$$;

-- What a cocktail's profile is computed from: each line's ingredients (and
-- their names, which the rules read), amount and unit. NULL for anything that
-- isn't a cocktail.
CREATE OR REPLACE FUNCTION "private"."item_flavor_fingerprint"("p_item_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT md5(jsonb_build_object(
    'v', 1,
    'parts', (
      SELECT jsonb_agg(jsonb_build_array(r.ingredient_item_id, coalesce(r.parent_ingredient_id, s.generic_id), r.amount, r.unit, s.name, g.name)
                       ORDER BY r.sort_order, r.id)
      FROM public.recipes r
      LEFT JOIN public.items s ON s.id = r.ingredient_item_id
      LEFT JOIN public.items g ON g.id = coalesce(r.parent_ingredient_id, s.generic_id)
      WHERE r.recipe_item_id = i.id
    )
  )::text)
  FROM public.items i
  WHERE i.id = p_item_id AND i.item_type = 'cocktail';
$$;

ALTER VIEW "public"."app_recipe_presentation" SET ("security_invoker" = false);

-- ---------------------------------------------------------------------------
-- The shared bottles
-- ---------------------------------------------------------------------------

-- name: a shared ingredient as it's named today; generic: what it's a kind
-- of; category: its spirit category, added only when it has none.
CREATE TEMP TABLE "known_ingredients" ("name" text, "generic" text, "category" text);
INSERT INTO "known_ingredients" VALUES
    ('Gin', NULL, 'Gin'),
    ('Sweet Vermouth', NULL, 'Sweet / Rosso Vermouth'),
    ('Neutral grain spirit 40%', 'Vodka', 'Vodka'),
    ('Grey Goose', 'Vodka', 'Plain Vodka'),
    ('Cognac', NULL, 'Cognac'),
    ('Campari', NULL, 'Aperitivo (Red Bitter)'),
    ('Sugar - Caster', 'Sugar', NULL),
    ('Dry Vermouth', NULL, 'Dry Vermouth'),
    ('Eristoff Vodka', 'Vodka', 'Plain Vodka'),
    ('Ango', 'Angostura Bitters', NULL),
    ('Dash Absinthe', 'Absinthe', 'Absinthe'),
    ('Buffalo Trace Bourbon', 'Bourbon', 'Bourbon'),
    ('Veritas White Blend Rum', 'White Rum', 'Light / White Rum'),
    ('Dolin Dry Vermouth Fortified', 'Dry Vermouth', 'Dry Vermouth'),
    ('Neutral Grain Spirit 37.5%', 'Vodka', 'Vodka'),
    ('Neutral Grain Spirit 69.9%', 'Vodka', 'Vodka'),
    ('Salt - Table', 'Salt', NULL),
    ('Fructose Sugar', 'Sugar', NULL),
    ('Ocho Blanco', 'Blanco Tequila', 'Blanco'),
    ('Rye', NULL, 'Rye Whiskey'),
    ('Top Soda', 'Soda Water', NULL),
    ('Citadelle Gin Bag', 'Gin', 'Gin'),
    ('Martell VS', 'Cognac', 'Cognac'),
    ('Melbourne Gin Company Dry Gin', 'Gin', 'London Dry Gin'),
    ('Scotch', NULL, 'Scotch Whisky'),
    ('Absinthe', NULL, 'Absinthe'),
    ('Bourbon', NULL, 'Bourbon'),
    ('Highland Park 12', 'Scotch', 'Single Malt Scotch'),
    ('Dash Ango', 'Angostura Bitters', NULL),
    ('Peychauds', 'Peychaud''s Bitters', NULL),
    ('Tequila', NULL, 'Tequila'),
    ('Aperol', NULL, 'Aperitivo (Red Bitter)'),
    ('Applejack', 'Apple Brandy', 'Applejack'),
    ('Apry', 'Apricot Liqueur', 'Fruit Liqueur'),
    ('Aqua Riva Organic Agave Syrup', 'Agave Syrup', NULL),
    ('Benedictine', 'Bénédictine', 'Herbal / Monastic'),
    ('Chartreuse MOF', 'Green Chartreuse', 'Herbal / Monastic'),
    ('Marachino', 'Maraschino Liqueur', 'Fruit Liqueur'),
    ('Valdespino Amontillado Sherry', 'Amontillado Sherry', NULL),
    ('Yellow Chartreuse', NULL, 'Herbal / Monastic'),
    ('Cointreau', 'Orange Liqueur', 'Orange Liqueur'),
    ('Ethiopian Coffee', 'Coffee', NULL),
    ('Martini Rosso', 'Sweet Vermouth', 'Sweet / Rosso Vermouth'),
    ('Neutral Grain Spirit 96%', 'Vodka', 'Vodka'),
    ('Soda', 'Soda Water', NULL),
    ('Triple Sec', 'Orange Liqueur', 'Orange Liqueur'),
    ('Aged Rum', NULL, 'Aged / Añejo Rum'),
    ('Amaras Espadin', 'Mezcal', 'Espadín'),
    ('Cocchi Americano', 'Quinquina', 'Vermouth'),
    ('St Germain Elderflower Liqueur', 'Elderflower Liqueur', 'Liqueur'),
    ('White Rum', NULL, 'Light / White Rum'),
    ('Beechworth Bitters Daisy Age Amaro', 'Amaro', 'Amaro & Bitter'),
    ('Bénédictine', NULL, 'Herbal / Monastic'),
    ('Burgoin Verjus', 'Verjus', NULL),
    ('Calvados', NULL, 'Calvados'),
    ('Cappelletti Vino Aperitivo', NULL, 'Aperitivo (Red Bitter)'),
    ('Capreolus Raspberry Eau de Vie', 'Eau-de-Vie', 'Eau-de-Vie'),
    ('Cassis', 'Crème de Cassis', 'Fruit Liqueur'),
    ('Creme De Menthe', 'Crème de Menthe', 'Liqueur'),
    ('Dash Orange Bitters', 'Orange Bitters', NULL),
    ('Disaronno', 'Amaretto', 'Nut/Seed Liqueur'),
    ('Dolin Blanc Vermouth', 'Bianco Vermouth', 'Blanc / Bianco Vermouth'),
    ('Gospel Straight Rye Whiskey', 'Rye', 'Rye Whiskey'),
    ('Maraschino', 'Maraschino Liqueur', 'Fruit Liqueur'),
    ('Meletti Amaro', 'Amaro', 'Amaro & Bitter'),
    ('Olives', 'Olive', NULL),
    ('Rye Whiskey', 'Rye', 'Rye Whiskey'),
    ('Suze', 'Gentian Aperitif', 'Amaro & Bitter'),
    ('Toki', 'Japanese Whisky', 'Japanese Whisky'),
    ('30&40 Apple EDV', 'Eau-de-Vie', 'Eau-de-Vie'),
    ('Absinthe Rinse Glass', 'Absinthe', 'Absinthe'),
    ('Agave', 'Agave Syrup', NULL),
    ('Beefeater', 'Gin', 'London Dry Gin'),
    ('Cocchi Rosa', 'Vermouth', 'Vermouth'),
    ('Cocchi Vermouth di Torino', 'Sweet Vermouth', 'Sweet / Rosso Vermouth'),
    ('Curacao', 'Orange Liqueur', 'Orange Liqueur'),
    ('Cynar', 'Amaro', 'Carciofo'),
    ('Dash Orange', 'Orange Bitters', NULL),
    ('Dry Curacao', 'Orange Liqueur', 'Orange Liqueur'),
    ('Haku Vodka', 'Vodka', 'Plain Vodka'),
    ('House Vodka', 'Vodka', 'Vodka'),
    ('Husk Rare Blend Rum', 'Rum', 'Rum / Sugarcane'),
    ('Lillet', 'Quinquina', 'Vermouth'),
    ('Macvin du Jura', NULL, 'Liqueur'),
    ('Maraschino Liqueur', NULL, 'Fruit Liqueur'),
    ('Marionette Elderflower', 'Elderflower Liqueur', 'Liqueur'),
    ('Mery Melrose Cognac', 'Cognac', 'Cognac'),
    ('Mezcal', NULL, 'Mezcal'),
    ('Never Never Vodka', 'Vodka', 'Plain Vodka'),
    ('Pisco', NULL, 'Pisco'),
    ('Redbreast 12', 'Irish Whiskey', 'Irish Whiskey'),
    ('The Botanist Gin', 'Gin', 'Gin'),
    ('Vodka', NULL, 'Vodka'),
    ('Amaretto', NULL, 'Nut/Seed Liqueur'),
    ('Amaro Montenegro', 'Amaro', 'Amaro & Bitter'),
    ('Angel''s Envy', 'Bourbon', 'Bourbon'),
    ('Appleton Estate Signature', 'Jamaican Rum', 'Gold / Pale Rum'),
    ('Ayuuk', 'Mezcal', 'Mezcal'),
    ('Beechworth Bitters In The Weeds', 'Amaro', 'Amaro & Bitter'),
    ('Bellicose Pink Gin', 'Gin', 'Gin'),
    ('Bertrand Gentian Eau de Vie', 'Eau-de-Vie', 'Eau-de-Vie'),
    ('Brown Sugar Cube', 'Sugar', NULL),
    ('Cascahuin Blanco Tequila', 'Blanco Tequila', 'Blanco'),
    ('Cassis Float', 'Crème de Cassis', 'Fruit Liqueur'),
    ('Chamomile Tea', 'Tea', NULL),
    ('Chocolate Bitters', 'Bitters', NULL),
    ('Christian Drouin Selection Calvados', 'Calvados', 'Calvados'),
    ('Citadelle Gin', 'Gin', 'Gin'),
    ('Crème de Cassis', NULL, 'Fruit Liqueur'),
    ('Dark Rum', NULL, 'Dark / Black Rum'),
    ('Dom Benedictine', 'Bénédictine', 'Herbal / Monastic'),
    ('Dry Curaçao', 'Orange Liqueur', 'Orange Liqueur'),
    ('El Gobernador Pisco', 'Pisco', 'Pisco'),
    ('Fernet Branca', 'Fernet', 'Fernet'),
    ('Fino', 'Fino Sherry', NULL),
    ('Flor de Caña 4 Year Old Rum', 'Rum', 'Light / White Rum'),
    ('Green Chartreuse', NULL, 'Herbal / Monastic'),
    ('Honey Syrup 2:1', 'Honey Syrup', NULL),
    ('Irish', 'Irish Whiskey', 'Irish Whiskey'),
    ('Jamaican Rum', NULL, 'Rum / Sugarcane'),
    ('Knob Creek Bourbon', 'Bourbon', 'Bourbon'),
    ('Lager', 'Beer', NULL),
    ('Light Rum', 'White Rum', 'Light / White Rum'),
    ('Lillet Blanc', 'Quinquina', 'Vermouth'),
    ('Luxardo Bianco Bitter', NULL, 'Amaro & Bitter'),
    ('Manzanilla', 'Manzanilla Sherry', NULL),
    ('Michters Rye', 'Rye', 'Rye Whiskey'),
    ('Mii No Kotobuki Umeshu', 'Liqueur', 'Fruit Liqueur'),
    ('Nc''Nean Scotch', 'Scotch', 'Single Malt Scotch'),
    ('Never Never triple juniper Gin', 'Gin', 'Gin'),
    ('Nikka Ftb', 'Japanese Whisky', 'Japanese Whisky'),
    ('Orange Wine', 'White Wine', NULL),
    ('Pennyweight Oloroso Sherry', 'Oloroso Sherry', NULL),
    ('Pernod Absinthe', 'Absinthe', 'Absinthe'),
    ('Pey', 'Peychaud''s Bitters', NULL),
    ('Picon Amer', 'Amaro', 'Amaro & Bitter'),
    ('Piper-Heidsieck Essentiel', 'Champagne', NULL),
    ('Pisang Ambon Banana Liqueur', 'Liqueur', 'Fruit Liqueur'),
    ('Plantation 3 Star', 'White Rum', 'Light / White Rum'),
    ('Punt E Mes', 'Sweet Vermouth', 'Sweet / Rosso Vermouth'),
    ('PX Sherry', 'Pedro Ximénez Sherry', NULL),
    ('Ricard Pastis', 'Pastis', 'Absinthe'),
    ('Rinquinquin Peach Aperitif', 'Liqueur', 'Fruit Liqueur'),
    ('Ruby Port', 'Port', NULL),
    ('Saison White Flowers Vermouth', 'Vermouth', 'Vermouth'),
    ('Schweppes Soda Water', 'Soda Water', NULL),
    ('Smiling Wolf Functional Non Alc Gin', 'Gin', 'Gin'),
    ('Starward Twofold', 'Whiskey', 'Whisk(e)y'),
    ('Sven Joschke Pet Nat', 'Sparkling Wine', NULL),
    ('The Botanist Rested Gin', 'Gin', 'Gin'),
    ('Unico Zelo Pomelo Vermouth', 'Vermouth', 'Vermouth'),
    ('Vanilla Galliano', 'Liqueur', 'Liqueur'),
    ('White Crème de Cacao', 'Crème de Cacao', 'Liqueur'),
    ('Yuzushu', 'Liqueur', 'Fruit Liqueur'),
    ('Zucca Rabarbaro Amaro', 'Amaro', 'Rabarbaro'),
    ('40FT Disco Pils', 'Beer', NULL),
    ('666 Butter Vodka', 'Vodka', 'Flavored Vodka'),
    ('Absolut Vanilla Vodka', 'Vodka', 'Flavored Vodka'),
    ('Abstract Framboise', 'Liqueur', 'Fruit Liqueur'),
    ('Acid Adjusted Verjuice', 'Verjus', NULL),
    ('Aged Rum (S&C)', 'Aged Rum', 'Aged / Añejo Rum'),
    ('Agricole', 'Rhum Agricole', 'Rhum Agricole'),
    ('Almave Non Alc Agave', NULL, 'Agave Spirits'),
    ('Amaro - House Made', 'Amaro', 'Amaro & Bitter'),
    ('Amaro Trentino', 'Amaro', 'Alpine Amaro'),
    ('Amer Picon', 'Amaro', 'Amaro & Bitter'),
    ('Amores Espadin', 'Mezcal', 'Espadín'),
    ('Ancho Reyes Original', 'Liqueur', 'Liqueur'),
    ('Angostura', 'Angostura Bitters', NULL),
    ('Apricot Brandy', 'Apricot Liqueur', 'Fruit Liqueur'),
    ('Apricot EDV - Greensand Ridge', 'Eau-de-Vie', 'Eau-de-Vie'),
    ('Archie Rose True Cut Vodka', 'Vodka', 'Plain Vodka'),
    ('Archie Rose Vodka', 'Vodka', 'Plain Vodka'),
    ('Archie Rose White Cane', 'White Rum', 'Light / White Rum'),
    ('Arette Blanco Tequila', 'Blanco Tequila', 'Blanco'),
    ('Aromatic Honey Water 3:1', 'Honey Syrup', NULL),
    ('Banana Liqueur', 'Liqueur', 'Fruit Liqueur'),
    ('Barbados Rum', 'Rum', 'Rum / Sugarcane'),
    ('Barsol pisco', 'Pisco', 'Pisco'),
    ('Beefeater Gin', 'Gin', 'London Dry Gin'),
    ('Belvedere Vodka', 'Vodka', 'Plain Vodka'),
    ('Bianco Vermouth', NULL, 'Blanc / Bianco Vermouth'),
    ('Black Strap Rum', 'Dark Rum', 'Dark / Black Rum'),
    ('Blackberry Brandy / Cassis', 'Liqueur', 'Fruit Liqueur'),
    ('Blue Curaçao', 'Orange Liqueur', 'Orange Liqueur'),
    ('Bombay Premier Cru Murcian Lemon', 'Gin', 'London Dry Gin'),
    ('Bombay Sapphire', 'Gin', 'London Dry Gin'),
    ('Branca Menta Amaro', 'Fernet', 'Fernet'),
    ('Brandy', NULL, 'Brandy'),
    ('Briottet Manzana Verde', 'Liqueur', 'Fruit Liqueur'),
    ('Brokers Dry Gin', 'Gin', 'London Dry Gin'),
    ('Bruised Cucumber', 'Cucumber', NULL),
    ('Cachaca', 'Cachaça', 'Cachaça'),
    ('Cambodian sweet basil', 'Basil', NULL),
    ('Camilla Crush Cider', 'Cider', NULL),
    ('Cappelletti Bianco Vermouth', 'Bianco Vermouth', 'Blanc / Bianco Vermouth'),
    ('Cappelletti Pasubio', 'Amaro', 'Alpine Amaro'),
    ('Capreolus Victoria Plum eau de vie', 'Eau-de-Vie', 'Eau-de-Vie'),
    ('Cardamaro', 'Amaro', 'Amaro & Bitter'),
    ('Caretakers Gin', 'Gin', 'Gin'),
    ('Cascahuin Tequila', 'Tequila', 'Tequila'),
    ('Chartreuse Elixir Vegetale', 'Liqueur', 'Herbal / Monastic'),
    ('Chateau Jany - Sauternes', 'White Wine', NULL),
    ('Chenin Blanc', 'White Wine', NULL),
    ('Cherry Herring', 'Cherry Liqueur', 'Fruit Liqueur'),
    ('Christian Drouin La Blanche Calvados', 'Calvados', 'Calvados'),
    ('Christian Drouin La Blanche Eau De Cidre', 'Eau-de-Vie', 'Eau-de-Vie'),
    ('Cold Brew', 'Coffee', NULL),
    ('Cotes Du Rhone Reserve de L’Abbe', 'Red Wine', NULL),
    ('Cream Sherry', 'Sherry', NULL),
    ('Creme De Cassis', 'Crème de Cassis', 'Fruit Liqueur'),
    ('Creme De Violette', 'Crème de Violette', 'Liqueur'),
    ('Curaçao', 'Orange Liqueur', 'Orange Liqueur'),
    ('Cut Honey', 'Honey Syrup', NULL),
    ('Dash Absinte', 'Absinthe', 'Absinthe'),
    ('Dash Absinthe / Suze', 'Absinthe', 'Absinthe'),
    ('Dash Bitters', 'Bitters', NULL),
    ('Dash Pey', 'Peychaud''s Bitters', NULL),
    ('Date Cognac', 'Cognac', 'Cognac'),
    ('Dewar''s 12 Year Old', 'Scotch', 'Blended Scotch'),
    ('Dewar''s Blended Whisky', 'Scotch', 'Blended Scotch'),
    ('Distillerie Deniset-Klainguer Sapins Liqueur', 'Liqueur', 'Liqueur'),
    ('Dolin', 'Vermouth', 'Vermouth'),
    ('Dry Curacau', 'Orange Liqueur', 'Orange Liqueur'),
    ('Dry Red Wine', 'Red Wine', NULL),
    ('Dry Triple Sec', 'Orange Liqueur', 'Orange Liqueur'),
    ('Dry/Bianco Vermouth', 'Vermouth', 'Vermouth'),
    ('Earl Grey Tea', 'Tea', NULL),
    ('Egg Shite', 'Egg White', NULL),
    ('El Tequileno', 'Tequila', 'Tequila'),
    ('Estancia Raicilla', 'Raicilla', 'Raicilla'),
    ('Falernum', NULL, 'Liqueur'),
    ('Fernet', NULL, 'Fernet'),
    ('Fernet Branca Menta', 'Fernet', 'Fernet'),
    ('Fernet Brance', 'Fernet', 'Fernet'),
    ('Fig Leaf Gospel Rye', 'Rye', 'Rye Whiskey'),
    ('Fino Style Sherry', 'Fino Sherry', NULL),
    ('Float Claret / Blackberry Wine', 'Red Wine', NULL),
    ('Foret Pastis', 'Pastis', 'Absinthe'),
    ('Four Pillars Rare dry Gin', 'Gin', 'Contemporary / New Western'),
    ('Four Pillars yuzu Gin', 'Gin', 'Contemporary / New Western'),
    ('Four Roses Small Batch Bourbon', 'Bourbon', 'Bourbon'),
    ('Fresh Lemon Juice', 'Lemon Juice', NULL),
    ('Fresh Lime Juice', 'Lime Juice', NULL),
    ('Genever', NULL, 'Genever'),
    ('Genmaicha', 'Tea', NULL),
    ('Germana Caetanos Cachaça', 'Cachaça', 'Cachaça'),
    ('Giffard Pacifico Triple Sec', 'Orange Liqueur', 'Orange Liqueur'),
    ('Gold Rum', 'Rum', 'Gold / Pale Rum'),
    ('Gomme', 'Simple Syrup', NULL),
    ('Grada Coffee Liqueur', 'Coffee Liqueur', 'Coffee Liqueur'),
    ('Grand Marnier', 'Orange Liqueur', 'Orange Liqueur'),
    ('Guinness', 'Beer', NULL),
    ('H By Hine Cognac', 'Cognac', 'Cognac'),
    ('Harbour Fin Lager', 'Beer', NULL),
    ('Hojicha Cocchi Rosa', 'Vermouth', 'Vermouth'),
    ('Homey Syrup', 'Honey Syrup', NULL),
    ('Honey Syrup 3:1', 'Honey Syrup', NULL),
    ('House Dry Vermouth', 'Dry Vermouth', 'Dry Vermouth'),
    ('House Fino Sherry', 'Fino Sherry', NULL),
    ('House Rum Blend', 'Rum', 'Rum / Sugarcane'),
    ('Husk Coconut', 'Rum', 'Rum / Sugarcane'),
    ('Husk Dark Blend', 'Dark Rum', 'Dark / Black Rum'),
    ('Islay Float', 'Islay Scotch', 'Islay Scotch'),
    ('Jameson Original', 'Irish Whiskey', 'Irish Whiskey'),
    ('Jasmine Silver Tip (Rare Tea)', 'Tea', NULL),
    ('Junmai Sake', 'Sake', NULL),
    ('Kalamata Pitted Olive', 'Olive', NULL),
    ('Kümmel', 'Liqueur', 'Liqueur'),
    ('La Goya Manzanilla', 'Manzanilla Sherry', NULL),
    ('La Mercier Absinthe Amer', 'Absinthe', 'Absinthe'),
    ('La Venenosa Raicilla', 'Raicilla', 'Raicilla'),
    ('Lapsang Bitters', 'Bitters', NULL),
    ('Lemon Balm Dolin Dry', 'Dry Vermouth', 'Dry Vermouth'),
    ('Lemon Pekoe Tea', 'Tea', NULL),
    ('Licor 43', 'Liqueur', 'Liqueur'),
    ('Lillet Rouge', 'Quinquina', 'Vermouth'),
    ('Lustau Fino Sherry', 'Fino Sherry', NULL),
    ('Mandarin Spirit', 'Eau-de-Vie', 'Eau-de-Vie'),
    ('Mango Liqueur', 'Liqueur', 'Fruit Liqueur'),
    ('Manguin Apricot EDV', 'Eau-de-Vie', 'Eau-de-Vie'),
    ('Manuka Honey', 'Honey', NULL),
    ('Mao Feng Tea', 'Tea', NULL),
    ('Marionette Apricot', 'Apricot Liqueur', 'Fruit Liqueur'),
    ('Marionette Bitter', 'Amaro', 'Amaro & Bitter'),
    ('Marionette Bitter Curacao', 'Orange Liqueur', 'Orange Liqueur'),
    ('Marionette Mure', 'Crème de Mûre', 'Fruit Liqueur'),
    ('Martell VSOP', 'Cognac', 'Cognac'),
    ('Martini Prosecco D.O.C', 'Prosecco', NULL),
    ('Matcha Liqueur', 'Liqueur', 'Liqueur'),
    ('Maurin', 'Quinquina', 'Vermouth'),
    ('Melon Liqueur', 'Liqueur', 'Fruit Liqueur'),
    ('Merlet Apricot', 'Apricot Liqueur', 'Fruit Liqueur'),
    ('Merlet Creme de Peche', 'Liqueur', 'Fruit Liqueur'),
    ('Mezcal Verde Momento', 'Mezcal', 'Mezcal'),
    ('Michters Bourbon', 'Bourbon', 'Bourbon'),
    ('Mixed Citrus Vodka', 'Vodka', 'Flavored Vodka'),
    ('Molly Rose Pastis', 'Pastis', 'Absinthe'),
    ('Monin Orgeat (Almond)', 'Orgeat', NULL),
    ('Monkey Shoulder', 'Scotch', 'Blended Scotch'),
    ('Mr Black', 'Coffee Liqueur', 'Coffee Liqueur'),
    ('Mrs Betters Foaming Bitters', 'Bitters', NULL),
    ('Muyu Jasmine', 'Liqueur', 'Liqueur'),
    ('Muyu Vetiver Gris', 'Liqueur', 'Liqueur'),
    ('Neroli Tincture', 'Tincture', NULL),
    ('Nocellara Olives', 'Olive', NULL),
    ('Nocino', 'Liqueur', 'Nut/Seed Liqueur'),
    ('Ooray & bush tea salt', 'Salt', NULL),
    ('Ota Shuzo Melon Liqueur', 'Liqueur', 'Fruit Liqueur'),
    ('Pandan Nut Liqueur', 'Liqueur', 'Nut/Seed Liqueur'),
    ('Patron Anejo', 'Añejo Tequila', 'Añejo'),
    ('Peach Liqueur', 'Liqueur', 'Fruit Liqueur'),
    ('Peeled Orange Juice', 'Orange Juice', NULL),
    ('Pennyweight Constance Fino', 'Fino Sherry', NULL),
    ('Pennyweight Fino Apera', 'Fino Sherry', NULL),
    ('Perello olive (gordal picante)', 'Olive', NULL),
    ('Picon', 'Amaro', 'Amaro & Bitter'),
    ('Pipacha Oolong (rare tea)', 'Tea', NULL),
    ('Poire 100% Calvados', 'Calvados', 'Calvados'),
    ('Port Charlotte', 'Islay Scotch', 'Islay Scotch'),
    ('Port Tawny', 'Port', NULL),
    ('Pressed Moto Sake', 'Sake', NULL),
    ('Px House Made', 'Pedro Ximénez Sherry', NULL),
    ('Quince Miclo', 'Eau-de-Vie', 'Eau-de-Vie'),
    ('Rare tea english manuka', 'Tea', NULL),
    ('Rare tea nepali himalayan spring', 'Tea', NULL),
    ('Rare tea tarry lapsang', 'Tea', NULL),
    ('Raspberry Leaf Tea', 'Tea', NULL),
    ('Ratafia Rossi', 'Liqueur', 'Liqueur'),
    ('Regal Rogue Bianco Vermouth', 'Bianco Vermouth', 'Blanc / Bianco Vermouth'),
    ('Remy Martin 1738', 'Cognac', 'Cognac'),
    ('Roku Gin', 'Gin', 'Gin'),
    ('Romate PX Sherry', 'Pedro Ximénez Sherry', NULL),
    ('Ruby Cacao', 'Liqueur', 'Liqueur'),
    ('Rum', NULL, 'Rum / Sugarcane'),
    ('Rum Blend', 'Rum', 'Rum / Sugarcane'),
    ('Sagatiba Cachaça', 'Cachaça', 'Cachaça'),
    ('Saison Fallen Quinces Vermouth', 'Vermouth', 'Vermouth'),
    ('Schweppes Soda Can', 'Soda Water', NULL),
    ('Scotch Whisky', 'Scotch', 'Scotch Whisky'),
    ('Sfumato Rabarbaro', 'Amaro', 'Rabarbaro'),
    ('Shiraz Float', 'Red Wine', NULL),
    ('Single Apiary Pure British Honey', 'Honey', NULL),
    ('Smoked Sugar', 'Sugar', NULL),
    ('Strawberry Milk', 'Milk', NULL),
    ('Strega', 'Liqueur', 'Herbal / Monastic'),
    ('Sugar - Muscovado', 'Sugar', NULL),
    ('Suze Liqueur', 'Gentian Aperitif', 'Amaro & Bitter'),
    ('Tangelo Curaçao', 'Orange Liqueur', 'Orange Liqueur'),
    ('Tio Pepe Fino Sherry', 'Fino Sherry', NULL),
    ('Toki Japanese Whisky', 'Japanese Whisky', 'Japanese Whisky'),
    ('Top With Pale Ale - Lord Nelson', 'Beer', NULL),
    ('Two Drifters Pineapple OP Rum', 'Overproof Rum', 'Overproof Rum'),
    ('Verjuice', 'Verjus', NULL),
    ('Walcher Niosette', 'Liqueur', 'Nut/Seed Liqueur'),
    ('White Port', 'Port', NULL),
    ('Willliams Pear', 'Eau-de-Vie', 'Eau-de-Vie'),
    ('Woodford Reserve Bourbon', 'Bourbon', 'Bourbon'),
    ('Yayoi Par Hassard Pet Nat', 'Sparkling Wine', NULL),
    ('Yoowe Palmilla Sotol', 'Sotol', 'Sotol'),
    ('5 Sentidos Espadin Capon Mezcal', 'Mezcal', 'Espadín'),
    ('Amaro Nonino', 'Amaro', 'Amaro & Bitter'),
    ('Aperol Amaro', NULL, 'Aperitivo (Red Bitter)'),
    ('Ardnamurchan CK.475 independant', 'Scotch', 'Single Malt Scotch'),
    ('Arette repo sauve Tequila', 'Reposado Tequila', 'Reposado'),
    ('Averna Amaro', 'Amaro', 'Amaro & Bitter'),
    ('Barbadillo Oloroso Fortified', 'Oloroso Sherry', NULL),
    ('Barsol Quebranta brandy(ish)', 'Pisco', 'Pisco'),
    ('Basil Haydens cask American', 'Bourbon', 'Bourbon'),
    ('Blind Summit Lochindaal independant', 'Islay Scotch', 'Islay Scotch'),
    ('Boatyard Double Gin', 'Gin', 'Gin'),
    ('Braulio Amaro', 'Amaro', 'Alpine Amaro'),
    ('Campari Amaro', NULL, 'Aperitivo (Red Bitter)'),
    ('Cape Byron Australian', 'Whiskey', 'Whisk(e)y'),
    ('Cinzano Rosso Vermouth Fortified', 'Sweet Vermouth', 'Sweet / Rosso Vermouth'),
    ('Compass Box Nectarosity Scotch', 'Scotch', 'Blended Scotch'),
    ('Crème de Noyaux', 'Liqueur', 'Nut/Seed Liqueur'),
    ('Cynar Amaro', 'Amaro', 'Carciofo'),
    ('Del Bac Classic American', 'Whiskey', 'Whisk(e)y'),
    ('Derumbas Michoacan Mezcal', 'Mezcal', 'Mezcal'),
    ('Diplomatico Ex Reserva Dark Rum', 'Dark Rum', 'Dark / Black Rum'),
    ('Dixeebe Mezcal', 'Mezcal', 'Mezcal'),
    ('El Amparo White Rum', 'White Rum', 'Light / White Rum'),
    ('Ester dry Gin', 'Gin', 'London Dry Gin'),
    ('Ester strong Gin', 'Gin', 'Gin'),
    ('Fernaux Smoky Wedding Australian', 'Whiskey', 'Whisk(e)y'),
    ('Fernet Branca Amaro', NULL, 'Fernet'),
    ('Forteleza Blanco Tequila', 'Blanco Tequila', 'Blanco'),
    ('Four Pillars Bloody Shiraz 2023 Gin', 'Gin', 'Gin'),
    ('Four Pillars Leaf Gin', 'Gin', 'Gin'),
    ('Furneaux Peated Australian', 'Whiskey', 'Whisk(e)y'),
    ('Furneaux Untamed Gin', 'Gin', 'Gin'),
    ('Glenfarclas 10yr Scotch', 'Scotch', 'Single Malt Scotch'),
    ('Gosling black seal Dark Rum', 'Dark Rum', 'Dark / Black Rum'),
    ('Green Spot Chateau Montelena Irish Whiskey', 'Irish Whiskey', 'Irish Whiskey'),
    ('Grey Goose Vodka', 'Vodka', 'Plain Vodka'),
    ('Havana 3yr White Rum', 'White Rum', 'Light / White Rum'),
    ('Hendricks Gin', 'Gin', 'Gin'),
    ('Ichiros Malt & Grain World', 'Whiskey', 'Whisk(e)y'),
    ('In Situ Mezcal', 'Mezcal', 'Mezcal'),
    ('Infrequent Flyers Braeval distillery independant', 'Scotch', 'Single Malt Scotch'),
    ('Jameson Irish Whiskey', 'Irish Whiskey', 'Irish Whiskey'),
    ('Jinzu Gin', 'Gin', 'Gin'),
    ('Jonny Walker Blue label Scotch', 'Scotch', 'Blended Scotch'),
    ('Jung One Gin', 'Gin', 'Gin'),
    ('King Lake Distillery Australian', 'Whiskey', 'Whisk(e)y'),
    ('La Venenosa costa Jalisco (green) raicillia', 'Raicilla', 'Raicilla'),
    ('La Venenosa tabernas 3rd Ed raicillia', 'Raicilla', 'Raicilla'),
    ('Lagavulin 8 Scotch', 'Islay Scotch', 'Islay Scotch'),
    ('Lairds Applejack 86 brandy(ish)', 'Apple Brandy', 'Applejack'),
    ('Laphroaig Oak Select Scotch', 'Islay Scotch', 'Islay Scotch'),
    ('Lillet Blanc Fortified', 'Quinquina', 'Vermouth'),
    ('Lustau Amontillado Fortified', 'Amontillado Sherry', NULL),
    ('Martel VS Brandy', 'Cognac', 'Cognac'),
    ('Mayalen Borrego Mezcal', 'Mezcal', 'Mezcal'),
    ('Michters 10 year Straight Rye American', 'Rye', 'Rye Whiskey'),
    ('Michters Bourbon American', 'Bourbon', 'Bourbon'),
    ('Michters Rye American', 'Rye', 'Rye Whiskey'),
    ('Montenegro', 'Amaro', 'Amaro & Bitter'),
    ('Never Never Beeswax & Olive Gin', 'Gin', 'Gin'),
    ('Never Never Oyster shell Gin', 'Gin', 'Gin'),
    ('Never Never Southern Strength Gin', 'Gin', 'Gin'),
    ('Nikka Days Japanese Whisky', 'Japanese Whisky', 'Japanese Whisky'),
    ('Ocho Plata tequila', 'Blanco Tequila', 'Blanco'),
    ('Ofrenda (Bat & Hummingbird) Mezcal', 'Mezcal', 'Mezcal'),
    ('Ono Sotol', 'Sotol', 'Sotol'),
    ('Origin Raiz - Madrecuixe Mezcal', 'Mezcal', 'Mezcal'),
    ('Passionfruit Cordial', 'Cordial', NULL),
    ('Picon Biere Amaro', 'Amaro', 'Amaro & Bitter'),
    ('Plantation Dark Dark Rum', 'Dark Rum', 'Dark / Black Rum'),
    ('Plymouth Gin', 'Gin', 'Gin'),
    ('Plymouth sloe Gin', 'Sloe Gin', 'Sloe Gin'),
    ('Ratu 5yr spiced rum Dark Rum', 'Rum', 'Spiced Rum'),
    ('Stauning Rye World', 'Rye', 'Rye Whiskey'),
    ('Takesuru pure malt Japanese Whisky', 'Japanese Whisky', 'Japanese Whisky'),
    ('Tapatio Blanco Tequila', 'Blanco Tequila', 'Blanco'),
    ('The Balvenie Double Wood Scotch', 'Scotch', 'Single Malt Scotch'),
    ('Thompson Bro''s Inchgower independant', 'Scotch', 'Single Malt Scotch'),
    ('Thompson Bro''s Linkwood independant', 'Scotch', 'Single Malt Scotch'),
    ('Thompson Bro''s Orkney Scotch', 'Scotch', 'Single Malt Scotch'),
    ('Tullibardine 225 Scotch', 'Scotch', 'Single Malt Scotch'),
    ('Union Mezcal', 'Mezcal', 'Mezcal'),
    ('Valdespino Fino Sherry Fortified', 'Fino Sherry', NULL),
    ('Whistle Pig Piggyback Bourbon American', 'Bourbon', 'Bourbon'),
    ('Willet Pot Still Reserve American', 'Bourbon', 'Bourbon'),
    ('Wrey & Nephew White Rum', 'Overproof Rum', 'Overproof Rum'),
    ('London Dry Gin', 'Gin', NULL),
    ('Old Tom Gin', 'Gin', NULL),
    ('Sloe Gin', 'Gin', NULL),
    ('White Rum', 'Rum', NULL),
    ('Aged Rum', 'Rum', NULL),
    ('Dark Rum', 'Rum', NULL),
    ('Jamaican Rum', 'Rum', NULL),
    ('Overproof Rum', 'Rum', NULL),
    ('Rhum Agricole', 'Rum', NULL),
    ('Blanco Tequila', 'Tequila', NULL),
    ('Reposado Tequila', 'Tequila', NULL),
    ('Añejo Tequila', 'Tequila', NULL),
    ('Islay Scotch', 'Scotch', NULL),
    ('Scotch', 'Whiskey', NULL),
    ('Bourbon', 'Whiskey', NULL),
    ('Rye', 'Whiskey', NULL),
    ('Irish Whiskey', 'Whiskey', NULL),
    ('Japanese Whisky', 'Whiskey', NULL),
    ('Cognac', 'Brandy', NULL),
    ('Armagnac', 'Brandy', NULL),
    ('Calvados', 'Apple Brandy', NULL),
    ('Apple Brandy', 'Brandy', NULL),
    ('Pisco', 'Brandy', NULL),
    ('Sweet Vermouth', 'Vermouth', NULL),
    ('Dry Vermouth', 'Vermouth', NULL),
    ('Bianco Vermouth', 'Vermouth', NULL),
    ('Fino Sherry', 'Sherry', NULL),
    ('Manzanilla Sherry', 'Sherry', NULL),
    ('Amontillado Sherry', 'Sherry', NULL),
    ('Oloroso Sherry', 'Sherry', NULL),
    ('Pedro Ximénez Sherry', 'Sherry', NULL),
    ('Champagne', 'Sparkling Wine', NULL),
    ('Prosecco', 'Sparkling Wine', NULL),
    ('Honey Syrup', 'Simple Syrup', NULL),
    ('Demerara Syrup', 'Simple Syrup', NULL),
    ('Angostura Bitters', 'Aromatic Bitters', NULL),
    ('Aromatic Bitters', 'Bitters', NULL),
    ('Orange Bitters', 'Bitters', NULL),
    ('Peychaud''s Bitters', 'Bitters', NULL),
    ('Green Chartreuse', 'Liqueur', NULL),
    ('Yellow Chartreuse', 'Liqueur', NULL),
    ('Maraschino Liqueur', 'Liqueur', NULL),
    ('Orange Liqueur', 'Liqueur', NULL),
    ('Coffee Liqueur', 'Liqueur', NULL),
    ('Elderflower Liqueur', 'Liqueur', NULL),
    ('Crème de Cassis', 'Liqueur', NULL),
    ('Crème de Cacao', 'Liqueur', NULL),
    ('Crème de Menthe', 'Liqueur', NULL),
    ('Crème de Violette', 'Liqueur', NULL),
    ('Crème de Mûre', 'Liqueur', NULL),
    ('Apricot Liqueur', 'Liqueur', NULL),
    ('Cherry Liqueur', 'Liqueur', NULL),
    ('Amaretto', 'Liqueur', NULL),
    ('Falernum', 'Liqueur', NULL),
    ('Allspice Dram', 'Liqueur', NULL),
    ('Bénédictine', 'Liqueur', NULL);

-- The generics themselves, with their categories.
CREATE TEMP TABLE "generic_ingredients" ("name" text, "category" text);
INSERT INTO "generic_ingredients" VALUES
    ('Absinthe', 'Absinthe'),
    ('Agave Syrup', NULL),
    ('Aged Rum', 'Aged / Añejo Rum'),
    ('Allspice Dram', 'Liqueur'),
    ('Amaretto', 'Nut/Seed Liqueur'),
    ('Amaro', 'Amaro & Bitter'),
    ('Amontillado Sherry', NULL),
    ('Angostura Bitters', NULL),
    ('Aperol', 'Aperitivo (Red Bitter)'),
    ('Apple Brandy', 'Applejack'),
    ('Apricot Liqueur', 'Fruit Liqueur'),
    ('Aquavit', 'Aquavit'),
    ('Armagnac', 'Armagnac'),
    ('Aromatic Bitters', NULL),
    ('Arrack', 'Arrack'),
    ('Awamori', 'Awamori'),
    ('Añejo Tequila', 'Añejo'),
    ('Baijiu', 'Baijiu'),
    ('Basil', NULL),
    ('Beer', NULL),
    ('Bianco Vermouth', 'Blanc / Bianco Vermouth'),
    ('Bitters', NULL),
    ('Blanco Tequila', 'Blanco'),
    ('Bourbon', 'Bourbon'),
    ('Brandy', 'Brandy'),
    ('Bénédictine', 'Herbal / Monastic'),
    ('Cachaça', 'Cachaça'),
    ('Calvados', 'Calvados'),
    ('Campari', 'Aperitivo (Red Bitter)'),
    ('Champagne', NULL),
    ('Cherry Liqueur', 'Fruit Liqueur'),
    ('Cider', NULL),
    ('Coffee', NULL),
    ('Coffee Liqueur', 'Coffee Liqueur'),
    ('Cognac', 'Cognac'),
    ('Cordial', NULL),
    ('Crème de Cacao', 'Liqueur'),
    ('Crème de Cassis', 'Fruit Liqueur'),
    ('Crème de Menthe', 'Liqueur'),
    ('Crème de Mûre', 'Fruit Liqueur'),
    ('Crème de Violette', 'Liqueur'),
    ('Cucumber', NULL),
    ('Dark Rum', 'Dark / Black Rum'),
    ('Demerara Syrup', NULL),
    ('Dry Vermouth', 'Dry Vermouth'),
    ('Eau-de-Vie', 'Eau-de-Vie'),
    ('Egg White', NULL),
    ('Elderflower Liqueur', 'Liqueur'),
    ('Falernum', 'Liqueur'),
    ('Fernet', 'Fernet'),
    ('Fino Sherry', NULL),
    ('Genever', 'Genever'),
    ('Gentian Aperitif', 'Amaro & Bitter'),
    ('Gin', 'Gin'),
    ('Grappa', 'Grappa'),
    ('Green Chartreuse', 'Herbal / Monastic'),
    ('Honey', NULL),
    ('Honey Syrup', NULL),
    ('Irish Whiskey', 'Irish Whiskey'),
    ('Islay Scotch', 'Islay Scotch'),
    ('Jamaican Rum', 'Rum / Sugarcane'),
    ('Japanese Whisky', 'Japanese Whisky'),
    ('Lemon Juice', NULL),
    ('Lime Juice', NULL),
    ('Liqueur', 'Liqueur'),
    ('London Dry Gin', 'London Dry Gin'),
    ('Manzanilla Sherry', NULL),
    ('Maraschino Liqueur', 'Liqueur'),
    ('Mezcal', 'Mezcal'),
    ('Milk', NULL),
    ('Old Tom Gin', 'Old Tom Gin'),
    ('Olive', NULL),
    ('Oloroso Sherry', NULL),
    ('Orange Bitters', NULL),
    ('Orange Juice', NULL),
    ('Orange Liqueur', 'Orange Liqueur'),
    ('Orgeat', NULL),
    ('Overproof Rum', 'Overproof Rum'),
    ('Pastis', 'Absinthe'),
    ('Pedro Ximénez Sherry', NULL),
    ('Peychaud''s Bitters', NULL),
    ('Pisco', 'Pisco'),
    ('Port', NULL),
    ('Prosecco', NULL),
    ('Quinquina', 'Vermouth'),
    ('Raicilla', 'Raicilla'),
    ('Red Wine', NULL),
    ('Reposado Tequila', 'Reposado'),
    ('Rhum Agricole', 'Rhum Agricole'),
    ('Rum', 'Rum / Sugarcane'),
    ('Rye', 'Rye Whiskey'),
    ('Sake', NULL),
    ('Salt', NULL),
    ('Scotch', 'Scotch Whisky'),
    ('Sherry', NULL),
    ('Shochu', 'Shochu'),
    ('Simple Syrup', NULL),
    ('Sloe Gin', 'Sloe Gin'),
    ('Soda Water', NULL),
    ('Soju', 'Soju'),
    ('Sotol', 'Sotol'),
    ('Sparkling Wine', NULL),
    ('Sugar', NULL),
    ('Sweet Vermouth', 'Sweet / Rosso Vermouth'),
    ('Tea', NULL),
    ('Tequila', 'Tequila'),
    ('Tincture', NULL),
    ('Verjus', NULL),
    ('Vermouth', 'Vermouth'),
    ('Vodka', 'Vodka'),
    ('Whiskey', 'Whisk(e)y'),
    ('White Rum', 'Light / White Rum'),
    ('White Wine', NULL),
    ('Yellow Chartreuse', 'Herbal / Monastic');

-- Generics that don't exist yet become shared, searchable ingredients.
INSERT INTO "public"."items" ("name", "item_type", "hide_from_search")
SELECT g.name, 'ingredient', false
FROM "generic_ingredients" g
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND lower(i.name) = lower(g.name)
);

CREATE TEMP TABLE "shared_ingredients" AS
SELECT DISTINCT ON (lower(name)) lower(name) AS key, id
FROM "public"."items" WHERE item_type = 'ingredient' AND bar_id IS NULL
ORDER BY lower(name), created_at;

-- Known bottles and styles take their generic.
UPDATE "public"."items" i SET "generic_id" = g.id
FROM "known_ingredients" k
JOIN "shared_ingredients" s ON s.key = lower(k.name)
JOIN "shared_ingredients" g ON g.key = lower(k.generic)
WHERE i.id = s.id AND i.generic_id IS NULL AND g.id <> i.id;

-- Generics that are themselves a kind of something ("Islay Scotch" is a Scotch).
UPDATE "public"."items" i SET "generic_id" = g.id
FROM "generic_ingredients" k
JOIN "shared_ingredients" s ON s.key = lower(k.name)
JOIN "known_ingredients" kk ON lower(kk.name) = lower(k.name)
JOIN "shared_ingredients" g ON g.key = lower(kk.generic)
WHERE i.id = s.id AND i.generic_id IS NULL AND g.id <> i.id;

-- An ingredient whose recipe lines all name one parent is a kind of it.
UPDATE "public"."items" i SET "generic_id" = p.parent_id
FROM (
    SELECT r.ingredient_item_id, min(r.parent_ingredient_id::text)::uuid AS parent_id
    FROM "public"."recipes" r
    WHERE r.parent_ingredient_id IS NOT NULL
    GROUP BY r.ingredient_item_id
    HAVING count(DISTINCT r.parent_ingredient_id) = 1
) p
WHERE i.id = p.ingredient_item_id AND i.item_type = 'ingredient' AND i.generic_id IS NULL AND p.parent_id <> i.id;

-- Spirit categories, only where an ingredient has none.
INSERT INTO "public"."item_categories" ("item_id", "category_id", "is_primary")
SELECT s.id, c.id, true
FROM (
    SELECT name, category FROM "known_ingredients" WHERE category IS NOT NULL
    UNION ALL
    SELECT name, category FROM "generic_ingredients" WHERE category IS NOT NULL
) k
JOIN "shared_ingredients" s ON s.key = lower(k.name)
JOIN LATERAL (
    SELECT c.id FROM "public"."categories" c WHERE c.domain = 'spirit' AND c.name = k.category ORDER BY c.created_at LIMIT 1
) c ON true
WHERE NOT EXISTS (SELECT 1 FROM "public"."item_categories" x WHERE x.item_id = s.id)
ON CONFLICT DO NOTHING;

DROP TABLE "known_ingredients", "generic_ingredients", "shared_ingredients";
