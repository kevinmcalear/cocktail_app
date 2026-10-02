-- Drop specs copied from Difford's, Punch, Imbibe and The World's 50 Best,
-- and product photos we have no licence for. Cited lines stay. Gosling's,
-- Pusser's and Sazerac's own products keep their names.

-- Borrowed specs: shared catalog rows whose notes say the measures came from
-- one of those sites. A venue's own drink is left alone.
CREATE TEMP TABLE "borrowed_specs" AS
SELECT "id", "notes"
FROM "public"."items"
WHERE "bar_id" IS NULL
  AND "notes" ~ 'Spec (adapted )?from (Difford|Punch|Imbibe|The World''s 50 Best|50 Best)';

DELETE FROM "public"."recipes" WHERE "recipe_item_id" IN (SELECT "id" FROM "borrowed_specs");
DELETE FROM "public"."item_methods" WHERE "item_id" IN (SELECT "id" FROM "borrowed_specs");

UPDATE "public"."items" i
SET "glassware_id" = NULL, "ice_id" = NULL
WHERE i.id IN (SELECT "id" FROM "borrowed_specs");

-- Keep the story and the "Spec from …" citation. Drop the method, then any
-- trailing prep lines written as "Label: instruction" (copied steps that
-- have no Method: heading). A story sentence is left alone.
DO $$
DECLARE
    r record;
    n text;
    spec_at int;
    method_at int;
    head text;
    trimmed text;
    prep text := '\n\n([A-Z][^.:\n]{0,40}: [^\n]+\n)*[A-Z][^.:\n]{0,40}: [^\n]+$';
BEGIN
    FOR r IN SELECT "id", "notes" FROM "borrowed_specs" LOOP
        n := r.notes;
        spec_at := position(E'\nSpec ' IN n);
        IF spec_at = 0 THEN CONTINUE; END IF;
        method_at := position(E'\nMethod:' IN n);
        IF method_at > 0 AND method_at < spec_at THEN
            n := left(n, method_at - 1) || substr(n, spec_at);
            spec_at := position(E'\nSpec ' IN n);
        END IF;
        LOOP
            head := rtrim(left(n, spec_at - 1), E'\n');
            trimmed := regexp_replace(head, prep, '');
            EXIT WHEN trimmed = head;
            n := rtrim(trimmed, E'\n') || E'\n' || substr(n, spec_at);
            spec_at := position(E'\nSpec ' IN n);
            EXIT WHEN spec_at = 0;
        END LOOP;
        UPDATE "public"."items" SET "notes" = n WHERE "id" = r.id;
    END LOOP;
END $$;

DROP TABLE "borrowed_specs";

-- Generic copy that used Painkiller or Dark 'n' Stormy as an ordinary recipe.
-- The brands' own bottles keep the names.
UPDATE "public"."items" SET "description" = CASE "name"
    WHEN 'Dark Rum' THEN 'Deeply coloured rum with a rich molasses and burnt sugar character, often from added caramel as much as age. Used for floats and punches.'
    WHEN 'Ginger Beer' THEN 'Spicy, sweet carbonated ginger drink, usually stronger than ginger ale. The mixer for a Moscow Mule and other ginger highballs.'
    WHEN 'House Ginger Beer' THEN 'Fresh ginger juice, lemon juice, sugar and water, chilled and force carbonated. Spicier and drier than most bottled ginger beers; for Mules.'
    WHEN 'Fever-Tree Ginger Beer' THEN 'Spicy Fever-Tree ginger beer with fresh ginger heat. A common Moscow Mule mixer on craft back bars.'
    WHEN 'Fentimans Ginger Beer' THEN 'Brewed ginger beer from Fentimans with strong ginger and herbal flavour. A classic mule mixer in UK bars.'
    WHEN 'Thomas Henry Ginger Beer' THEN 'German ginger beer from Thomas Henry with firm spice and clean sweetness. A common European mule mixer.'
    WHEN 'Nutmeg' THEN 'Hard brown seed with a warm, sweet and woody spice flavour. Grated fresh over flips, eggnog and punches as a finishing garnish.'
    WHEN 'Cream of Coconut' THEN 'Thick, sweetened coconut cream sold in tins or squeeze bottles. It is the coconut part of a Piña Colada, and is not the same as coconut cream.'
    ELSE "description"
END
WHERE "bar_id" IS NULL
  AND "name" IN (
    'Dark Rum', 'Ginger Beer', 'House Ginger Beer', 'Fever-Tree Ginger Beer',
    'Fentimans Ginger Beer', 'Thomas Henry Ginger Beer', 'Nutmeg', 'Cream of Coconut'
  )
  AND "description" ~* '(painkiller|stormy)';

UPDATE "public"."items"
SET "description" = 'A frozen pineapple and coconut drink given an umami punch, listed among the bar''s menu highlights.'
WHERE "name" = 'Koji Killer' AND "description" LIKE '%Painkiller%';

UPDATE "public"."items"
SET "description" = 'New Orleans'' official cocktail, tied to the Sazerac Coffee House since the mid-1800s.'
WHERE "bar_id" IS NULL AND "name" = 'Sazerac'
  AND "description" LIKE '%absinthe-rinsed%';

UPDATE "public"."items"
SET "notes" = replace("notes", 'at New York''s Painkiller', 'in New York')
WHERE "notes" LIKE '%New York''s Painkiller%';

-- Photos credited to a company or a museum, with no permission on file.
-- Deleting the image row drops the links (item_images.image_id cascades).
DELETE FROM "public"."images"
WHERE "source_url" IN (
  'https://commons.wikimedia.org/wiki/File:Affligem_Blonde.png',
  'https://commons.wikimedia.org/wiki/File:Steinlager_Limited_Edition_All_Blacks_Bottle.jpg',
  'https://commons.wikimedia.org/wiki/File:Roses_Lime_NZ_2013_Label.JPG',
  'https://commons.wikimedia.org/wiki/File:Print%2C_trade-card_(BM_1957%2C0920.2).jpg',
  'https://commons.wikimedia.org/wiki/File:Tuaca_750_newbottle.jpg'
);

-- Bevvy released this shot under CC BY-SA and asks for a link to their page.
UPDATE "public"."images"
SET "credit" = 'Will Shenton, Bevvy / CC BY-SA 3.0',
    "source_url" = 'https://bevvy.co/articles/vermouth-101'
WHERE "source_url" = 'https://commons.wikimedia.org/wiki/File:Vermouth_Bottles.jpg';

-- Dropping those recipe lines can leave an ingredient with one parent, which
-- the generics backfill would fill on a re-run. Do it here so that re-run
-- still changes nothing, and production matches a fresh database.
UPDATE "public"."items" i SET "generic_id" = p.parent_id
FROM (
    SELECT r.ingredient_item_id, min(r.parent_ingredient_id::text)::uuid AS parent_id
    FROM "public"."recipes" r
    WHERE r.parent_ingredient_id IS NOT NULL
    GROUP BY r.ingredient_item_id
    HAVING count(DISTINCT r.parent_ingredient_id) = 1
) p
WHERE i.id = p.ingredient_item_id AND i.item_type = 'ingredient' AND i.generic_id IS NULL AND p.parent_id <> i.id;
