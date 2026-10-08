-- Where a drink came from: the old cocktail books, and the printed recipes in
-- them, tied to the drinks here.
--
--   sources               a book (or, for modern classics, a well-sourced web
--                         page or bar), with where to read it: the EUVS
--                         library page and a cleaner public-domain copy
--                         (Internet Archive, HathiTrust, Gutenberg).
--   source_recipes        a recipe as printed, tied to the catalog drink it's
--                         an early version of: first in print, a later
--                         version, or an ancestor (the Whiskey Cocktail of
--                         1862 is the Old Fashioned's). The page and a link
--                         to it where we have one.
--   source_recipe_lines   its ingredients as printed ("2 dashes"), in ml where
--                         that's clear, and the shared ingredient each means.
--
-- Copyright: recipes are facts. Wording is only kept (quote) from books in
-- the public domain, which a check enforces: a quote needs a source marked
-- public_domain. The Savoy (1930) is public domain in the US but not in the
-- UK and EU until 2034, so it is facts only.
--
-- Everyone can read these; only app admins edit them. Book recipes also
-- count in the pairing graph as their own era ('books'), so the flavor map
-- can show what the old back bar put together.

CREATE TABLE "public"."sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "key" "text" NOT NULL UNIQUE,
    "kind" "text" NOT NULL CHECK ("kind" IN ('book', 'web', 'bar')),
    "title" "text" NOT NULL,
    "author" "text",
    "year" integer CHECK ("year" BETWEEN 1600 AND 2100),
    "edition" "text",
    "city" "text",
    "rights" "text" NOT NULL CHECK ("rights" IN ('public_domain', 'facts_only')),
    "euvs_url" "text" CHECK ("euvs_url" IS NULL OR "euvs_url" ~ '^https://'),
    "archive_url" "text" CHECK ("archive_url" IS NULL OR "archive_url" ~ '^https://'),
    "url" "text" CHECK ("url" IS NULL OR "url" ~ '^https://'),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE "public"."source_recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "source_id" "uuid" NOT NULL REFERENCES "public"."sources"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "printed_name" "text",
    "page_label" "text",
    "page_url" "text" CHECK ("page_url" IS NULL OR "page_url" ~ '^https://'),
    "relation" "text" NOT NULL CHECK ("relation" IN ('first_print', 'version', 'ancestor')),
    "method" "text",
    "quote" "text" CHECK ("quote" IS NULL OR length("quote") <= 600),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE INDEX "source_recipes_item_idx" ON "public"."source_recipes" ("item_id");
CREATE INDEX "source_recipes_source_idx" ON "public"."source_recipes" ("source_id");

CREATE TABLE "public"."source_recipe_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "source_recipe_id" "uuid" NOT NULL REFERENCES "public"."source_recipes"("id") ON DELETE CASCADE,
    "sort_order" integer NOT NULL DEFAULT 0,
    "ingredient_text" "text" NOT NULL,
    "ingredient_item_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    "amount_text" "text",
    "amount_ml" numeric CHECK ("amount_ml" IS NULL OR "amount_ml" >= 0),
    "note" "text"
);
CREATE INDEX "source_recipe_lines_recipe_idx" ON "public"."source_recipe_lines" ("source_recipe_id");
CREATE INDEX "source_recipe_lines_ingredient_idx" ON "public"."source_recipe_lines" ("ingredient_item_id");

COMMENT ON COLUMN "public"."source_recipes"."quote" IS
    'The recipe as printed, word for word. Only for sources in the public domain (checked by guard_source_quote).';

-- Wording only from the public domain.
CREATE FUNCTION "private"."guard_source_quote"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.quote IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.sources s WHERE s.id = NEW.source_id AND s.rights = 'public_domain'
    ) THEN
        RAISE EXCEPTION 'Only quote books in the public domain. Keep the ingredients and say the method in your own words.'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_source_quote"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_source_quote" BEFORE INSERT OR UPDATE OF "quote", "source_id" ON "public"."source_recipes"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_source_quote"();

-- A source that stops being public domain loses its quotes' basis: refuse it while quotes remain.
CREATE FUNCTION "private"."guard_source_rights"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.rights <> 'public_domain' AND EXISTS (SELECT 1 FROM public.source_recipes r WHERE r.source_id = NEW.id AND r.quote IS NOT NULL) THEN
        RAISE EXCEPTION 'Remove the quotes from this source first.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_source_rights"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_source_rights" BEFORE UPDATE OF "rights" ON "public"."sources"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_source_rights"();

ALTER TABLE "public"."sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."source_recipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."source_recipe_lines" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads sources" ON "public"."sources" FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "App admins manage sources" ON "public"."sources" FOR ALL TO "authenticated"
    USING ("private"."is_app_admin"()) WITH CHECK ("private"."is_app_admin"());
CREATE POLICY "Anyone reads printed recipes" ON "public"."source_recipes" FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "App admins manage printed recipes" ON "public"."source_recipes" FOR ALL TO "authenticated"
    USING ("private"."is_app_admin"()) WITH CHECK ("private"."is_app_admin"());
CREATE POLICY "Anyone reads printed lines" ON "public"."source_recipe_lines" FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "App admins manage printed lines" ON "public"."source_recipe_lines" FOR ALL TO "authenticated"
    USING ("private"."is_app_admin"()) WITH CHECK ("private"."is_app_admin"());

GRANT SELECT ON TABLE "public"."sources", "public"."source_recipes", "public"."source_recipe_lines" TO "anon", "authenticated";
GRANT INSERT, UPDATE, DELETE ON TABLE "public"."sources", "public"."source_recipes", "public"."source_recipe_lines" TO "authenticated";

-- A printed recipe is only ever tied to a catalog drink (they're shared and public).
CREATE FUNCTION "private"."guard_source_recipe_item"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.items i WHERE i.id = NEW.item_id AND i.is_catalog) THEN
        RAISE EXCEPTION 'Tie a printed recipe to a catalog drink.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_source_recipe_item"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_source_recipe_item" BEFORE INSERT OR UPDATE OF "item_id" ON "public"."source_recipes"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_source_recipe_item"();

-- ---------------------------------------------------------------------------
-- The old books in the pairing graph
-- ---------------------------------------------------------------------------

-- Same as 20261008110000, plus the 'books' era: each printed recipe in a book
-- is one "drink", its lines counted at their core ingredients.
CREATE OR REPLACE FUNCTION "private"."refresh_ingredient_pairs"() RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    DROP TABLE IF EXISTS pg_temp.pair_lines;
    CREATE TEMP TABLE pair_lines AS SELECT * FROM private.open_drink_cores();
    PERFORM private.write_ingredient_pairs('now');
    DROP TABLE pg_temp.pair_lines;

    CREATE TEMP TABLE pair_lines AS
    SELECT DISTINCT r.id AS drink_id, m.core_id
      FROM public.source_recipes r
      JOIN public.sources s ON s.id = r.source_id AND s.kind = 'book'
      JOIN public.source_recipe_lines l ON l.source_recipe_id = r.id
      JOIN private.core_ingredient_map() m ON m.id = l.ingredient_item_id;
    PERFORM private.write_ingredient_pairs('books');
    DROP TABLE pg_temp.pair_lines;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."refresh_ingredient_pairs"() FROM PUBLIC, "anon", "authenticated";

-- ---------------------------------------------------------------------------
-- The first batch: the earliest printing we could read for 69 of the 74
-- catalog classics, and the versions after it that changed something.
-- Transcribed from Project Gutenberg, the Internet Archive and HathiTrust
-- copies and checked against the EUVS page images; quotes only from books
-- in the public domain (published 1930 or earlier, Savoy excepted).
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE "src_in" ("key" text, "kind" text, "title" text, "author" text, "year" integer, "edition" text, "city" text, "rights" text, "euvs_url" text, "archive_url" text, "url" text);
CREATE TEMP TABLE "recipe_in" ("key" text, "source" text, "drink" text, "printed_name" text, "page_label" text, "page_url" text, "relation" text, "method" text, "quote" text, "notes" text);
CREATE TEMP TABLE "line_in" ("recipe" text, "position" integer, "ingredient" text, "resolve_as" text, "amount_text" text, "ml" numeric, "note" text);

