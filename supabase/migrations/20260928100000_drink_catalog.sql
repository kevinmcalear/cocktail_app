-- The drink catalog: one shared Martini, Negroni, Penicillin… that every bar's
-- version links to (items.riff_of_id), so "best Martini in New York" compares
-- every bar's martini in one list.
--
--   items.is_catalog  true for the shared classics. Only catalog admins (or SQL
--                     and the service role) can set or clear it, and catalog
--                     rows have no bar. Existing RLS already keeps them
--                     read-only for everyone else: a no-bar row with no
--                     creator is writable only by app admins.
--
-- The rows below are names only. Specs, glassware and credit can be filled in
-- later by catalog admins; bars keep their own specs on their own versions.

ALTER TABLE "public"."items"
    ADD COLUMN "is_catalog" boolean DEFAULT false NOT NULL,
    ADD CONSTRAINT "items_catalog_is_shared" CHECK (NOT "is_catalog" OR "bar_id" IS NULL);

-- One catalog entry per name.
CREATE UNIQUE INDEX "items_catalog_name_key" ON "public"."items" (lower("name")) WHERE "is_catalog";

CREATE FUNCTION "private"."guard_item_catalog"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Service role and SQL run without a user; catalog admins curate.
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    IF (TG_OP = 'INSERT' AND NEW.is_catalog) OR (TG_OP = 'UPDATE' AND NEW.is_catalog IS DISTINCT FROM OLD.is_catalog) THEN
        RAISE EXCEPTION 'Only catalog admins can change the drink catalog.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_item_catalog" BEFORE INSERT OR UPDATE OF "is_catalog" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_catalog"();

-- Seed the classics. The image worker flag stops these inserts queueing
-- automatic sketches (they'd have no one to bill anyway).
SET "app.image_worker" = 'on';

INSERT INTO "public"."items" ("name", "item_type", "origin", "is_catalog")
SELECT "name", 'cocktail', "origin", true
FROM (VALUES
    ('Martini', 'Classic'), ('Negroni', 'Classic'), ('Old Fashioned', 'Classic'), ('Manhattan', 'Classic'),
    ('Daiquiri', 'Classic'), ('Margarita', 'Classic'), ('Sazerac', 'Classic'), ('Martinez', 'Classic'),
    ('Boulevardier', 'Classic'), ('Americano', 'Classic'), ('Aviation', 'Classic'), ('Last Word', 'Classic'),
    ('Sidecar', 'Classic'), ('Whiskey Sour', 'Classic'), ('Pisco Sour', 'Classic'), ('Tom Collins', 'Classic'),
    ('Gimlet', 'Classic'), ('French 75', 'Classic'), ('Corpse Reviver #2', 'Classic'), ('Vieux Carré', 'Classic'),
    ('Hanky Panky', 'Classic'), ('Bee''s Knees', 'Classic'), ('Mojito', 'Classic'), ('Mai Tai', 'Classic'),
    ('Moscow Mule', 'Classic'), ('Paloma', 'Classic'), ('Vesper', 'Classic'), ('Rob Roy', 'Classic'),
    ('Brooklyn', 'Classic'), ('Clover Club', 'Classic'), ('Ramos Gin Fizz', 'Classic'), ('Bamboo', 'Classic'),
    ('Jack Rose', 'Classic'), ('Mint Julep', 'Classic'), ('Pegu Club', 'Classic'), ('Bloody Mary', 'Classic'),
    ('Piña Colada', 'Classic'), ('Sbagliato', 'Classic'), ('Aperol Spritz', 'Classic'), ('White Lady', 'Classic'),
    ('El Diablo', 'Classic'), ('Bellini', 'Classic'), ('Stinger', 'Classic'), ('Ti'' Punch', 'Classic'),
    ('Caipirinha', 'Classic'), ('Brandy Crusta', 'Classic'), ('Remember the Maine', 'Classic'), ('Bobby Burns', 'Classic'),
    ('New York Sour', 'Classic'), ('Hemingway Daiquiri', 'Classic'), ('Tuxedo', 'Classic'), ('Alaska', 'Classic'),
    ('Bijou', 'Classic'), ('Milano Torino', 'Classic'), ('Pompier', 'Classic'), ('Jungle Bird', 'Classic'),
    ('Espresso Martini', 'Modern Classic'), ('Penicillin', 'Modern Classic'), ('Paper Plane', 'Modern Classic'),
    ('Naked and Famous', 'Modern Classic'), ('Oaxaca Old Fashioned', 'Modern Classic'), ('Gold Rush', 'Modern Classic'),
    ('Tommy''s Margarita', 'Modern Classic'), ('Bramble', 'Modern Classic'), ('Trinidad Sour', 'Modern Classic'),
    ('Red Hook', 'Modern Classic'), ('Little Italy', 'Modern Classic'), ('White Negroni', 'Modern Classic'),
    ('Cosmopolitan', 'Modern Classic'), ('Lemon Drop', 'Modern Classic'), ('Bitter Mai Tai', 'Modern Classic'),
    ('Porn Star Martini', 'Modern Classic'), ('Division Bell', 'Modern Classic'), ('Fitzgerald', 'Modern Classic')
) AS "classics" ("name", "origin")
ON CONFLICT (lower("name")) WHERE "is_catalog" DO NOTHING;

RESET "app.image_worker";