INSERT INTO "src_in" VALUES
    ('thomas-1862', 'book', 'How to Mix Drinks, or The Bon-Vivant''s Companion (Bar-Tender''s Guide)', 'Jerry Thomas', 1862, '1st', 'New York', 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1862-Bar-Tender-s-Guide-price-1-50-by-Jerry-Thomas/', 'https://archive.org/details/howtomixdrinkso00schugoog', NULL),
    ('thomas-1876', 'book', 'The Bar-Tender''s Guide; or, How to Mix All Kinds of Plain and Fancy Drinks (revised, with appendix)', 'Jerry Thomas', 1876, NULL, 'New York', 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1876-Jerry-Thoma-s-Bar-Tender-s-Guide-or-How-to-Mix-Drinks-Soft-Cover/', NULL, NULL),
    ('johnson-1882', 'book', 'New and Improved Bartender''s Manual', 'Harry Johnson', 1882, '1st', NULL, 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1882-Harry-Johnson-s-new-and-improved-bartender-s-manual-1882/', NULL, NULL),
    ('byron-1884', 'book', 'The Modern Bartenders'' Guide', 'O. H. Byron', 1884, NULL, NULL, 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1884-The-Modern-Bartenders-Guide-by-O-H-Byron/', NULL, NULL),
    ('thomas-1887', 'book', 'The Bar-Tender''s Guide; or, How to Mix All Kinds of Plain and Fancy Drinks', 'Jerry Thomas', 1887, NULL, 'New York', 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1887-The-bar-tender-s-guide/', 'https://archive.org/details/bartendersguideo00thom', NULL),
    ('johnson-1888', 'book', 'New and Improved Bartender''s Manual', 'Harry Johnson', 1888, NULL, NULL, 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1888-Harry-Johnson-s-new-and-improved-bartender-s-manual-1888/', NULL, NULL),
    ('kappeler-1895', 'book', 'Modern American Drinks', 'George J. Kappeler', 1895, NULL, NULL, 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1895-Modern-American-drinks-how-to-mix-and-serve-all-kinds-of-cups-and-drinks-1895/', 'https://archive.org/details/modernamericandr00kapp', NULL),
    ('johnson-1900', 'book', 'New and Improved Bartenders'' Manual', 'Harry Johnson', 1900, NULL, NULL, 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1900-Harry-Johnson-s-New-and-Improved-Bartenders-Manual1/', NULL, NULL),
    ('stuart-1904', 'book', 'Stuart''s Fancy Drinks and How to Mix Them', 'Thomas Stuart', 1904, NULL, 'New York', 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1904-Stuart-s-Fancy-Drinks-and-How-To-Mix-Them/', 'https://archive.org/details/stuartsfancydrin00stua', NULL),
    ('boothby-1908', 'book', 'The World''s Drinks and How to Mix Them', 'William T. Boothby', 1908, '1st', 'San Francisco', 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1908-The-World-s-Drinks-and-How-to-Miw-Them-by-Hon-Wm-Boothby-1st-edition/', NULL, NULL),
    ('grohusko-1908', 'book', 'Jack''s Manual', 'J. A. Grohusko', 1908, '1st', NULL, 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1908-Jack-s-Manual-by-J-A-Grohusko/', NULL, NULL),
    ('straub-1913', 'book', 'Straub''s Manual of Mixed Drinks', 'Jacques Straub', 1913, NULL, 'Chicago', 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1913-Straub-s-Manual-of-Mixed-Drinks/', 'https://hdl.handle.net/2027/uc1.31175035242364', NULL),
    ('ensslin-1917', 'book', 'Recipes for Mixed Drinks', 'Hugo R. Ensslin', 1917, '2nd', NULL, 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1917-Recipes-for-Mixed-Drinks-by-Hugo-R-Ensslin-second-edition/', NULL, NULL),
    ('bullock-1917', 'book', 'The Ideal Bartender', 'Tom Bullock', 1917, NULL, NULL, 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1917-The-Ideal-Bartender-by-Tom-Bullock/', 'https://www.gutenberg.org/ebooks/13487', NULL),
    ('mcelhone-1923', 'book', '"Harry" of Ciro''s ABC of Mixing Cocktails', 'Harry MacElhone', 1923, '2nd impression', 'London', 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1923-Harry-of-Ciro-s-ABC-of-mixing-cocktails-second-impression/', NULL, NULL),
    ('judgejr-1927', 'book', 'Here''s How', 'Judge Jr.', 1927, '2nd impression', NULL, 'public_domain', 'https://euvs-vintage-cocktail-books.cld.bz/1927-Here-s-How-2nd-impression/', NULL, NULL),
    ('mcelhone-1927', 'book', 'Barflies and Cocktails', 'Harry MacElhone', 1927, NULL, 'Paris', 'public_domain', NULL, 'https://archive.org/details/mc-elhone-harry-barflies-and-cocktails-1927', NULL),
    ('vermeire-1930', 'book', 'Cocktails: How to Mix Them', 'Robert Vermeire ("Robert")', 1930, 'undated printing; archive.org catalogues it as 1930, recipe notes inside date to 1922', 'London', 'public_domain', NULL, 'https://archive.org/details/cocktails_202208', NULL),
    ('savoy-1930', 'book', 'The Savoy Cocktail Book', 'Harry Craddock', 1930, '1st', 'London', 'facts_only', 'https://euvs-vintage-cocktail-books.cld.bz/1930-The-Savoy-Cocktail-Book/', NULL, NULL),
    ('sloppyjoes-1932', 'book', 'Sloppy Joe''s Cocktails Manual (Season 1931-32)', 'Sloppy Joe''s Bar', 1932, NULL, 'Havana', 'facts_only', 'https://euvs-vintage-cocktail-books.cld.bz/1932-Sloppy-Joe-s/', NULL, NULL),
    ('arthur-1937', 'book', 'Famous New Orleans Drinks and How to Mix ''Em', 'Stanley Clisby Arthur', 1937, '3rd printing (1938) read', 'New Orleans', 'facts_only', 'https://euvs-vintage-cocktail-books.cld.bz/1938-Famous-New-Orleans-Drinks-and-how-to-mix-em-3rd-printing-by-Stanley-Clisby-Arthur/', NULL, NULL),
    ('baker-1939', 'book', 'The Gentleman''s Companion, Volume II: Being an Exotic Drinking Book', 'Charles H. Baker Jr.', 1939, NULL, NULL, 'facts_only', 'https://euvs-vintage-cocktail-books.cld.bz/1939-The-Gentleman-s-Companion-volume-II-Beeing-an-Exotic-Drinking-Book/', NULL, NULL),
    ('floridita-1939', 'book', 'Floridita Cocktails', 'Constante Ribalaigua (Bar La Florida)', 1939, NULL, 'Havana', 'facts_only', 'https://euvs-vintage-cocktail-books.cld.bz/1939-Floridita-Cock-tails/', NULL, NULL),
    ('wiki-americano', 'web', 'Wikipedia: Americano (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Americano_(cocktail)'),
    ('wiki-negroni', 'web', 'Wikipedia: Negroni', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Negroni'),
    ('wiki-bellini', 'web', 'Wikipedia: Bellini (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Bellini_(cocktail)'),
    ('wiki-bloody-mary', 'web', 'Wikipedia: Bloody Mary (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Bloody_Mary_(cocktail)'),
    ('wiki-bramble', 'web', 'Wikipedia: Bramble (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Bramble_(cocktail)'),
    ('wiki-cosmopolitan', 'web', 'Wikipedia: Cosmopolitan (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Cosmopolitan_(cocktail)'),
    ('wiki-espresso-martini', 'web', 'Wikipedia: Espresso martini', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Espresso_martini'),
    ('wiki-jungle-bird', 'web', 'Wikipedia: Jungle Bird', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Jungle_Bird'),
    ('wiki-last-word', 'web', 'Wikipedia: Last Word (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Last_Word_(cocktail)'),
    ('wiki-lemon-drop', 'web', 'Wikipedia: Lemon drop (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Lemon_drop_(cocktail)'),
    ('wiki-mai-tai', 'web', 'Wikipedia: Mai Tai', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Mai_Tai'),
    ('wiki-margarita', 'web', 'Wikipedia: Margarita', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Margarita'),
    ('wiki-moscow-mule', 'web', 'Wikipedia: Moscow mule', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Moscow_mule'),
    ('wiki-naked-and-famous', 'web', 'Wikipedia: Naked and famous (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Naked_and_famous_(cocktail)'),
    ('wiki-paper-plane', 'web', 'Wikipedia: Paper plane (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Paper_plane_(cocktail)'),
    ('wiki-penicillin', 'web', 'Wikipedia: Penicillin (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Penicillin_(cocktail)'),
    ('wiki-pina-colada', 'web', 'Wikipedia: Pina colada', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Pi%C3%B1a_colada'),
    ('wiki-pisco-sour', 'web', 'Wikipedia: Pisco sour', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Pisco_sour'),
    ('wiki-porn-star-martini', 'web', 'Wikipedia: Porn star martini', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Porn_star_martini'),
    ('wiki-tommys-margarita', 'web', 'Wikipedia: Tommy''s margarita', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Tommy%27s_margarita'),
    ('wiki-trinidad-sour', 'web', 'Wikipedia: Trinidad sour', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Trinidad_sour'),
    ('wiki-vesper', 'web', 'Wikipedia: Vesper (cocktail)', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://en.wikipedia.org/wiki/Vesper_(cocktail)'),
    ('web-gold-rush', 'web', 'Punch: how the Gold Rush became a modern classic', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://punchdrink.com/articles/gold-rush-bourbon-cocktail-recipe-became-modern-classic/'),
    ('web-red-hook', 'web', 'Punch: Red Hook', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://punchdrink.com/recipes/red-hook/'),
    ('web-little-italy', 'web', 'Difford''s Guide: Little Italy', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/2819/little-italy'),
    ('web-division-bell', 'web', 'Difford''s Guide: Division Bell', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://www.diffordsguide.com/en-au/cocktails/recipe/3634/division-bell'),
    ('web-bitter-mai-tai', 'web', 'Punch: Bitter Mai Tai', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://punchdrink.com/recipes/bitter-mai-tai/'),
    ('web-oaxaca-old-fashioned', 'web', 'Difford''s Guide: Oaxacan Old Fashioned', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/3003/oaxacan-old-fashioned'),
    ('web-white-negroni', 'web', 'Punch: how the White Negroni became a modern classic', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://punchdrink.com/articles/white-negroni-became-modern-classic-suze-cocktail-recipe/'),
    ('web-el-diablo', 'web', 'Alcademics: History of the El Diablo cocktail in Trader Vic''s books', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://alcademics.com/history-of-the-el-diablo-cocktail-in-trader-vics-books/'),
    ('web-fitzgerald', 'web', 'Difford''s Guide: Fitzgerald', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/2408/fitzgerald'),
    ('web-aperol-spritz', 'web', 'Paste: Happy Hour History, the Aperol Spritz', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://www.pastemagazine.com/drink/happy-hour-history-the-aperol-spritz'),
    ('web-sbagliato', 'web', 'Bloomberg Linea: the origin of the Negroni Sbagliato', NULL, NULL, NULL, NULL, 'facts_only', NULL, NULL, 'https://www.bloomberglinea.com/2022/10/29/esta-es-la-verdadera-historia-del-origen-de-negroni-sbagliato/');

INSERT INTO "recipe_in" VALUES
    ('r000', 'thomas-1862', 'Brandy Crusta', 'Brandy Crusta', '52', 'https://euvs-vintage-cocktail-books.cld.bz/1862-Bar-Tender-s-Guide-price-1-50-by-Jerry-Thomas/52/', 'first_print', 'Mix in a small tumbler with a small lump of ice, then strain into a fancy red wine-glass with a sugared rim lined with a whole spiral of lemon peel.', 'Crusta is made the same as a fancy cocktail, with a little lemon juice and a small lump of ice added. First, mix the ingredients in a small tumbler, then take a fancy red wine-glass, rub a sliced lemon around the rim of the same, and dip it in pulverized white sugar, so that the sugar will adhere to the edge of the glass.', 'Recipe No. 116. The crusta text only says ''made the same as a fancy cocktail'', so the spirit, syrup, bitters and curacao are taken from the Brandy Cocktail (No. 107, p. 50) and Fancy Brandy Cocktail (No. 108). Today''s versions add more lemon and orange liqueur and often maraschino. wine-glass = 60 ml.'),
    ('r001', 'thomas-1862', 'Old Fashioned', 'Whiskey Cocktail', '50', 'https://euvs-vintage-cocktail-books.cld.bz/1862-Bar-Tender-s-Guide-price-1-50-by-Jerry-Thomas/50/', 'ancestor', 'Shake with fine ice and strain into a fancy red wine-glass.', '3 or 4 dashes of gum syrup. 2 do. bitters (Bogart''s). 1 wine-glass of whiskey, and a piece of lemon peel. Fill one-third full of fine ice; shake and strain in a fancy red wine-glass.', 'Recipe No. 109, the plain whiskey cocktail of spirit, sugar, bitters and peel that the Old Fashioned later named. It is shaken and served up, not built over ice. wine-glass = 60 ml.'),
    ('r002', 'kappeler-1895', 'Old Fashioned', 'Old-Fashioned Whiskey Cocktail', '43', 'https://euvs-vintage-cocktail-books.cld.bz/1895-Modern-American-drinks-how-to-mix-and-serve-all-kinds-of-cups-and-drinks-1895/43/', 'first_print', 'Dissolve the sugar in a little water in a whiskey glass, add bitters, ice, peel and whiskey, stir with a small bar spoon and serve with the spoon left in.', 'Dissolve a small lump of sugar with a little water in a whiskey-glass; add two dashes Angostura bitters, a small piece ice, a piece lemon-peel, one jigger whiskey. Mix with small bar-spoon and serve, leaving spoon in the glass.', 'Earliest recipe we found printed under the Old-Fashioned name. The same book also gives Old-Fashioned Holland Gin, Tom Gin and Brandy versions. jigger = 45 ml (pre-1900 jiggers varied).'),
    ('r003', 'bullock-1917', 'Old Fashioned', 'Old Fashion Cocktail', NULL, NULL, 'version', 'Build in a toddy glass over one lump of ice, twist lemon peel over and drop it in, stir.', 'Use a Toddy glass. 1 lump of Ice. 2 dashes of Angostura Bitters. 1 lump of Sugar and dissolve in Water. 1-1/2 jiggers of Bourbon Whiskey. Twist piece of Lemon Skin over the drink and drop it in. Stir well and serve.', 'Names bourbon and raises the pour to a jigger and a half, close to today''s build. Read from the Project Gutenberg text, which has no page numbers. jigger = 45 ml.'),
    ('r004', 'byron-1884', 'Manhattan', 'Manhattan Cocktail, No. 2', '21', 'https://euvs-vintage-cocktail-books.cld.bz/1884-The-Modern-Bartenders-Guide-by-O-H-Byron/21/', 'first_print', 'Stir with fine ice and strain into a cocktail glass.', 'Manhattan Cocktail, No. 2. 2 dashes Curacoa. 2 " Angostura bitters. 1/2 wine-glass whisky. 1/2 " Italian vermouth. Fine ice; stir well and strain into a cocktail glass.', 'Byron prints two Manhattans on the same page. No. 1 is 1 pony French vermouth, 1/2 pony whisky, 3 or 4 dashes Angostura and 3 dashes gum syrup (fractions checked against the page image; the OCR misreads them). George Winter''s How to Mix Drinks (1884, p. 52) gives a Manhattan with Peruvian bitters, gum syrup and half whiskey, half vermouth in the same year. Equal parts with curacao here; modern is 2:1 whiskey to vermouth with no curacao. wine-glass = 60 ml.'),
    ('r005', 'thomas-1887', 'Manhattan', 'Manhattan Cocktail', '24', 'https://euvs-vintage-cocktail-books.cld.bz/1887-The-bar-tender-s-guide/24/', 'version', 'Shake with two small lumps of ice, strain into a claret glass and add a quarter slice of lemon.', 'Take 2 dashes of Curacoa or Maraschino. 1 pony of rye whiskey. 1 wine-glass of vermouth. 3 dashes of Boker''s bitters. 2 small lumps of ice. Shake up well, and strain into a claret glass. Put a quarter of a slice of lemon in the glass and serve.', 'Names rye, but is vermouth-heavy (2 parts vermouth to 1 whiskey) and shaken. wine-glass = 60 ml; pony = 30 ml.'),
    ('r006', 'kappeler-1895', 'Manhattan', 'Manhattan Cocktail', '38', 'https://euvs-vintage-cocktail-books.cld.bz/1895-Modern-American-drinks-how-to-mix-and-serve-all-kinds-of-cups-and-drinks-1895/38/', 'version', 'Stir in a mixing glass half full of fine ice, strain into a cocktail glass, add lemon peel or a cherry.', 'Fill mixing-glass half-full fine ice, add two dashes gum-syrup, two dashes Peyschaud or Angostura bitters, one half-jigger Italian vermouth, one-half jigger whiskey. Mix, strain into cocktail-glass. Add a piece of lemon-peel or a cherry.', 'Drops the curacao and offers the cherry garnish. Same page also lists a Dry Manhattan (no syrup or cherry) and an Extra Dry one with French vermouth. jigger = 45 ml (pre-1900 jiggers varied).'),
    ('r007', 'byron-1884', 'Martinez', 'Martinez Cocktail', '21', 'https://euvs-vintage-cocktail-books.cld.bz/1884-The-Modern-Bartenders-Guide-by-O-H-Byron/21/', 'first_print', 'Make as the Manhattan, with gin in place of whisky.', 'Same as Manhattan, only you substitute gin for whisky.', 'Earliest printing we found. It points back to the two Manhattans on the same page, so read with No. 2 it is 1/2 wine-glass gin, 1/2 wine-glass Italian vermouth, 2 dashes curacao and 2 dashes Angostura.'),
    ('r008', 'thomas-1887', 'Martinez', 'Martinez Cocktail', '25', 'https://euvs-vintage-cocktail-books.cld.bz/1887-The-bar-tender-s-guide/25/', 'version', 'Shake with two small lumps of ice, strain into a large cocktail glass, add a quarter slice of lemon.', 'Take 1 dash of Boker''s bitters. 2 dashes of Maraschino. 1 pony of Old Tom gin. 1 wine-glass of Vermouth. 2 small lumps of ice. Shake up thoroughly, and strain into a large cocktail glass. Put a quarter of a slice of lemon in the glass, and serve.', 'The well-known Thomas recipe: Old Tom gin and maraschino, with twice as much vermouth as gin. Modern versions usually even out or reverse the ratio. wine-glass = 60 ml; pony = 30 ml.'),
    ('r009', 'johnson-1888', 'Martini', 'Martini Cocktail', '38-39', 'https://euvs-vintage-cocktail-books.cld.bz/1888-Harry-Johnson-s-new-and-improved-bartender-s-manual-1888/48/', 'first_print', 'Stir with ice, strain into a fancy cocktail glass, squeeze lemon peel on top.', 'Fill the glass up with ice; 2 or 3 dashes of Gum Syrup; 2 or 3 dashes of Bitters; (Boker''s genuine only.) 1 dash of Curacoa; 1/2 wine glassful of Old Tom Gin; 1/2 " " " Vermouth; stir up well with a spoon, strain it into a fancy cocktail glass, squeeze a piece of lemon peel on top and serve.', 'Recipe No. 57. Earliest printing under the Martini name we found. Sweet: Old Tom gin, unspecified (sweet) vermouth, syrup and curacao. EUVS page index is printed page plus 10. wine-glass = 60 ml.'),
    ('r010', 'kappeler-1895', 'Martini', 'Martini Cocktail', '38', 'https://euvs-vintage-cocktail-books.cld.bz/1895-Modern-American-drinks-how-to-mix-and-serve-all-kinds-of-cups-and-drinks-1895/38/', 'version', 'Stir with fine ice, strain into a cocktail glass, cherry if wanted.', 'Half a mixing-glass full fine ice, three dashes orange bitters, one-half jigger Tom gin, one-half jigger Italian vermouth, a piece lemon-peel. Mix, strain into cocktail-glass. Add a maraschino cherry, if desired by customer.', 'Orange bitters replace Boker''s, and the syrup and curacao are gone. jigger = 45 ml (pre-1900 jiggers varied).'),
    ('r011', 'ensslin-1917', 'Martini', 'Martini Cocktail (Dry)', '21', NULL, 'version', 'Stir with ice, strain, olive in the glass.', '2/3 Dry Gin 1/3 French Vermouth 1 dash Orange Bitters Stir well in a mixing glass with ice, strain and serve, with olive in glass.', 'The dry martini: dry gin and French vermouth at 2:1 with an olive. The same page still prints a Sweet Martini (2/3 Tom gin, 1/3 Italian vermouth, gum syrup). EUVS has no text layer for this book, so the page link is not given; the printed page is 21. fractions assume a 90 ml drink.'),
    ('r012', 'boothby-1908', 'Sazerac', 'Sazerac Cocktail (a la Armand Regnier, New Orleans)', '29', 'https://euvs-vintage-cocktail-books.cld.bz/1908-The-World-s-Drinks-and-How-to-Miw-Them-by-Hon-Wm-Boothby-1st-edition/31/', 'first_print', 'Stir with cracked ice, strain into a stem cocktail glass rinsed with absinthe, squeeze lemon peel over, serve with ice water on the side.', 'Into a mixing-glass full of cracked ice place about a small barspoonful of gum syrup, three drops of Selner bitters and a jigger of Sazerac brandy; stir well, strain into a stem cocktail-glass which has been rinsed out with a dash of absinthe, squeeze a piece of lemon peel over the top and serve with ice water on the side.', 'Recipe No. 63, earliest printed Sazerac recipe we found. Brandy base, not rye. Book copyright 1907, 1st edition 1908. EUVS page index is printed page plus 2. jigger = 45 ml.'),
    ('r013', 'ensslin-1917', 'Sazerac', 'Sazerac Cocktail', '31', NULL, 'version', 'Stir with cracked ice, strain into a second chilled glass, add a dash of absinthe and squeeze lemon peel on top.', 'Dissolve 1 lump of Sugar in a teaspoonful of water 1 dash Peychaud Bitters 1 jigger of Rye Whiskey Stir well in a mixing glass with cracked ice, strain into another glass which has been cooled, add a dash of Absinthe and squeeze a piece of lemon peel on top.', 'Rye replaces brandy and Peychaud''s is named; the two-glass method is already here. Checked against the page image. jigger = 45 ml.'),
    ('r014', 'arthur-1937', 'Sazerac', 'Sazerac', '19', 'https://euvs-vintage-cocktail-books.cld.bz/1938-Famous-New-Orleans-Drinks-and-how-to-mix-em-3rd-printing-by-Stanley-Clisby-Arthur/19/', 'version', 'Muddle moistened sugar in one glass, add both bitters and rye, stir with ice; rinse a second chilled glass with absinthe, strain in, twist peel over and discard.', NULL, 'Adds Angostura alongside Peychaud''s and insists the peel not go in the drink. The book tells the brandy-to-rye story on pp. 17-19. First printed 1937; we read the 1938 3rd printing. Facts only (in copyright).'),
    ('r015', 'thomas-1862', 'Mint Julep', 'Mint Julep', '44', 'https://euvs-vintage-cocktail-books.cld.bz/1862-Bar-Tender-s-Guide-price-1-50-by-Jerry-Thomas/44/', 'first_print', 'Press mint in sugar and water, add brandy, fill with shaved ice, re-plant the mint sprigs as a bouquet, garnish with berries and orange, dash with Jamaica rum and sprinkle sugar on top. Serve with a straw.', '1 table-spoonful of white pulverized sugar. 2 1/2 do. water, mix well with a spoon. Take three or four sprigs of fresh mint, and press them well in the sugar and water, until the flavor of the mint is extracted; add one and a half wine-glass of Cognac brandy, and fill the glass with fine shaved ice', 'Recipe No. 88. The 1862 julep is a Cognac drink; Thomas adds a Whiskey Julep (No. 91, ''the same as the mint julep, omitting all fruits and berries''), which is the bourbon julep''s direct ancestor. The 2 1/2 is read from a faint fraction in the scan. wine-glass = 60 ml.'),
    ('r016', 'thomas-1862', 'Whiskey Sour', 'Brandy Sour / Gin Sour', '59', 'https://euvs-vintage-cocktail-books.cld.bz/1862-Bar-Tender-s-Guide-price-1-50-by-Jerry-Thomas/59/', 'ancestor', 'Made like the Fix (stirred over shaved ice) but without fruit except the lemon, whose juice is pressed into the glass.', 'The brandy sour is made with the same ingredients as the brandy fix, omitting all fruits except a small piece of lemon, the juice of which must be pressed in the glass.', 'Recipes Nos. 142-143. There is no whiskey sour by name in the 1862 book; brandy, gin and Santa Cruz rum sours are given. wine-glass = 60 ml.'),
    ('r017', 'johnson-1882', 'Whiskey Sour', 'Whiskey Sour', '49-50', 'https://euvs-vintage-cocktail-books.cld.bz/1882-Harry-Johnson-s-new-and-improved-bartender-s-manual-1882/49/', 'first_print', 'Dissolve sugar and lemon with a squirt of seltzer, add ice and whiskey, stir, strain into a sour glass and add fruit.', 'One-half table-spoon of sugar; 3 or 4 dashes of lemon juice; 1 squirt of Syphon Selters water, and dissolve well the sugar and lemon with a spoon: Fill the glass with ice; 1 wine glass of whiskey; stir up well, strain it into a sour glass; place your fruit into it, and serve.', 'Recipe No. 114, earliest whiskey sour by name we found. Very little lemon (a few dashes) next to modern 3/4 oz; stirred, not shaken; no egg white. wine-glass = 60 ml.'),
    ('r018', 'thomas-1876', 'Tom Collins', 'Tom Collins Gin (No. 250, after Tom Collins Whiskey No. 248)', '91', 'https://euvs-vintage-cocktail-books.cld.bz/1876-Jerry-Thoma-s-Bar-Tender-s-Guide-or-How-to-Mix-Drinks-Soft-Cover/91/', 'first_print', 'Shake with shaved ice, strain into a large bar glass, fill with plain soda and drink while lively.', '5 or 6 dashes of gum syrup. Juice of a small lemon. 1 large wineglass of whiskey. Fill the glass half full of shaved ice, shake up well and strain into a large bar glass. Fill up the glass with plain soda water and imbibe while it is lively.', 'Quote is No. 248, Tom Collins Whiskey; No. 250 reads ''The same as Tom Collins Whiskey, substituting gin for whiskey.'' The first printed Tom Collins was a family (whiskey, brandy, gin), with whiskey listed first. wine-glass = 60 ml.'),
    ('r019', 'grohusko-1908', 'Brooklyn', 'Brooklyn Cocktail', '22', 'https://euvs-vintage-cocktail-books.cld.bz/1908-Jack-s-Manual-by-J-A-Grohusko/22/', 'first_print', 'Stir with ice and strain.', '1 dash Amer. Picon bitters 1 dash Maraschino 50% rye whiskey 50% Ballor Vermouth Fill glass with ice. Stir and strain. Serve.', 'Sweet vermouth here; the drink later moved to French (dry) vermouth, which is how it is made today. fractions assume a 90 ml drink.'),
    ('r020', 'straub-1913', 'Brooklyn', 'Brooklyn Cocktail', '14', 'https://euvs-vintage-cocktail-books.cld.bz/1913-Straub-s-Manual-of-Mixed-Drinks/14/', 'version', 'Stir.', '1 Dash Amer Picon. 1 Dash Maraschino. 1/2 Jigger French Vermouth. 1/2 Jigger good Rye Whiskey. Stir.', 'Earliest Brooklyn with French (dry) vermouth we found, the form used today. jigger = 45 ml.'),
    ('r021', 'stuart-1904', 'Bamboo', 'Bamboo Cocktail', '131', NULL, 'first_print', 'No method printed.', NULL, 'In the ''New and Up-to-Date Drinks'' appendix of the 1904 edition. Earliest book printing we found. Uses Italian (sweet) vermouth; the fractions are too small to read, so amounts are left blank and no quote is given. EUVS has no text layer for this book.'),
    ('r022', 'boothby-1908', 'Bamboo', 'Bamboo Cocktail (originated by Louis Eppinger, Yokohama)', '22', 'https://euvs-vintage-cocktail-books.cld.bz/1908-The-World-s-Drinks-and-How-to-Miw-Them-by-Hon-Wm-Boothby-1st-edition/24/', 'version', 'Stir with cracked ice, strain into a stem cocktail glass, twist lemon peel over, serve with an olive.', 'Into a mixing-glass of cracked ice place half a jiggerful of French vermouth, half a jiggerful of sherry, two dashes of Orange bitters and two drops of Angostura bitters; stir thoroughly and strain into a stem cocktail-glass; squeeze and twist a piece of lemon peel over the top and serve with a pimola or an olive.', 'Recipe No. 31. Dry French vermouth and equal parts: the Bamboo as made today. Credits Louis Eppinger of Yokohama. EUVS index is printed page plus 2. jigger = 45 ml.'),
    ('r023', 'johnson-1900', 'Tuxedo', 'Tuxedo Cocktail', '267', NULL, 'first_print', 'Stir with fine-shaved ice, strain into a cocktail glass with a cherry, squeeze lemon peel on top.', '3/4 glass full of fine-shaved ice; 1 or 2 dashes of maraschino; 1 dash of absinthe; 2 or 3 dashes of orange bitters; 1/2 wine glass of French vermouth; 1/2 wine glass Sir Burnett''s Tom gin; Stir up well with a spoon, strain into a cocktail glass, putting in cherry, squeeze a piece of lemon peel on top and serve.', 'Earliest we found. Checked against the page image. Equal parts here; modern Tuxedo No. 2 recipes usually use dry gin. EUVS has no text layer for this edition, so no page link. wine-glass = 60 ml.'),
    ('r024', 'johnson-1900', 'Bijou', 'Bijou Cocktail', '257', NULL, 'first_print', 'Stir with fine shaved ice, strain into a cocktail glass, add a cherry or olive and squeeze lemon peel on top.', '3/4 glass filled with fine shaved ice; 1/3 wine glass chartreuse (green); 1/3 wine glass vermouth (Italian); 1/3 wine glass of Plymouth gin; 1 dash of orange bitters. Mix well with a spoon, strain into a cocktail glass; add a cherry or medium-size olive, squeeze a piece of lemon peel on top and serve.', 'Earliest we found. Equal thirds of gin, green Chartreuse and sweet vermouth, as today. Checked against the page image. wine-glass = 60 ml.'),
    ('r025', 'straub-1913', 'Alaska', 'Alaska Cocktail', '9', 'https://euvs-vintage-cocktail-books.cld.bz/1913-Straub-s-Manual-of-Mixed-Drinks/9/', 'first_print', 'Shake.', '1 Dash Orange Bitters. 1/3 Jigger Yellow Chartreuse. 2/3 Jigger Tom Gin. Shake.', 'Earliest we found. Old Tom gin; modern recipes use London dry gin and often stir. jigger = 45 ml.'),
    ('r026', 'boothby-1908', 'Rob Roy', 'Rob Roy Cocktail (a la Johnny Kent, San Francisco)', '28', 'https://euvs-vintage-cocktail-books.cld.bz/1908-The-World-s-Drinks-and-How-to-Miw-Them-by-Hon-Wm-Boothby-1st-edition/30/', 'first_print', 'Stir with cracked ice, strain into a chilled cocktail glass, squeeze lemon peel over, ice water on the side.', 'Into a small mixing-glass of cracked ice put two dashes of Orange bitters, two drops of Angostura bitters, half a jigger of French vermouth and half a jigger of good Scotch whiskey; stir well, strain into a chilled cocktail glass, squeeze a piece of lemon peel over the top and serve with ice water on the side.', 'Recipe No. 60, earliest we found. Note French (dry) vermouth, equal parts; today''s Rob Roy uses sweet vermouth at about 2:1. jigger = 45 ml.'),
    ('r027', 'straub-1913', 'Rob Roy', 'Rob Roy Cocktail', '40', 'https://euvs-vintage-cocktail-books.cld.bz/1913-Straub-s-Manual-of-Mixed-Drinks/40/', 'version', 'No method beyond the list.', '1/2 Jgger Italian Vermouth. 1/2 Jigger McCallum''s Perfection Scotch Whiskey. 1 Dash Angostura. 1 Dash Orange Bitters.', 'Switches to Italian (sweet) vermouth, the modern form. jigger = 45 ml.'),
    ('r028', 'straub-1913', 'Bobby Burns', 'Robert Burns Cocktail', '40', 'https://euvs-vintage-cocktail-books.cld.bz/1913-Straub-s-Manual-of-Mixed-Drinks/40/', 'first_print', 'Shake well.', '1 Dash Absinthe. 1/4 Jigger Italian Vermouth. 3/4 Jigger Irish or Scotch Whiskey. Shake well.', 'Earliest we found under the Burns name. Absinthe, not Benedictine, as the accent. The same book (p. 13) also has a different ''Bobbie Burns'' for two with orange juice and maraschino. jigger = 45 ml.'),
    ('r029', 'savoy-1930', 'Bobby Burns', 'Bobby Burns Cocktail', '33', 'https://euvs-vintage-cocktail-books.cld.bz/1930-The-Savoy-Cocktail-Book/33/', 'version', 'Shake and strain into a cocktail glass; squeeze lemon peel over.', NULL, 'Benedictine replaces absinthe, giving the version made today. Savoy text is in copyright in the UK, so facts only. fractions assume a 90 ml drink.'),
    ('r030', 'straub-1913', 'Stinger', 'Stinger', '101', 'https://euvs-vintage-cocktail-books.cld.bz/1913-Straub-s-Manual-of-Mixed-Drinks/101/', 'first_print', 'Shake and strain into a cocktail glass.', '1/2 Jigger Brandy. 1/2 Jigger Creme de Menthe White. 1 Lemon Peel. Shake, strain into Cocktail Glass.', 'Earliest we found. Equal parts with a lemon peel; modern Stingers are far more brandy-heavy. jigger = 45 ml.'),
    ('r031', 'bullock-1917', 'Stinger', 'Stinger (Country Club Style)', NULL, NULL, 'version', 'Shake with lump ice and strain into a cocktail glass.', 'Use a large Mixing glass; fill with Lump Ice. 1 jigger Old Brandy. 1 pony white Creme de Menthe. Shake well; strain into Cocktail glass and serve.', 'Shifts toward brandy (3:2). From the Gutenberg text, no page numbers. jigger = 45 ml; pony = 30 ml.'),
    ('r032', 'boothby-1908', 'Pompier', 'Pompier (a famous French drink)', '66', 'https://euvs-vintage-cocktail-books.cld.bz/1908-The-World-s-Drinks-and-How-to-Miw-Them-by-Hon-Wm-Boothby-1st-edition/68/', 'first_print', 'Build in a highball glass over a lump of ice and top with siphon seltzer.', 'Into a highball glass place a pony of Creme de Cassis, a lump of ice and a jigger of French vermouth; fill the glass with siphon seltzer, stir and serve.', 'Recipe No. 267, earliest we found. Ensslin (1917) and Straub (1913) print it too. EUVS index is printed page plus 2. jigger = 45 ml; pony = 30 ml.'),
    ('r033', 'grohusko-1908', 'Jack Rose', 'Jack Rose', '37', 'https://euvs-vintage-cocktail-books.cld.bz/1908-Jack-s-Manual-by-J-A-Grohusko/37/', 'first_print', 'Shake with cracked ice, strain, and top with fizz water.', '1 teaspoonful sugar 10 dashes Raspberry syrup 16 dashes lemon juice 5 dashes orange juice Juice 1/2 lime 75% cider brandy. Fill glass with cracked ice, shake and strain, fill with fizz water and serve.', 'Earliest we found. A long fizz-style drink sweetened with raspberry syrup, not the grenadine sour served up today.'),
    ('r034', 'mcelhone-1927', 'Jack Rose', 'Jack Rose Cocktail', NULL, NULL, 'version', 'No method printed beyond the list.', '1/3 Apple Jack or Calvados, 1/6 Gin, 1/12 French Vermouth, 1/12 Italian Vermouth, 1/6 Orange Juice, 1/6 Lime or Lemon Juice, Grenadine enough to colour.', 'Grenadine replaces raspberry and the drink is now a short cocktail. MacElhone printed it already in the 1923 ABC (p. 41), but the small fractions there are hard to read, so this clean 1927 text is used. Ensslin 1917 (p. 19) has a simpler Jack Rose of lime, apple jack and grenadine. fractions assume a 90 ml drink.'),
    ('r035', 'ensslin-1917', 'Aviation', 'Aviation Cocktail', '7', NULL, 'first_print', 'Shake with cracked ice and strain.', '1/3 Lemon Juice 2/3 El Bart Gin 2 dashes Maraschino 2 dashes Creme de Violette Shake well in a mixing glass with cracked ice, strain and serve.', 'Ensslin''s first edition (1916) is the usual first-print citation; we read the 1917 second edition on EUVS, which has no text layer, so no page link. Checked against the page image. Savoy (1930) later dropped the violette. fractions assume a 90 ml drink.'),
    ('r036', 'bullock-1917', 'Clover Club', 'Clover Club Cocktail', NULL, NULL, 'first_print', 'Shake over fine ice and strain into a cocktail glass.', 'Fill large Bar glass 1/2 full Fine Ice. 1/2 pony Raspberry Syrup. 1/2 jigger Dry Gin. 1/2 jigger French Vermouth. White of 1 Egg. Shake well; strain into Cocktail glass and serve.', 'Earliest full recipe we found (1917). Ensslin''s 1917 edition has a Clover Club too, ''made same as Clover Leaf Cocktail without the mint''. No citrus here; vermouth instead. From the Gutenberg text. jigger = 45 ml; pony = 30 ml.'),
    ('r037', 'judgejr-1927', 'Clover Club', 'Clover Club', '56', 'https://euvs-vintage-cocktail-books.cld.bz/1927-Here-s-How-2nd-impression/56/', 'version', 'Listed ingredients only.', '1 jigger of Gordon water; the white of an egg; the Juice of a lemon; a dash of grenadine.', 'Lemon in, vermouth out: the modern Clover Club shape (''Gordon water'' is the book''s joke for gin). jigger = 45 ml.'),
    ('r038', 'ensslin-1917', 'Ramos Gin Fizz', 'New Orleans Fizz', '41', NULL, 'ancestor', 'Made and served like a plain gin fizz (shaken, topped with soda).', 'Juice 1/2 Lemon Juice 1/2 Lime 2 teaspoonsful Powdered Sugar White of 1 Egg 1 drink Gin 3 dashes Orange Flower Water 1/2 pony Cream Made and served as directed for plain Gin Fizz.', 'The Ramos formula (both citrus, egg white, orange flower water, cream) under its generic New Orleans name. Checked against the page image. pony = 30 ml.'),
    ('r039', 'bullock-1917', 'Ramos Gin Fizz', 'Ramos Gin Fizz (Country Club Style)', NULL, NULL, 'first_print', 'Shake and strain into a highball glass.', '1 lump Ice. 1 dash Lemon Juice. 1 dash Orange Water. White of Egg. 1 jigger Burnette''s Old Tom Gin. 1 teaspoonful Powdered Sugar. 1 pony Milk. 1 dash Seltzer Water. Shake well; strain into Highball glass and serve.', 'Earliest printing under the Ramos name we found. Milk, Old Tom gin and only a dash of lemon. From the Gutenberg text. jigger = 45 ml; pony = 30 ml.'),
    ('r040', 'arthur-1937', 'Ramos Gin Fizz', 'Ramos Gin Fizz', '44', 'https://euvs-vintage-cocktail-books.cld.bz/1938-Famous-New-Orleans-Drinks-and-how-to-mix-em-3rd-printing-by-Stanley-Clisby-Arthur/44/', 'version', 'Combine in order in a tall glass, add crushed ice, shake long and hard, strain.', NULL, 'The New Orleans recipe with both citruses, dry gin and cream or milk. Facts only (in copyright).'),
    ('r041', 'mcelhone-1923', 'Pegu Club', 'Pegu Club Cocktail', '57', 'https://euvs-vintage-cocktail-books.cld.bz/1923-Harry-of-Ciro-s-ABC-of-mixing-cocktails-second-impression/57/', 'first_print', 'No method printed.', NULL, 'Recipe No. 197, earliest we found. The fractions in this 1923 scan are too small to read with certainty, so no quote; amounts follow the same author''s Barflies and Cocktails (1927), which prints 1/6 Curacao and 2/3 Gin. Rose''s lime cordial, not fresh lime. fractions assume a 90 ml drink.'),
    ('r042', 'mcelhone-1923', 'White Lady', 'White Lady Cocktail', '77', 'https://euvs-vintage-cocktail-books.cld.bz/1923-Harry-of-Ciro-s-ABC-of-mixing-cocktails-second-impression/77/', 'first_print', 'Shake well and strain.', NULL, 'Recipe No. 274, earliest we found. No gin and no lemon: the first White Lady was Cointreau, brandy and creme de menthe. Fractions are hard to read in this scan, so no quote; amounts match Barflies and Cocktails (1927), which prints 1/6, 1/6, 2/3. fractions assume a 90 ml drink.'),
    ('r043', 'savoy-1930', 'White Lady', 'White Lady Cocktail', '175', 'https://euvs-vintage-cocktail-books.cld.bz/1930-The-Savoy-Cocktail-Book/175/', 'version', 'Shake and strain into a cocktail glass.', NULL, 'The gin-and-lemon White Lady made today. Facts only (Savoy). fractions assume a 90 ml drink.'),
    ('r044', 'mcelhone-1923', 'Sidecar', 'Side-Car Cocktail', '65', 'https://euvs-vintage-cocktail-books.cld.bz/1923-Harry-of-Ciro-s-ABC-of-mixing-cocktails-second-impression/65/', 'first_print', 'No method printed.', '1/3 Cointreau (Triple sec), 1/3 Brandy, 1/3 Lemon Juice. (Recipe by MacGarry, the popular bar-tender at Buck''s Club, London.)', 'Recipe No. 229, earliest we found. Credits MacGarry of Buck''s Club. Robert Vermeire''s Cocktails: How to Mix Them also prints a Side-Car. Equal parts; modern specs lean on the brandy. fractions assume a 90 ml drink.'),
    ('r045', 'arthur-1937', 'Sidecar', 'Side Car Cocktail', '52', 'https://euvs-vintage-cocktail-books.cld.bz/1938-Famous-New-Orleans-Drinks-and-how-to-mix-em-3rd-printing-by-Stanley-Clisby-Arthur/52/', 'version', 'Shake with cracked ice and strain into a chilled cocktail glass.', NULL, 'Brandy-forward with lime; the text notes some prefer lemon or equal thirds. Facts only (in copyright).'),
    ('r046', 'mcelhone-1923', 'French 75', '"75" Cocktail', '65', 'https://euvs-vintage-cocktail-books.cld.bz/1923-Harry-of-Ciro-s-ABC-of-mixing-cocktails-second-impression/65/', 'ancestor', 'Shake and strain into a cocktail glass.', '1 teaspoonful Grenadine, 2 dashes of Absinthe or Anis-del-Oso, 2/3 Calvados, 1/3 Gin. Shake well and strain into cocktail glass. (This cocktail was very popular in France during the war, and named after the French light field gun.)', 'Recipe No. 228. The original ''75'' was a calvados and gin cocktail with no champagne. fractions assume a 90 ml drink.'),
    ('r047', 'judgejr-1927', 'French 75', 'The French "75"', '28', 'https://euvs-vintage-cocktail-books.cld.bz/1927-Here-s-How-2nd-impression/28/', 'first_print', 'Over cracked ice in a tall glass, top with champagne.', '2 jiggers Gordon water; 1 part lemon juice; a spoonful of powdered sugar; cracked ice. Fill up the rest of a tall glass with champagne!', 'Earliest gin, lemon and champagne French 75 we found. Served tall over ice; the book notes that with soda instead of champagne it is a Tom Collins. jigger = 45 ml.'),
    ('r048', 'savoy-1930', 'French 75', 'The French "75" Cocktail', '73', 'https://euvs-vintage-cocktail-books.cld.bz/1930-The-Savoy-Cocktail-Book/73/', 'version', 'Pour into a tall glass with cracked ice and top with champagne.', NULL, 'Same shape as Judge Jr. Facts only (Savoy). fractions assume a 90 ml drink.'),
    ('r049', 'savoy-1930', 'Hanky Panky', 'Hanky Panky Cocktail', '80', 'https://euvs-vintage-cocktail-books.cld.bz/1930-The-Savoy-Cocktail-Book/80/', 'first_print', 'Shake and strain into a cocktail glass; squeeze orange peel on top.', NULL, 'Earliest we found. The EUVS OCR garbles the two fractions but they are equal halves. Credited to Ada Coleman of the Savoy (per Wikipedia, not stated on this page). Facts only. fractions assume a 90 ml drink.'),
    ('r050', 'savoy-1930', 'Corpse Reviver #2', 'Corpse Reviver (No. 2.)', '52', 'https://euvs-vintage-cocktail-books.cld.bz/1930-The-Savoy-Cocktail-Book/52/', 'first_print', 'Shake and strain into a cocktail glass.', NULL, 'Earliest we found. Equal quarters plus absinthe, as today; Kina Lillet is gone, so Lillet Blanc or Cocchi Americano stand in. Facts only. wine-glass = 60 ml.'),
    ('r051', 'mcelhone-1923', 'Gimlet', 'Gimlet', '33', 'https://euvs-vintage-cocktail-books.cld.bz/1923-Harry-of-Ciro-s-ABC-of-mixing-cocktails-second-impression/33/', 'first_print', 'Stir and serve in the same glass; can be iced.', NULL, 'Recipe No. 99, earliest we found, noted as ''very popular in the Navy''. Half gin, half Rose''s cordial; modern Gimlets are drier, often with fresh lime and syrup. Fractions are faint in this scan; Barflies and Cocktails (1927) prints 1/2 and 1/2. fractions assume a 90 ml drink.'),
    ('r052', 'mcelhone-1927', 'Boulevardier', 'Boulevardier Cocktail', NULL, NULL, 'first_print', 'No method given.', 'Now is the time for all good Barflies to come to the aid of the party, since Erskinne Gwynne crashed in with his Boulevardier Cocktail; 1/3 Campari, 1/3 Italian vermouth, 1/3 Bourbon whisky.', 'In the ''Cocktails About Town'' essay at the back of the book, credited to Erskine Gwynne (spelled Erskinne here). Equal parts; modern specs often raise the whiskey. Page number not legible in the text we read. fractions assume a 90 ml drink.'),
    ('r053', 'ensslin-1917', 'Daiquiri', 'Bacardi Cocktail', '8', NULL, 'ancestor', 'Shake with cracked ice and strain.', '1 drink Bacardi Rum Juice of 1/2 Lime 2 dashes Gum Syrup Shake well in a mixing glass with cracked ice, strain and serve.', 'A daiquiri in all but name. Checked against the page image.'),
    ('r054', 'vermeire-1930', 'Daiquiri', 'Daiquiri', '25', NULL, 'first_print', 'Shake with broken ice and strain into a cocktail glass.', 'Fill the shaker half full of broken ice and add: 3/8 gill of Bacardi. 1/8 gill of fresh Lime Juice. Sweeten with Grenadine. Shake well and strain into a cocktail-glass.', 'Earliest printing under the Daiquiri name we found; the book calls it well known in Cuba and the southern US. Sweetened with grenadine, not sugar. The archive.org copy is undated (catalogued 1930) and refers to drinks introduced in 1922. ml uses a UK gill of 142 ml.'),
    ('r055', 'floridita-1939', 'Hemingway Daiquiri', '"E. Hemingway" Special', NULL, NULL, 'first_print', 'Shake with frappe ice and serve frappe.', NULL, 'Earliest printing we found. Only a teaspoon of grapefruit, no sugar; today''s versions use much more grapefruit. Page number not read. Facts only (in copyright).'),
    ('r056', 'sloppyjoes-1932', 'Mojito', 'Mojito (Bacardi drinks)', NULL, NULL, 'first_print', 'Build in a highball glass with cracked ice and top with seltzer.', NULL, 'Earliest printing we found. The same booklet also prints a gin Mojito under Gordon Dry Gin drinks. Page number not read. Facts only.'),
    ('r057', 'arthur-1937', 'Vieux Carré', 'Vieux Carre Cocktail', '53', 'https://euvs-vintage-cocktail-books.cld.bz/1938-Famous-New-Orleans-Drinks-and-how-to-mix-em-3rd-printing-by-Stanley-Clisby-Arthur/53/', 'first_print', 'Build Benedictine and bitters, add rye, brandy and vermouth over ice, stir, twist lemon peel; pineapple and cherry optional.', NULL, 'Earliest we found, credited to Walter Bergeron of the Hotel Monteleone. Facts only. jigger = 45 ml.'),
    ('r058', 'baker-1939', 'Remember the Maine', 'Remember the Maine', '116', 'https://euvs-vintage-cocktail-books.cld.bz/1939-The-Gentleman-s-Companion-volume-II-Beeing-an-Exotic-Drinking-Book/116/', 'first_print', 'Stir over ice in a tall bar glass, strain into a chilled saucer champagne glass, twist lime or lemon peel over.', NULL, 'Earliest we found. Facts only (in copyright). jigger = 45 ml.'),
    ('r059', 'byron-1884', 'New York Sour', 'Continental Sour', '65', 'https://euvs-vintage-cocktail-books.cld.bz/1884-The-Modern-Bartenders-Guide-by-O-H-Byron/65/', 'first_print', 'Shake with fine ice, strain into a sour glass, dash with claret.', '1/2 tea-spoon sugar, dissolved in water. Juice of 1/2 a lemon. 1 wine-glass whisky or liquor as desired; fine ice; shake well, and strain into a sour glass, and dash with claret.', 'Earliest printed whiskey sour with a claret float we found, under the older name Continental Sour. Bullock (1917) prints the same Continental Sour. The New York Sour name came later. Checked against the page image. wine-glass = 60 ml.'),
    ('r060', 'bullock-1917', 'New York Sour', 'Continental Sour', NULL, NULL, 'version', 'Shake with shaved ice, strain into a sour glass, dash with claret.', 'Fill a large Bar glass 2/3 full Shaved Ice. 1 teaspoonful Bar Sugar dissolved in little Water. Juice of 1/2 Lemon. 1 jigger of Whiskey, Brandy or Gin, as preferred. Shake; strain into Sour glass; dash with Claret and serve.', 'Same drink a generation later. From the Gutenberg text. jigger = 45 ml.'),
    ('r061', 'floridita-1939', 'Bloody Mary', 'Mary Rose (Domingo Bures)', NULL, NULL, 'ancestor', 'Shake and serve in a special glass.', NULL, 'Earliest printed recipe with the modern Bloody Mary''s core we found. Page number not read. Facts only.'),
    ('r062', 'wiki-bloody-mary', 'Bloody Mary', 'Bloody Mary', NULL, NULL, 'version', 'Mixed half and half.', NULL, 'Per Wikipedia: Lucius Beebe''s 1939 New York column called George Jessel''s pick-me-up a Bloody Mary, ''half tomato juice, half vodka''. Fernand Petiot claimed both a 1921 Paris origin and the 1934 seasoned version at the St. Regis King Cole Room. Origin disputed.'),
    ('r063', 'wiki-negroni', 'Negroni', 'Negroni', NULL, NULL, 'first_print', 'Built over ice with an orange slice (IBA).', NULL, 'No pre-1931 printing found in the books we searched. Per Wikipedia: documented in Italy from the late 1940s; an equal-parts gin, vermouth and Campari drink appears in French books of the late 1920s; the Count Camillo Negroni / Fosco Scarselli story (Florence, about 1919) is a claim.'),
    ('r064', 'wiki-americano', 'Americano', 'Americano', NULL, NULL, 'first_print', 'Served long over ice with soda.', NULL, 'No printed source found. Wikipedia''s origin story (Caffe Campari, Milan, 1860s) is folklore; it describes the Milano-Torino (Campari and vermouth, no soda) as the parent drink.'),
    ('r065', 'web-sbagliato', 'Sbagliato', 'Negroni Sbagliato', NULL, NULL, 'first_print', 'Negroni with sparkling wine in place of gin.', NULL, 'Credited to Mirko Stocchetto at Bar Basso, Milan; usually dated 1972 but also told as 1967 or 1969, and the ''wrong bottle'' story is doubted. Web summaries only.'),
    ('r066', 'web-white-negroni', 'White Negroni', 'White Negroni', NULL, NULL, 'first_print', 'Equal parts, grapefruit twist.', NULL, 'Created by Wayne Collins with Nick Blacknell of Plymouth Gin at Vinexpo, Bordeaux, 2001. Web summaries only.'),
    ('r067', 'wiki-mai-tai', 'Mai Tai', 'Mai Tai', NULL, NULL, 'first_print', 'Shaken, served over ice.', NULL, 'Per Wikipedia: Victor ''Trader Vic'' Bergeron, Oakland, 1944 (Donn Beach claimed 1933). The recipe stayed unpublished for nearly 30 years. No amounts recorded.'),
    ('r068', 'web-bitter-mai-tai', 'Bitter Mai Tai', 'Bitter Mai Tai', NULL, NULL, 'first_print', 'Shake, serve over crushed ice with mint.', NULL, 'Jeremy Oertel, usually credited to Dram, Brooklyn; dates disagree (2011 at Dram, or 2019 at Donna per Difford''s). Spec per the Cocktails Distilled summary; web summaries only.'),
    ('r069', 'wiki-jungle-bird', 'Jungle Bird', 'Jungle Bird', NULL, NULL, 'first_print', 'Shaken, served over ice.', NULL, 'Per Wikipedia: Jeffrey Ong, Aviary Bar, Kuala Lumpur Hilton, debuted 6 July 1973. First in a book in John J. Poister''s The New American Bartender''s Guide (1989); Giuseppe Gonzalez (Painkiller, NYC, 2010) cut pineapple from 4 oz to 1.5 oz and specified blackstrap rum.'),
    ('r070', 'wiki-pina-colada', 'Piña Colada', 'Pina Colada', NULL, NULL, 'first_print', 'Blended or shaken with ice.', NULL, 'Origin disputed per Wikipedia: Caribe Hilton says Ramon ''Monchito'' Marrero, 1954; Ricardo Garcia also claimed 1953 there; Barrachina has a claim too. Treat as unresolved.'),
    ('r071', 'web-el-diablo', 'El Diablo', 'Mexican El Diablo', NULL, NULL, 'first_print', 'Build over cracked ice in a 10 oz glass and fill with ginger ale.', NULL, 'First appears as ''Mexican El Diablo'' in Trader Vic''s Book of Food and Drink (1946); shortened to El Diablo by 1968. Ginger beer is the modern switch. Web summaries only (book not read).'),
    ('r072', 'wiki-margarita', 'Margarita', 'Margarita', NULL, NULL, 'first_print', 'As given in the first published recipe.', NULL, 'Per Wikipedia: first known published Margarita recipe, Esquire, December 1953. Many creation stories (1938 Herrera, 1941 Hussong''s, 1942 Morales and others); the Cafe Royal Cocktail Book (1937) has a similar Picador. Modern spec uses far more triple sec.'),
    ('r073', 'wiki-tommys-margarita', 'Tommy''s Margarita', 'Tommy''s Margarita', NULL, NULL, 'first_print', 'Served on ice.', NULL, 'Per Wikipedia: Julio Bermejo, Tommy''s Mexican Restaurant, San Francisco, 1990; agave nectar in place of triple sec.'),
    ('r074', 'web-oaxaca-old-fashioned', 'Oaxaca Old Fashioned', 'Oaxaca Old Fashioned', NULL, NULL, 'first_print', 'Stirred, served over a large cube.', NULL, 'Phil Ward, Death & Co, New York, 2007. Spec as Difford''s lists Ward''s original; web summaries only.'),
    ('r075', 'web-division-bell', 'Division Bell', 'Division Bell', NULL, NULL, 'first_print', 'Shake, strain into a chilled coupe.', NULL, 'Phil Ward, opening menu of Mayahuel, New York, 2009; a Last Word riff. Web summaries only.'),
    ('r076', 'wiki-naked-and-famous', 'Naked and Famous', 'Naked and Famous', NULL, NULL, 'first_print', 'Shaken, served up.', NULL, 'Per Wikipedia: Joaquin Simo, Death & Co, New York, 2011.'),
    ('r077', 'web-gold-rush', 'Gold Rush', 'Gold Rush', NULL, NULL, 'first_print', 'Shake, serve over ice.', NULL, 'T.J. Siegal (a customer) at Milk & Honey, New York, about 2000 (sources say 1999 to 2001). Web summaries only.'),
    ('r078', 'wiki-penicillin', 'Penicillin', 'Penicillin', NULL, NULL, 'first_print', 'Shaken.', NULL, 'Per Wikipedia: Sam Ross, Milk & Honey, New York, 2005. Amounts not recorded.'),
    ('r079', 'wiki-paper-plane', 'Paper Plane', 'Paper Plane', NULL, NULL, 'first_print', 'Shaken, served up.', NULL, 'Per Wikipedia: Sam Ross and Sasha Petraske, 2008, for Toby Maloney''s The Violet Hour, Chicago. First made with Campari, then switched to Aperol.'),
    ('r080', 'web-red-hook', 'Red Hook', 'Red Hook', NULL, NULL, 'first_print', 'Stir, strain into a chilled coupe.', NULL, 'Vincenzo ''Enzo'' Errico, Milk & Honey, New York, about 2003 (Oxford Companion says 2004). Web summaries only.'),
    ('r081', 'web-little-italy', 'Little Italy', 'Little Italy', NULL, NULL, 'first_print', 'Stir, strain into a coupe.', NULL, 'Audrey Saunders for the Pegu Club opening menu, New York, 2005 (one source says about 2003). Web summaries only.'),
    ('r082', 'wiki-trinidad-sour', 'Trinidad Sour', 'Trinidad Sour', NULL, NULL, 'first_print', 'Shaken sour.', NULL, 'Per Wikipedia: Giuseppe Gonzalez, 2009 competition. Angostura is the largest component; the other ingredients were not confirmed in what we read, so they are left out.'),
    ('r083', 'web-fitzgerald', 'Fitzgerald', 'Fitzgerald', NULL, NULL, 'first_print', 'Shake and strain.', NULL, 'Dale DeGroff, Rainbow Room, New York, early 1990s (began as the ''Gin Thing''). Spec as adapted from DeGroff''s 2002 book per the Williams-Sonoma summary. Web summaries only.'),
    ('r084', 'wiki-moscow-mule', 'Moscow Mule', 'Moscow Mule', NULL, NULL, 'first_print', 'Served in a copper mug.', NULL, 'Per Wikipedia (quoting a 1948 New York Herald Tribune piece): Jack Morgan of the Cock ''n'' Bull, John G. Martin and Rudolph Kunett of Smirnoff, 1941. A 2007 account credits Wes Price.'),
    ('r085', 'wiki-cosmopolitan', 'Cosmopolitan', 'Cosmopolitan', NULL, NULL, 'first_print', 'Shaken, served up.', NULL, 'Origin disputed per Wikipedia: Neal Murray says 1975 at the Cork & Cleaver, Minneapolis; other claims in Provincetown and San Francisco; a 1989 New York version and Dale DeGroff''s mid-1990s citron vodka spec made it famous. A gin ''Cosmopolitan Daisy'' is in a 1934 book.'),
    ('r086', 'wiki-lemon-drop', 'Lemon Drop', 'Lemon Drop', NULL, NULL, 'first_print', 'Served up with a sugared rim.', NULL, 'Per Wikipedia: Norman Jay Hobday, Henry Africa''s, San Francisco, 1970s.'),
    ('r087', 'wiki-espresso-martini', 'Espresso Martini', 'Espresso Martini (Vodka Espresso)', NULL, NULL, 'first_print', 'Shaken, served up.', NULL, 'Per Wikipedia: Dick Bradsell, London, 1980s, usually placed at the Soho Brasserie about 1983. Amounts vary by source.'),
    ('r088', 'wiki-porn-star-martini', 'Porn Star Martini', 'Porn Star Martini', NULL, NULL, 'first_print', 'Shaken, served up.', NULL, 'Per Wikipedia: Douglas Ankrah, Townhouse, London, 2002.'),
    ('r089', 'wiki-vesper', 'Vesper', 'Vesper', NULL, NULL, 'first_print', 'Shaken (per the novel).', NULL, 'From Ian Fleming''s Casino Royale (1953), as quoted on Wikipedia. Kina Lillet ended in 1986; Lillet Blanc or Cocchi Americano are used now.'),
    ('r090', 'wiki-bramble', 'Bramble', 'Bramble', NULL, NULL, 'first_print', 'Built over crushed ice, creme de mure drizzled over.', NULL, 'Per Wikipedia: Dick Bradsell, London, 1984.'),
    ('r091', 'wiki-bellini', 'Bellini', 'Bellini', NULL, NULL, 'first_print', 'Mixed and served in a flute.', NULL, 'Per Wikipedia: Giuseppe Cipriani, Harry''s Bar, Venice, between 1934 and 1948.'),
    ('r092', 'web-aperol-spritz', 'Aperol Spritz', 'Aperol Spritz', NULL, NULL, 'first_print', 'Build over ice in a large wine glass.', NULL, 'Aperol launched by the Barbieri brothers in 1919; the 3-2-1 Aperol Spritz is dated to the 1950s, mainly by brand-linked sources. Web summaries only; treat the date as soft.'),
    ('r093', 'wiki-last-word', 'Last Word', 'Last Word', NULL, NULL, 'first_print', 'Shaken, served up.', NULL, 'Per Wikipedia: on the Detroit Athletic Club menu by 1916; first printed recipe in Ted Saucier''s Bottoms Up! (1951); revived by Murray Stenson at the Zig Zag Cafe, Seattle, about 2003. We did not read the 1951 book.'),
    ('r094', 'wiki-pisco-sour', 'Pisco Sour', 'Pisco Sour', NULL, NULL, 'first_print', 'Shaken, bitters on the foam.', NULL, 'Per Wikipedia: Victor Vaughen Morris, Morris'' Bar, Lima, early 1920s; Mario Bruiget at the same bar added egg white and Angostura in the late 1920s. Earliest mentions are newspaper ads, not a recipe book we could read.');

INSERT INTO "line_in" VALUES
    ('r000', 0, 'Brandy', 'Brandy', '1 wine-glass', 60, 'from the Brandy Cocktail (No. 107) the crusta builds on'),
    ('r000', 1, 'Gum Syrup', 'Gum Syrup', '3 or 4 dashes', NULL, 'from No. 107'),
    ('r000', 2, 'Bogart''s Bitters', 'Bogart''s Bitters', '2 dashes', NULL, 'from No. 107'),
    ('r000', 3, 'Curacao', 'Curacao', '1 or 2 dashes', NULL, 'from No. 107'),
    ('r000', 4, 'Lemon Juice', 'Lemon Juice', 'a little', NULL, NULL),
    ('r000', 5, 'Lemon Peel', 'Lemon Peel', 'half a lemon, pared in one piece', NULL, 'lines the glass'),
    ('r000', 6, 'Sugar', 'Sugar', 'rim', NULL, 'pulverized white sugar on a lemon-rubbed rim'),
    ('r001', 0, 'Whiskey', 'Whiskey', '1 wine-glass', 60, NULL),
    ('r001', 1, 'Gum Syrup', 'Gum Syrup', '3 or 4 dashes', NULL, NULL),
    ('r001', 2, 'Bogart''s Bitters', 'Bogart''s Bitters', '2 dashes', NULL, NULL),
    ('r001', 3, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, NULL),
    ('r002', 0, 'Whiskey', 'Whiskey', 'one jigger', 45, NULL),
    ('r002', 1, 'Sugar', 'Sugar', 'a small lump', NULL, 'dissolved in a little water'),
    ('r002', 2, 'Angostura Bitters', 'Angostura Bitters', 'two dashes', NULL, NULL),
    ('r002', 3, 'Ice', 'Ice', 'a small piece', NULL, NULL),
    ('r002', 4, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, NULL),
    ('r003', 0, 'Bourbon', 'Bourbon', '1-1/2 jiggers', 68, NULL),
    ('r003', 1, 'Sugar', 'Sugar', '1 lump', NULL, 'dissolved in water'),
    ('r003', 2, 'Angostura Bitters', 'Angostura Bitters', '2 dashes', NULL, NULL),
    ('r003', 3, 'Ice', 'Ice', '1 lump', NULL, NULL),
    ('r003', 4, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, 'twisted over and dropped in'),
    ('r004', 0, 'Whisky', 'Whisky', '1/2 wine-glass', 30, NULL),
    ('r004', 1, 'Italian Vermouth', 'Italian Vermouth', '1/2 wine-glass', 30, NULL),
    ('r004', 2, 'Curacao', 'Curacao', '2 dashes', 2, NULL),
    ('r004', 3, 'Angostura Bitters', 'Angostura Bitters', '2 dashes', NULL, NULL),
    ('r005', 0, 'Rye Whiskey', 'Rye Whiskey', '1 pony', 30, NULL),
    ('r005', 1, 'Vermouth', 'Vermouth', '1 wine-glass', 60, NULL),
    ('r005', 2, 'Curacao Or Maraschino', 'Curacao', '2 dashes', 2, NULL),
    ('r005', 3, 'Boker''s Bitters', 'Boker''s Bitters', '3 dashes', NULL, NULL),
    ('r005', 4, 'Gum Syrup', 'Gum Syrup', '2 dashes (optional)', 2, 'only if the customer wants it very sweet'),
    ('r006', 0, 'Whiskey', 'Whiskey', 'one-half jigger', 23, NULL),
    ('r006', 1, 'Italian Vermouth', 'Italian Vermouth', 'one-half jigger', 23, NULL),
    ('r006', 2, 'Gum Syrup', 'Gum Syrup', 'two dashes', 2, NULL),
    ('r006', 3, 'Peychaud Or Angostura Bitters', 'Peychaud', 'two dashes', NULL, NULL),
    ('r006', 4, 'Lemon Peel Or Cherry', 'Lemon Peel', 'a piece / a cherry', NULL, NULL),
    ('r007', 0, 'Gin', 'Gin', 'as Manhattan', NULL, 'gin in place of whisky'),
    ('r008', 0, 'Old Tom Gin', 'Old Tom Gin', '1 pony', 30, NULL),
    ('r008', 1, 'Vermouth', 'Vermouth', '1 wine-glass', 60, NULL),
    ('r008', 2, 'Maraschino', 'Maraschino', '2 dashes', 2, NULL),
    ('r008', 3, 'Boker''s Bitters', 'Boker''s Bitters', '1 dash', NULL, NULL),
    ('r008', 4, 'Gum Syrup', 'Gum Syrup', '2 dashes (optional)', 2, 'if the guest wants it very sweet'),
    ('r009', 0, 'Old Tom Gin', 'Old Tom Gin', '1/2 wine glassful', 30, NULL),
    ('r009', 1, 'Vermouth', 'Vermouth', '1/2 wine glassful', 30, NULL),
    ('r009', 2, 'Gum Syrup', 'Gum Syrup', '2 or 3 dashes', NULL, NULL),
    ('r009', 3, 'Boker''s Bitters', 'Boker''s Bitters', '2 or 3 dashes', NULL, NULL),
    ('r009', 4, 'Curacao', 'Curacao', '1 dash', 1, NULL),
    ('r009', 5, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, 'squeezed on top'),
    ('r010', 0, 'Old Tom Gin', 'Old Tom Gin', 'one-half jigger', 23, NULL),
    ('r010', 1, 'Italian Vermouth', 'Italian Vermouth', 'one-half jigger', 23, NULL),
    ('r010', 2, 'Orange Bitters', 'Orange Bitters', 'three dashes', NULL, NULL),
    ('r010', 3, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, NULL),
    ('r010', 4, 'Maraschino Cherry', 'Maraschino Cherry', 'optional', NULL, NULL),
    ('r011', 0, 'Dry Gin', 'Dry Gin', '2/3', 60, NULL),
    ('r011', 1, 'French Vermouth', 'French Vermouth', '1/3', 30, NULL),
    ('r011', 2, 'Orange Bitters', 'Orange Bitters', '1 dash', NULL, NULL),
    ('r011', 3, 'Olive', 'Olive', '1', NULL, NULL),
    ('r012', 0, 'Sazerac Brandy', 'Cognac', 'a jigger', 45, NULL),
    ('r012', 1, 'Gum Syrup', 'Gum Syrup', 'about a small barspoonful', NULL, NULL),
    ('r012', 2, 'Selner Bitters', 'Aromatic Bitters', 'three drops', NULL, 'brand as printed'),
    ('r012', 3, 'Absinthe', 'Absinthe', 'a dash', NULL, 'glass rinse'),
    ('r012', 4, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, 'squeezed over the top'),
    ('r013', 0, 'Rye Whiskey', 'Rye Whiskey', '1 jigger', 45, NULL),
    ('r013', 1, 'Sugar', 'Sugar', '1 lump', NULL, 'dissolved in a teaspoonful of water'),
    ('r013', 2, 'Peychaud Bitters', 'Peychaud''s Bitters', '1 dash', NULL, NULL),
    ('r013', 3, 'Absinthe', 'Absinthe', 'a dash', NULL, NULL),
    ('r013', 4, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, NULL),
    ('r014', 0, 'Rye Whiskey', 'Rye Whiskey', '1 jigger', 45, NULL),
    ('r014', 1, 'Sugar', 'Sugar', '1 lump', NULL, NULL),
    ('r014', 2, 'Peychaud''s Bitters', 'Peychaud''s Bitters', '3 drops', NULL, NULL),
    ('r014', 3, 'Angostura Bitters', 'Angostura Bitters', '1 dash', NULL, NULL),
    ('r014', 4, 'Absinthe Substitute', 'Absinthe', '1 dash', NULL, 'glass rinse'),
    ('r014', 5, 'Lemon Peel', 'Lemon Peel', '1 slice', NULL, 'twisted over, not dropped in'),
    ('r015', 0, 'Cognac', 'Cognac', 'one and a half wine-glass', 90, NULL),
    ('r015', 1, 'Sugar', 'Sugar', '1 table-spoonful', NULL, 'white pulverized'),
    ('r015', 2, 'Water', 'Water', '2 1/2 table-spoonfuls', NULL, NULL),
    ('r015', 3, 'Mint', 'Mint', 'three or four sprigs', NULL, NULL),
    ('r015', 4, 'Jamaica Rum', 'Jamaican Rum', 'a dash', NULL, 'on top'),
    ('r015', 5, 'Berries And Orange', 'Berries And Orange', 'to garnish', NULL, NULL),
    ('r016', 0, 'Brandy Or Gin', 'Brandy', '1 wine-glass', 60, 'from the Fix it is based on'),
    ('r016', 1, 'Sugar', 'Sugar', '1 table-spoonful', NULL, NULL),
    ('r016', 2, 'Water', 'Water', '1/2 wine-glass', 30, NULL),
    ('r016', 3, 'Lemon', 'Lemon', 'a small piece, juice pressed in', NULL, NULL),
    ('r017', 0, 'Whiskey', 'Whiskey', '1 wine glass', 60, NULL),
    ('r017', 1, 'Sugar', 'Sugar', 'one-half table-spoon', NULL, NULL),
    ('r017', 2, 'Lemon Juice', 'Lemon Juice', '3 or 4 dashes', NULL, NULL),
    ('r017', 3, 'Seltzer Water', 'Soda Water', '1 squirt', NULL, NULL),
    ('r018', 0, 'Gin', 'Gin', '1 large wineglass', 60, 'No. 250 swaps gin for the whiskey of No. 248'),
    ('r018', 1, 'Lemon Juice', 'Lemon Juice', 'juice of a small lemon', NULL, NULL),
    ('r018', 2, 'Gum Syrup', 'Gum Syrup', '5 or 6 dashes', NULL, NULL),
    ('r018', 3, 'Soda Water', 'Soda Water', 'fill', NULL, NULL),
    ('r019', 0, 'Rye Whiskey', 'Rye Whiskey', '50%', 45, 'as half of a 90 ml drink'),
    ('r019', 1, 'Ballor Vermouth', 'Sweet Vermouth', '50%', 45, 'an Italian (sweet) vermouth brand; the 1910 edition says Italian Vermouth'),
    ('r019', 2, 'Amer Picon', 'Amer Picon', '1 dash', 1, NULL),
    ('r019', 3, 'Maraschino', 'Maraschino', '1 dash', 1, NULL),
    ('r020', 0, 'Rye Whiskey', 'Rye Whiskey', '1/2 jigger', 23, NULL),
    ('r020', 1, 'French Vermouth', 'French Vermouth', '1/2 jigger', 23, NULL),
    ('r020', 2, 'Amer Picon', 'Amer Picon', '1 dash', 1, NULL),
    ('r020', 3, 'Maraschino', 'Maraschino', '1 dash', 1, NULL),
    ('r021', 0, 'Sherry', 'Sherry', NULL, NULL, 'fraction printed but illegible in the scan (probably 2/3)'),
    ('r021', 1, 'Italian Vermouth', 'Italian Vermouth', NULL, NULL, 'fraction illegible (probably 1/3)'),
    ('r021', 2, 'Orange Bitters', 'Orange Bitters', '1 dash', NULL, NULL),
    ('r022', 0, 'Sherry', 'Sherry', 'half a jiggerful', 23, NULL),
    ('r022', 1, 'French Vermouth', 'French Vermouth', 'half a jiggerful', 23, NULL),
    ('r022', 2, 'Orange Bitters', 'Orange Bitters', 'two dashes', NULL, NULL),
    ('r022', 3, 'Angostura Bitters', 'Angostura Bitters', 'two drops', NULL, NULL),
    ('r022', 4, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, NULL),
    ('r022', 5, 'Olive', 'Olive', 'a pimola or an olive', NULL, NULL),
    ('r023', 0, 'Old Tom Gin', 'Old Tom Gin', '1/2 wine glass', 30, 'Sir Burnett''s Tom gin'),
    ('r023', 1, 'French Vermouth', 'French Vermouth', '1/2 wine glass', 30, NULL),
    ('r023', 2, 'Maraschino', 'Maraschino', '1 or 2 dashes', NULL, NULL),
    ('r023', 3, 'Absinthe', 'Absinthe', '1 dash', 1, NULL),
    ('r023', 4, 'Orange Bitters', 'Orange Bitters', '2 or 3 dashes', NULL, NULL),
    ('r023', 5, 'Cherry', 'Cherry', '1', NULL, NULL),
    ('r023', 6, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, NULL),
    ('r024', 0, 'Green Chartreuse', 'Green Chartreuse', '1/3 wine glass', 20, NULL),
    ('r024', 1, 'Italian Vermouth', 'Italian Vermouth', '1/3 wine glass', 20, NULL),
    ('r024', 2, 'Plymouth Gin', 'Plymouth Gin', '1/3 wine glass', 20, NULL),
    ('r024', 3, 'Orange Bitters', 'Orange Bitters', '1 dash', NULL, NULL),
    ('r024', 4, 'Cherry Or Olive', 'Cherry', '1', NULL, NULL),
    ('r024', 5, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, NULL),
    ('r025', 0, 'Old Tom Gin', 'Old Tom Gin', '2/3 jigger', 30, NULL),
    ('r025', 1, 'Yellow Chartreuse', 'Yellow Chartreuse', '1/3 jigger', 15, NULL),
    ('r025', 2, 'Orange Bitters', 'Orange Bitters', '1 dash', NULL, NULL),
    ('r026', 0, 'Scotch Whisky', 'Scotch Whisky', 'half a jigger', 23, NULL),
    ('r026', 1, 'French Vermouth', 'French Vermouth', 'half a jigger', 23, NULL),
    ('r026', 2, 'Orange Bitters', 'Orange Bitters', 'two dashes', NULL, NULL),
    ('r026', 3, 'Angostura Bitters', 'Angostura Bitters', 'two drops', NULL, NULL),
    ('r026', 4, 'Lemon Peel', 'Lemon Peel', 'a piece', NULL, NULL),
    ('r027', 0, 'Scotch Whisky', 'Scotch Whisky', '1/2 jigger', 23, 'McCallum''s Perfection Scotch'),
    ('r027', 1, 'Italian Vermouth', 'Italian Vermouth', '1/2 jigger', 23, NULL),
    ('r027', 2, 'Angostura Bitters', 'Angostura Bitters', '1 dash', NULL, NULL),
    ('r027', 3, 'Orange Bitters', 'Orange Bitters', '1 dash', NULL, NULL),
    ('r028', 0, 'Irish Or Scotch Whisky', 'Irish', '3/4 jigger', 34, NULL),
    ('r028', 1, 'Italian Vermouth', 'Italian Vermouth', '1/4 jigger', 11, NULL),
    ('r028', 2, 'Absinthe', 'Absinthe', '1 dash', 1, NULL),
    ('r029', 0, 'Scotch Whisky', 'Scotch Whisky', '1/2', 45, NULL),
    ('r029', 1, 'Italian Vermouth', 'Italian Vermouth', '1/2', 45, NULL),
    ('r029', 2, 'Benedictine', 'Benedictine', '3 dashes', 3, NULL),
    ('r029', 3, 'Lemon Peel', 'Lemon Peel', 'squeezed on top', NULL, NULL),
    ('r030', 0, 'Brandy', 'Brandy', '1/2 jigger', 23, NULL),
    ('r030', 1, 'White Creme De Menthe', 'White Crème de Menthe', '1/2 jigger', 23, NULL),
    ('r030', 2, 'Lemon Peel', 'Lemon Peel', '1', NULL, NULL),
    ('r031', 0, 'Brandy', 'Brandy', '1 jigger', 45, 'old brandy'),
    ('r031', 1, 'White Creme De Menthe', 'White Crème de Menthe', '1 pony', 30, NULL),
    ('r032', 0, 'French Vermouth', 'French Vermouth', 'a jigger', 45, NULL),
    ('r032', 1, 'Creme De Cassis', 'Creme De Cassis', 'a pony', 30, NULL),
    ('r032', 2, 'Seltzer', 'Seltzer', 'fill', NULL, NULL),
    ('r032', 3, 'Ice', 'Ice', 'a lump', NULL, NULL),
    ('r033', 0, 'Apple Brandy', 'Apple Brandy', '75%', NULL, 'printed as cider brandy'),
    ('r033', 1, 'Raspberry Syrup', 'Raspberry Syrup', '10 dashes', 10, NULL),
    ('r033', 2, 'Lemon Juice', 'Lemon Juice', '16 dashes', 16, NULL),
    ('r033', 3, 'Orange Juice', 'Orange Juice', '5 dashes', 5, NULL),
    ('r033', 4, 'Lime Juice', 'Lime Juice', 'juice of 1/2 lime', NULL, NULL),
    ('r033', 5, 'Sugar', 'Sugar', '1 teaspoonful', NULL, NULL),
    ('r033', 6, 'Soda Water', 'Soda Water', 'fill', NULL, 'fizz water'),
    ('r034', 0, 'Apple Brandy', 'Apple Brandy', '1/3', 30, 'Apple Jack or Calvados'),
    ('r034', 1, 'Gin', 'Gin', '1/6', 15, NULL),
    ('r034', 2, 'French Vermouth', 'French Vermouth', '1/12', 8, NULL),
    ('r034', 3, 'Italian Vermouth', 'Italian Vermouth', '1/12', 8, NULL),
    ('r034', 4, 'Orange Juice', 'Orange Juice', '1/6', 15, NULL),
    ('r034', 5, 'Lime Or Lemon Juice', 'Lime', '1/6', 15, NULL),
    ('r034', 6, 'Grenadine', 'Grenadine', 'enough to colour', NULL, NULL),
    ('r035', 0, 'Gin', 'Gin', '2/3', 60, 'El Bart gin'),
    ('r035', 1, 'Lemon Juice', 'Lemon Juice', '1/3', 30, NULL),
    ('r035', 2, 'Maraschino', 'Maraschino', '2 dashes', 2, NULL),
    ('r035', 3, 'Creme De Violette', 'Creme De Violette', '2 dashes', 2, NULL),
    ('r036', 0, 'Dry Gin', 'Dry Gin', '1/2 jigger', 23, NULL),
    ('r036', 1, 'French Vermouth', 'French Vermouth', '1/2 jigger', 23, NULL),
    ('r036', 2, 'Raspberry Syrup', 'Raspberry Syrup', '1/2 pony', 15, NULL),
    ('r036', 3, 'Egg White', 'Egg White', '1', NULL, NULL),
    ('r037', 0, 'Gin', 'Gin', '1 jigger', 45, NULL),
    ('r037', 1, 'Egg White', 'Egg White', '1', NULL, NULL),
    ('r037', 2, 'Lemon Juice', 'Lemon Juice', 'juice of a lemon', NULL, NULL),
    ('r037', 3, 'Grenadine', 'Grenadine', 'a dash', NULL, NULL),
    ('r038', 0, 'Gin', 'Gin', '1 drink', NULL, NULL),
    ('r038', 1, 'Lemon Juice', 'Lemon Juice', 'juice 1/2 lemon', NULL, NULL),
    ('r038', 2, 'Lime Juice', 'Lime Juice', 'juice 1/2 lime', NULL, NULL),
    ('r038', 3, 'Sugar', 'Sugar', '2 teaspoonsful powdered', NULL, NULL),
    ('r038', 4, 'Egg White', 'Egg White', '1', NULL, NULL),
    ('r038', 5, 'Orange Flower Water', 'Orange Flower Water', '3 dashes', 3, NULL),
    ('r038', 6, 'Cream', 'Cream', '1/2 pony', 15, NULL),
    ('r039', 0, 'Old Tom Gin', 'Old Tom Gin', '1 jigger', 45, 'Burnette''s Old Tom'),
    ('r039', 1, 'Lemon Juice', 'Lemon Juice', '1 dash', 1, NULL),
    ('r039', 2, 'Orange Flower Water', 'Orange Flower Water', '1 dash', 1, NULL),
    ('r039', 3, 'Egg White', 'Egg White', '1', NULL, NULL),
    ('r039', 4, 'Sugar', 'Sugar', '1 teaspoonful powdered', NULL, NULL),
    ('r039', 5, 'Milk', 'Milk', '1 pony', 30, NULL),
    ('r039', 6, 'Seltzer', 'Seltzer', '1 dash', NULL, NULL),
    ('r040', 0, 'Dry Gin', 'Dry Gin', '1 jigger', 45, NULL),
    ('r040', 1, 'Lemon Juice', 'Lemon Juice', 'juice of 1/2 lemon', NULL, NULL),
    ('r040', 2, 'Lime Juice', 'Lime Juice', 'juice of 1/2 lime', NULL, NULL),
    ('r040', 3, 'Sugar', 'Sugar', '1 tablespoon powdered', NULL, NULL),
    ('r040', 4, 'Orange Flower Water', 'Orange Flower Water', '3-4 drops', NULL, NULL),
    ('r040', 5, 'Egg White', 'Egg White', '1', NULL, NULL),
    ('r040', 6, 'Milk Or Cream', 'Milk', '1 jigger', 45, NULL),
    ('r040', 7, 'Seltzer', 'Seltzer', '1 squirt', NULL, NULL),
    ('r040', 8, 'Vanilla Extract', 'Vanilla Extract', '2 drops (optional)', NULL, NULL),
    ('r041', 0, 'Gin', 'Gin', '2/3', 60, NULL),
    ('r041', 1, 'Orange Curacao', 'Orange Curacao', '1/6', 15, NULL),
    ('r041', 2, 'Lime Juice', 'Lime Juice', '1 teaspoonful', NULL, 'Rose''s'),
    ('r041', 3, 'Angostura Bitters', 'Angostura Bitters', '1 dash', NULL, NULL),
    ('r041', 4, 'Orange Bitters', 'Orange Bitters', '1 dash', NULL, NULL),
    ('r042', 0, 'Cointreau', 'Cointreau', '2/3', 60, NULL),
    ('r042', 1, 'Brandy', 'Brandy', '1/6', 15, NULL),
    ('r042', 2, 'Creme De Menthe', 'Creme De Menthe', '1/6', 15, NULL),
    ('r043', 0, 'Dry Gin', 'Dry Gin', '1/2', 45, NULL),
    ('r043', 1, 'Cointreau', 'Cointreau', '1/4', 23, NULL),
    ('r043', 2, 'Lemon Juice', 'Lemon Juice', '1/4', 23, NULL),
    ('r044', 0, 'Cointreau', 'Cointreau', '1/3', 30, 'Triple sec'),
    ('r044', 1, 'Brandy', 'Brandy', '1/3', 30, NULL),
    ('r044', 2, 'Lemon Juice', 'Lemon Juice', '1/3', 30, NULL),
    ('r045', 0, 'Cognac', 'Cognac', '1 jigger', 45, NULL),
    ('r045', 1, 'Cointreau', 'Cointreau', '1 pony', 30, NULL),
    ('r045', 2, 'Lime Juice', 'Lime Juice', 'juice of 1 lime', NULL, NULL),
    ('r046', 0, 'Calvados', 'Calvados', '2/3', 60, NULL),
    ('r046', 1, 'Gin', 'Gin', '1/3', 30, NULL),
    ('r046', 2, 'Grenadine', 'Grenadine', '1 teaspoonful', NULL, NULL),
    ('r046', 3, 'Absinthe', 'Absinthe', '2 dashes', 2, 'or Anis del Oso'),
    ('r047', 0, 'Gin', 'Gin', '2 jiggers', 90, '''Gordon water'''),
    ('r047', 1, 'Lemon Juice', 'Lemon Juice', '1 part', NULL, NULL),
    ('r047', 2, 'Sugar', 'Sugar', 'a spoonful powdered', NULL, NULL),
    ('r047', 3, 'Champagne', 'Champagne', 'fill', NULL, NULL),
    ('r048', 0, 'Gin', 'Gin', '2/3', 60, NULL),
    ('r048', 1, 'Lemon Juice', 'Lemon Juice', '1/3', 30, NULL),
    ('r048', 2, 'Sugar', 'Sugar', '1 spoonful powdered', NULL, NULL),
    ('r048', 3, 'Champagne', 'Champagne', 'fill', NULL, NULL),
    ('r049', 0, 'Dry Gin', 'Dry Gin', '1/2', 45, NULL),
    ('r049', 1, 'Italian Vermouth', 'Italian Vermouth', '1/2', 45, NULL),
    ('r049', 2, 'Fernet Branca', 'Fernet Branca', '2 dashes', 2, NULL),
    ('r049', 3, 'Orange Peel', 'Orange Peel', 'squeezed on top', NULL, NULL),
    ('r050', 0, 'Dry Gin', 'Dry Gin', '1/4 wine glass', 15, NULL),
    ('r050', 1, 'Kina Lillet', 'Lillet Blanc', '1/4 wine glass', 15, NULL),
    ('r050', 2, 'Cointreau', 'Cointreau', '1/4 wine glass', 15, NULL),
    ('r050', 3, 'Lemon Juice', 'Lemon Juice', '1/4 wine glass', 15, NULL),
    ('r050', 4, 'Absinthe', 'Absinthe', '1 dash', 1, NULL),
    ('r051', 0, 'Plymouth Gin', 'Plymouth Gin', '1/2', 45, 'Coates'' Plymouth'),
    ('r051', 1, 'Lime Cordial', 'Lime Cordial', '1/2', 45, 'Rose''s Lime Juice Cordial'),
    ('r052', 0, 'Bourbon', 'Bourbon', '1/3', 30, NULL),
    ('r052', 1, 'Campari', 'Campari', '1/3', 30, NULL),
    ('r052', 2, 'Italian Vermouth', 'Italian Vermouth', '1/3', 30, NULL),
    ('r053', 0, 'Bacardi Rum', 'Bacardi Rum', '1 drink', NULL, NULL),
    ('r053', 1, 'Lime Juice', 'Lime Juice', 'juice of 1/2 lime', NULL, NULL),
    ('r053', 2, 'Gum Syrup', 'Gum Syrup', '2 dashes', 2, NULL),
    ('r054', 0, 'Bacardi Rum', 'Bacardi Rum', '3/8 gill', 53, NULL),
    ('r054', 1, 'Lime Juice', 'Lime Juice', '1/8 gill', 18, 'fresh'),
    ('r054', 2, 'Grenadine', 'Grenadine', 'to sweeten', NULL, NULL),
    ('r055', 0, 'Bacardi Rum', 'Bacardi Rum', '2 oz', 60, NULL),
    ('r055', 1, 'Grapefruit Juice', 'Grapefruit Juice', '1 teaspoon', 5, NULL),
    ('r055', 2, 'Maraschino', 'Maraschino', '1 teaspoon', 5, NULL),
    ('r055', 3, 'Lime Juice', 'Lime Juice', 'juice of 1/2 lime', NULL, NULL),
    ('r056', 0, 'Rum', 'Rum', '1 part', NULL, 'Bacardi'),
    ('r056', 1, 'Sugar', 'Sugar', '1 teaspoon', NULL, NULL),
    ('r056', 2, 'Lemon', 'Lemon', 'one half', NULL, 'printed lemon; Cuban limon is usually a lime'),
    ('r056', 3, 'Mint', 'Mint', 'leaves', NULL, NULL),
    ('r056', 4, 'Soda Water', 'Soda Water', 'top', NULL, 'seltzer'),
    ('r057', 0, 'Rye Whiskey', 'Rye Whiskey', '1/3 jigger', 15, NULL),
    ('r057', 1, 'Cognac', 'Cognac', '1/3 jigger', 15, NULL),
    ('r057', 2, 'Italian Vermouth', 'Italian Vermouth', '1/3 jigger', 15, NULL),
    ('r057', 3, 'Benedictine', 'Benedictine', '1/2 teaspoon', NULL, NULL),
    ('r057', 4, 'Peychaud''s Bitters', 'Peychaud''s Bitters', '1 dash', NULL, NULL),
    ('r057', 5, 'Angostura Bitters', 'Angostura Bitters', '1 dash', NULL, NULL),
    ('r057', 6, 'Lemon Peel', 'Lemon Peel', 'a slice twisted over', NULL, NULL),
    ('r058', 0, 'Rye Whiskey', 'Rye Whiskey', '1 jigger', 45, NULL),
    ('r058', 1, 'Italian Vermouth', 'Italian Vermouth', '1/2 jigger', 23, NULL),
    ('r058', 2, 'Cherry Brandy', 'Cherry Brandy', '1 to 2 tsp', NULL, NULL),
    ('r058', 3, 'Absinthe', 'Absinthe', '1/2 tsp', NULL, 'or Pernod'),
    ('r058', 4, 'Lemon Or Lime Peel', 'Lemon', 'a curl', NULL, NULL),
    ('r059', 0, 'Whiskey', 'Whiskey', '1 wine-glass', 60, 'or liquor as desired'),
    ('r059', 1, 'Lemon Juice', 'Lemon Juice', 'juice of 1/2 a lemon', NULL, NULL),
    ('r059', 2, 'Sugar', 'Sugar', '1/2 tea-spoon', NULL, 'dissolved in water'),
    ('r059', 3, 'Red Wine', 'Red Wine', 'a dash', NULL, 'claret'),
    ('r060', 0, 'Whiskey', 'Whiskey', '1 jigger', 45, 'or brandy or gin'),
    ('r060', 1, 'Lemon Juice', 'Lemon Juice', 'juice of 1/2 lemon', NULL, NULL),
    ('r060', 2, 'Sugar', 'Sugar', '1 teaspoonful bar sugar', NULL, NULL),
    ('r060', 3, 'Red Wine', 'Red Wine', 'a dash', NULL, 'claret'),
    ('r061', 0, 'Vodka', 'Vodka', '1 1/2 oz', 45, NULL),
    ('r061', 1, 'Tomato Juice', 'Tomato Juice', '1 1/2 oz', 45, NULL),
    ('r061', 2, 'Worcestershire Sauce', 'Worcestershire Sauce', '1 teaspoon', 5, 'Lea & Perrins'),
    ('r061', 3, 'Lime Juice', 'Lime Juice', 'juice of 1/2', NULL, 'Spanish text says limon verde'),
    ('r062', 0, 'Vodka', 'Vodka', 'half', NULL, NULL),
    ('r062', 1, 'Tomato Juice', 'Tomato Juice', 'half', NULL, NULL),
    ('r063', 0, 'Gin', 'Gin', '1 part', NULL, NULL),
    ('r063', 1, 'Sweet Vermouth', 'Sweet Vermouth', '1 part', NULL, NULL),
    ('r063', 2, 'Campari', 'Campari', '1 part', NULL, NULL),
    ('r064', 0, 'Campari', 'Campari', NULL, NULL, NULL),
    ('r064', 1, 'Sweet Vermouth', 'Sweet Vermouth', NULL, NULL, NULL),
    ('r064', 2, 'Soda Water', 'Soda Water', NULL, NULL, NULL),
    ('r064', 3, 'Lemon Or Orange', 'Lemon', 'slice or twist', NULL, NULL),
    ('r065', 0, 'Campari', 'Campari', 'equal part', NULL, NULL),
    ('r065', 1, 'Sweet Vermouth', 'Sweet Vermouth', 'equal part', NULL, NULL),
    ('r065', 2, 'Prosecco', 'Prosecco', 'equal part', NULL, NULL),
    ('r066', 0, 'Gin', 'Gin', 'equal part', NULL, 'Plymouth originally'),
    ('r066', 1, 'Lillet Blanc', 'Lillet Blanc', 'equal part', NULL, NULL),
    ('r066', 2, 'Suze', 'Suze', 'equal part', NULL, NULL),
    ('r066', 3, 'Grapefruit Peel', 'Grapefruit Peel', 'twist', NULL, NULL),
    ('r067', 0, 'Rum', 'Rum', NULL, NULL, 'Jamaican; later blends'),
    ('r067', 1, 'Lime Juice', 'Lime Juice', NULL, NULL, NULL),
    ('r067', 2, 'Orgeat', 'Orgeat', NULL, NULL, NULL),
    ('r067', 3, 'Orange Curacao', 'Orange Curacao', NULL, NULL, NULL),
    ('r067', 4, 'Rock Candy Syrup', 'Rich Simple Syrup', NULL, NULL, NULL),
    ('r068', 0, 'Campari', 'Campari', '1 1/2 oz', 45, NULL),
    ('r068', 1, 'Jamaican Rum', 'Jamaican Rum', '3/4 oz', 23, 'aged, e.g. Smith & Cross'),
    ('r068', 2, 'Orange Curacao', 'Orange Curacao', '1/2 oz', 15, NULL),
    ('r068', 3, 'Orgeat', 'Orgeat', '3/4 oz', 23, NULL),
    ('r068', 4, 'Lime Juice', 'Lime Juice', '1 oz', 30, NULL),
    ('r069', 0, 'Blackstrap Rum', 'Blackstrap Rum', NULL, NULL, 'dark rum in the 1989 printing'),
    ('r069', 1, 'Campari', 'Campari', NULL, NULL, NULL),
    ('r069', 2, 'Pineapple Juice', 'Pineapple Juice', NULL, NULL, NULL),
    ('r069', 3, 'Lime Juice', 'Lime Juice', NULL, NULL, NULL),
    ('r069', 4, 'Demerara Syrup', 'Demerara Syrup', NULL, NULL, NULL),
    ('r070', 0, 'Rum', 'Rum', NULL, NULL, NULL),
    ('r070', 1, 'Cream Of Coconut', 'Cream Of Coconut', NULL, NULL, NULL),
    ('r070', 2, 'Pineapple Juice', 'Pineapple Juice', NULL, NULL, NULL),
    ('r071', 0, 'Tequila', 'Tequila', '1 oz', 30, NULL),
    ('r071', 1, 'Creme De Cassis', 'Creme De Cassis', '1/2 oz', 15, NULL),
    ('r071', 2, 'Lime', 'Lime', '1/2, squeezed, shell dropped in', NULL, NULL),
    ('r071', 3, 'Ginger Ale', 'Ginger Ale', 'fill', NULL, NULL),
    ('r072', 0, 'Tequila', 'Tequila', '1 oz', 30, 'Sierra'),
    ('r072', 1, 'Triple Sec', 'Triple Sec', 'a dash', NULL, NULL),
    ('r072', 2, 'Lime Or Lemon Juice', 'Lime', 'juice of 1/2', NULL, NULL),
    ('r073', 0, 'Tequila', 'Tequila', NULL, NULL, NULL),
    ('r073', 1, 'Lime Juice', 'Lime Juice', NULL, NULL, NULL),
    ('r073', 2, 'Agave Nectar', 'Agave Nectar', NULL, NULL, NULL),
    ('r074', 0, 'Reposado Tequila', 'Reposado Tequila', '45 ml', 45, NULL),
    ('r074', 1, 'Mezcal', 'Mezcal', '15 ml', 15, NULL),
    ('r074', 2, 'Agave Syrup', 'Agave Syrup', '7.5 ml', 8, NULL),
    ('r074', 3, 'Angostura Bitters', 'Angostura Bitters', '1 dash', NULL, NULL),
    ('r074', 4, 'Orange Peel', 'Orange Peel', 'flamed', NULL, NULL),
    ('r075', 0, 'Mezcal', 'Mezcal', '1 1/2 oz', 45, NULL),
    ('r075', 1, 'Aperol', 'Aperol', '3/4 oz', 23, NULL),
    ('r075', 2, 'Maraschino', 'Maraschino', '1/2 oz', 15, NULL),
    ('r075', 3, 'Lime Juice', 'Lime Juice', '3/4 oz', 23, NULL),
    ('r075', 4, 'Grapefruit Peel', 'Grapefruit Peel', 'twist', NULL, NULL),
    ('r076', 0, 'Mezcal', 'Mezcal', 'equal part', NULL, NULL),
    ('r076', 1, 'Yellow Chartreuse', 'Yellow Chartreuse', 'equal part', NULL, NULL),
    ('r076', 2, 'Aperol', 'Aperol', 'equal part', NULL, NULL),
    ('r076', 3, 'Lime Juice', 'Lime Juice', 'equal part', NULL, NULL),
    ('r077', 0, 'Bourbon', 'Bourbon', '2 oz', 60, NULL),
    ('r077', 1, 'Lemon Juice', 'Lemon Juice', '3/4 oz', 23, NULL),
    ('r077', 2, 'Honey Syrup', 'Honey Syrup', '3/4 oz', 23, NULL),
    ('r078', 0, 'Scotch Whisky', 'Scotch Whisky', NULL, NULL, NULL),
    ('r078', 1, 'Ginger', 'Ginger', NULL, NULL, NULL),
    ('r078', 2, 'Honey Syrup', 'Honey Syrup', NULL, NULL, NULL),
    ('r078', 3, 'Lemon Juice', 'Lemon Juice', NULL, NULL, NULL),
    ('r079', 0, 'Bourbon', 'Bourbon', 'equal part', NULL, NULL),
    ('r079', 1, 'Aperol', 'Aperol', 'equal part', NULL, 'originally Campari'),
    ('r079', 2, 'Amaro Nonino', 'Amaro Nonino', 'equal part', NULL, NULL),
    ('r079', 3, 'Lemon Juice', 'Lemon Juice', 'equal part', NULL, NULL),
    ('r080', 0, 'Rye Whiskey', 'Rye Whiskey', '2 oz', 60, NULL),
    ('r080', 1, 'Punt E Mes', 'Punt E Mes', '1/2 oz', 15, NULL),
    ('r080', 2, 'Maraschino', 'Maraschino', '1/2 oz', 15, NULL),
    ('r081', 0, 'Rye Whiskey', 'Rye Whiskey', '60 ml', 60, NULL),
    ('r081', 1, 'Sweet Vermouth', 'Sweet Vermouth', '20 ml', 20, NULL),
    ('r081', 2, 'Cynar', 'Cynar', '15 ml', 15, NULL),
    ('r081', 3, 'Cherry', 'Cherry', 'brandied', NULL, NULL),
    ('r082', 0, 'Angostura Bitters', 'Angostura Bitters', 'base spirit', NULL, NULL),
    ('r083', 0, 'Gin', 'Gin', '1 1/2 oz', 45, NULL),
    ('r083', 1, 'Simple Syrup', 'Simple Syrup', '1 oz', 30, NULL),
    ('r083', 2, 'Lemon Juice', 'Lemon Juice', '3/4 oz', 23, NULL),
    ('r083', 3, 'Angostura Bitters', 'Angostura Bitters', '2 dashes', NULL, NULL),
    ('r084', 0, 'Vodka', 'Vodka', '2 oz', 60, 'Smirnoff'),
    ('r084', 1, 'Ginger Beer', 'Ginger Beer', NULL, NULL, 'Cock ''n'' Bull'),
    ('r084', 2, 'Lemon Or Lime', 'Lemon', 'a squeeze', NULL, 'the 1948 account says lemon; modern uses lime'),
    ('r085', 0, 'Vodka', 'Vodka', NULL, NULL, 'citrus vodka in the IBA spec'),
    ('r085', 1, 'Cointreau', 'Cointreau', NULL, NULL, NULL),
    ('r085', 2, 'Cranberry Juice', 'Cranberry Juice', NULL, NULL, NULL),
    ('r085', 3, 'Lime Juice', 'Lime Juice', NULL, NULL, NULL),
    ('r086', 0, 'Vodka', 'Vodka', NULL, NULL, NULL),
    ('r086', 1, 'Lemon Juice', 'Lemon Juice', NULL, NULL, NULL),
    ('r086', 2, 'Sugar', 'Sugar', 'rim', NULL, NULL),
    ('r087', 0, 'Vodka', 'Vodka', NULL, NULL, NULL),
    ('r087', 1, 'Espresso', 'Espresso', NULL, NULL, NULL),
    ('r087', 2, 'Coffee Liqueur', 'Coffee Liqueur', NULL, NULL, NULL),
    ('r088', 0, 'Vanilla Vodka', 'Vanilla Vodka', NULL, NULL, NULL),
    ('r088', 1, 'Passoa', 'Passoa', NULL, NULL, NULL),
    ('r088', 2, 'Passion Fruit Puree', 'Passion Fruit Puree', NULL, NULL, NULL),
    ('r088', 3, 'Vanilla Sugar', 'Sugar', NULL, NULL, NULL),
    ('r089', 0, 'Gin', 'Gin', 'three measures', NULL, 'Gordon''s'),
    ('r089', 1, 'Vodka', 'Vodka', 'one measure', NULL, NULL),
    ('r089', 2, 'Kina Lillet', 'Lillet Blanc', 'half a measure', NULL, NULL),
    ('r090', 0, 'Dry Gin', 'Dry Gin', NULL, NULL, NULL),
    ('r090', 1, 'Lemon Juice', 'Lemon Juice', NULL, NULL, NULL),
    ('r090', 2, 'Sugar Syrup', 'Sugar Syrup', NULL, NULL, NULL),
    ('r090', 3, 'Creme De Mure', 'Creme De Mure', NULL, NULL, NULL),
    ('r090', 4, 'Crushed Ice', 'Crushed Ice', NULL, NULL, NULL),
    ('r091', 0, 'Prosecco', 'Prosecco', NULL, NULL, NULL),
    ('r091', 1, 'White Peach Puree', 'White Peach Purée', NULL, NULL, NULL),
    ('r092', 0, 'Prosecco', 'Prosecco', '3 parts', NULL, NULL),
    ('r092', 1, 'Aperol', 'Aperol', '2 parts', NULL, NULL),
    ('r092', 2, 'Soda Water', 'Soda Water', '1 part', NULL, NULL),
    ('r092', 3, 'Orange', 'Orange', 'slice', NULL, NULL),
    ('r093', 0, 'Gin', 'Gin', 'equal part', NULL, NULL),
    ('r093', 1, 'Green Chartreuse', 'Green Chartreuse', 'equal part', NULL, NULL),
    ('r093', 2, 'Maraschino', 'Maraschino', 'equal part', NULL, NULL),
    ('r093', 3, 'Lime Juice', 'Lime Juice', 'equal part', NULL, NULL),
    ('r094', 0, 'Pisco', 'Pisco', NULL, NULL, NULL),
    ('r094', 1, 'Lime Juice', 'Lime Juice', NULL, NULL, NULL),
    ('r094', 2, 'Sugar Syrup', 'Sugar Syrup', NULL, NULL, NULL),
    ('r094', 3, 'Egg White', 'Egg White', NULL, NULL, 'added late 1920s'),
    ('r094', 4, 'Angostura Bitters', 'Angostura Bitters', NULL, NULL, 'added late 1920s');

INSERT INTO public.sources (key, kind, title, author, year, edition, city, rights, euvs_url, archive_url, url)
SELECT key, kind, title, author, year, edition, city, rights, euvs_url, archive_url, url FROM src_in
ON CONFLICT (key) DO NOTHING;

-- Matched to the catalog classic by name; a classic that isn't here is skipped.
INSERT INTO public.source_recipes (source_id, item_id, printed_name, page_label, page_url, relation, method, quote, notes)
SELECT s.id, c.id, r.printed_name, r.page_label, r.page_url, r.relation, r.method, r.quote, r.notes
  FROM recipe_in r
  JOIN public.sources s ON s.key = r.source
  JOIN public.items c ON c.is_catalog AND lower(c.name) = lower(r.drink)
 WHERE NOT EXISTS (
    SELECT 1 FROM public.source_recipes x WHERE x.source_id = s.id AND x.item_id = c.id AND x.printed_name IS NOT DISTINCT FROM r.printed_name);

CREATE TEMP TABLE "recipe_ids" AS
SELECT r.key, x.id
  FROM recipe_in r
  JOIN public.sources s ON s.key = r.source
  JOIN public.items c ON c.is_catalog AND lower(c.name) = lower(r.drink)
  JOIN public.source_recipes x ON x.source_id = s.id AND x.item_id = c.id AND x.printed_name IS NOT DISTINCT FROM r.printed_name;

-- Each line points at the shared ingredient its name means (any spelling or alias).
INSERT INTO public.source_recipe_lines (source_recipe_id, sort_order, ingredient_text, ingredient_item_id, amount_text, amount_ml, note)
SELECT ids.id, l.position, l.ingredient, public.resolve_ingredient(l.resolve_as), l.amount_text, l.ml, l.note
  FROM line_in l JOIN recipe_ids ids ON ids.key = l.recipe
 WHERE NOT EXISTS (SELECT 1 FROM public.source_recipe_lines x WHERE x.source_recipe_id = ids.id);

DROP TABLE "src_in", "recipe_in", "line_in", "recipe_ids";

SELECT private.refresh_ingredient_pairs();
