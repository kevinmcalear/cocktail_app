-- Discover, a page at a time. Until now the app downloaded every bar drink
-- in the area (near New York: 321 bars, 4,320 drinks) and filtered them on
-- the phone, because a drink's styles and spirits were only worked out there
-- (lib/drinkStyles.ts). Here they're worked out once per drink and kept in
-- discover_drink_facts, so:
--
--   discover_list: the matching drinks in an area (or at one bar), best
--     first, a page at a time (keyset), with the totals on the first page.
--   discover_bars: the bars in an area, or in a map tile's box, each with
--     how many of its drinks match: the map's pins, a tile at a time.
--
-- Both run as the caller. discover_drink_facts' only policy is "the caller
-- can select the drink", so neither returns a drink the caller couldn't
-- already see. discover_drinks (20261008330000) stays for app builds that
-- still call it.
--
-- Facts stay fresh through a queue: triggers mark a drink when it, its
-- lines, flavour, pictures, menus or its bar's page visibility change, and
-- a job every 30 seconds rebuilds the marked ones. A nightly full rebuild
-- catches what no trigger sees (an ingredient renamed, a classic renamed).
-- ponytail: up to 30 s before a change shows on Discover; a commit-time
-- rebuild is the upgrade if that ever matters.

-- --- Folding, as lib/discover.ts foldName ---

CREATE FUNCTION "private"."discover_fold_ws"("p_text" "text")
    RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT btrim(regexp_replace(public.discover_fold(p_text), '\s+', ' ', 'g'));
$$;

-- --- Styles and spirits, as lib/drinkStyles.ts stylesOf / spiritsOf ---

-- The same rules in SQL, applied in refresh_discover_facts. supabase/tests/discover-index.test.mjs runs both
-- over every local bar drink and fails on any difference, so a rule changed
-- in one place must change in the other. JS \b is \y here; the folded text
-- has no accents, so the classes agree.
CREATE TABLE "private"."discover_style_rules" (
    "ord" smallint PRIMARY KEY,
    "id" "text" NOT NULL UNIQUE,
    -- Folded catalog classics that make a drink this style (riff_of_id).
    "classics" "text"[] NOT NULL,
    "name_re" "text",
    "text_re" "text",
    -- "a twist on the Gimlet", "Negroni variation": the description naming one of the classics.
    "riff_re" "text"
);

CREATE TABLE "private"."discover_spirit_rules" (
    "ord" smallint PRIMARY KEY,
    "id" "text" NOT NULL UNIQUE,
    "match_re" "text" NOT NULL
);

INSERT INTO "private"."discover_style_rules" ("ord", "id", "classics", "name_re", "text_re") VALUES
    (1, 'martini', ARRAY['Martini', 'Vesper', 'Tuxedo'], '(?<!espresso |porn ?star |pornstar |chocolate |appletini )\ymartini\y|\ygibson\y|\yvesper\y', NULL),
    (2, 'old-fashioned', ARRAY['Old Fashioned', 'Oaxaca Old Fashioned', 'Sazerac'], 'old[- ]fashioned|sazerac', NULL),
    (3, 'negroni', ARRAY['Negroni', 'White Negroni', 'Boulevardier', 'Sbagliato', 'Americano', 'Milano Torino'], 'negroni|boulevardier|sbagliato|americano\y', NULL),
    (4, 'manhattan', ARRAY['Manhattan', 'Rob Roy', 'Brooklyn', 'Red Hook', 'Little Italy', 'Bobby Burns', 'Remember the Maine', 'Martinez', 'Vieux Carré', 'Hanky Panky'], 'manhattan|rob roy|vieux carr|martinez', NULL),
    (5, 'margarita', ARRAY['Margarita', 'Tommy''s Margarita'], 'margarita', NULL),
    (6, 'daiquiri', ARRAY['Daiquiri', 'Hemingway Daiquiri'], 'daiquiri', NULL),
    (7, 'mojito', ARRAY['Mojito'], 'mojito', NULL),
    (8, 'espresso-martini', ARRAY['Espresso Martini'], 'espresso|coffee|carajillo', NULL),
    (9, 'sour', ARRAY['Whiskey Sour', 'Pisco Sour', 'New York Sour', 'Trinidad Sour', 'Clover Club', 'White Lady', 'Gold Rush', 'Bee''s Knees', 'Penicillin', 'Sidecar', 'Gimlet', 'Pegu Club', 'Aviation', 'Brandy Crusta', 'Lemon Drop', 'Jack Rose', 'Last Word', 'Naked and Famous', 'Paper Plane', 'Division Bell', 'Corpse Reviver #2', 'Bramble', 'Fitzgerald'], '\ysour\y|gimlet|sidecar|daisy|\ycrusta\y', NULL),
    (10, 'highball', ARRAY['Moscow Mule', 'Paloma', 'Tom Collins', 'El Diablo', 'Ramos Gin Fizz'], 'highball|collins|\ymule\y|\yfizz\y|rickey|\ybuck\y|paloma|& tonic|and tonic|\yg&t\y', NULL),
    (11, 'spritz', ARRAY['Aperol Spritz', 'French 75', 'Bellini'], 'spritz|french 75|bellini|royale?\y', NULL),
    (12, 'tiki', ARRAY['Mai Tai', 'Bitter Mai Tai', 'Jungle Bird', 'Piña Colada', 'Trinidad Sour'], 'tiki|zombie|mai tai|colada|swizzle|grog|painkiller|hurricane|scorpion', '\ytiki\y'),
    (13, 'julep', ARRAY['Mint Julep', 'Caipirinha', 'Ti'' Punch'], 'julep|smash|caipirinha|caipiroska', NULL),
    (14, 'zero-proof', ARRAY[]::"text"[], 'zero[- ]proof|alcohol[- ]free|non[- ]alcoholic|\yna\y', 'zero[- ]proof|alcohol[- ]free|non[- ]?alcoholic|spirit[- ]free|low[- ]abv|low[- ]alcohol|no[- ]abv');

-- Classics folded, and one pattern per style for riffsOn over all of them.
UPDATE "private"."discover_style_rules" r SET
    "classics" = f.folded,
    "riff_re" = CASE WHEN cardinality(f.folded) > 0 THEN
        '(twist|take|riff|spin|play|variation|version|variant|reworking|reimagining|interpretation|homage)s? on (a |an |the |the classic |a classic )?(' || f.alts || ')\y'
        || '|\y(' || f.alts || ')[- ](variation|riff|twist|variant|style)'
        || '|\y(house|dirty|wet|dry|reverse|smoked|frozen|clarified|milk[- ]punch) (' || f.alts || ')\y'
    END
FROM (
    SELECT s.ord,
           coalesce(array_agg("private"."discover_fold_ws"(c) ORDER BY n) FILTER (WHERE c IS NOT NULL), '{}') AS folded,
           string_agg(regexp_replace("private"."discover_fold_ws"(c), '([.*+?^${}()|\[\]\\])', '\\\1', 'g'), '|' ORDER BY n) AS alts
    FROM "private"."discover_style_rules" s
    LEFT JOIN LATERAL unnest(s.classics) WITH ORDINALITY u(c, n) ON true
    GROUP BY s.ord
) f
WHERE f.ord = r.ord;

INSERT INTO "private"."discover_spirit_rules" ("ord", "id", "match_re") VALUES
    (1, 'gin', '\ygin\y|genever|jenever|london dry|old tom|tanqueray|hendrick|beefeater|plymouth|monkey 47|\yroku\y|sipsmith'),
    (2, 'whiskey', 'whisk(e)?y|bourbon|\yrye\y|scotch|single malt|islay|laphroaig|ardbeg|lagavulin|talisker|hibiki|yamazaki|nikka|toki\y|jameson|highland park|macallan|buffalo trace|wild turkey|rittenhouse|woodford|makers mark|maker''s mark'),
    (3, 'agave', 'tequila|mezcal|sotol|raicilla|bacanora|agave spirit|\y(blanco|reposado|a[nñ]ejo)\y(?! rum)|espad[ií]n|tobal[aá]'),
    (4, 'rum', '\yrum\y|\yrhum\y|\yron\y|cacha[cç]a|agricole|clairin|arrack|grogue'),
    (5, 'brandy', 'brandy|cognac|armagnac|calvados|pisco|grappa|applejack|eau[- ]de[- ]vie|singani|hennessy|r[eé]my martin|martell|courvoisier'),
    (6, 'vodka', 'vodka|grey goose|belvedere|ketel one|absolut|eristoff'),
    (7, 'sake', '\ysake\y|shochu|soju|baijiu|awamori|umeshu|junmai|ginjo'),
    (8, 'aperitivo', 'campari|aperol|amaro|fernet|cynar|suze|aperitiv|gentian|vermouth|chartreuse|montenegro|averna|braulio|nonino');

-- --- The facts ---

CREATE TABLE "public"."discover_drink_facts" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "bar_profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL,
    "styles" "text"[] NOT NULL DEFAULT '{}',
    "spirits" "text"[] NOT NULL DEFAULT '{}',
    -- Tasting notes at 0.4 or more (the twelve dimensions of 20261009600000, less strong), from a profile covering at least half the spec, as discover_drinks.
    "notes" "text"[] NOT NULL DEFAULT '{}',
    -- Folded name, the classic it's a version of, description and the lines an ordinary reader sees: what search matches.
    "haystack" "text" NOT NULL,
    -- lib/discoverDrinks.ts filterDrinks' order before the search: menu (on now 0, undated 1, past 2) x 4, + 2 with no picture, + 1 not starting with a letter.
    "base_rank" smallint NOT NULL,
    "refreshed_at" timestamp with time zone NOT NULL DEFAULT "now"()
);

CREATE INDEX "discover_drink_facts_bar_idx" ON "public"."discover_drink_facts" ("bar_profile_id", "base_rank", "name");

ALTER TABLE "public"."discover_drink_facts" ENABLE ROW LEVEL SECURITY;

-- A drink's facts are readable exactly when the drink is (items_select applies inside).
CREATE POLICY "discover_drink_facts_select" ON "public"."discover_drink_facts" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "discover_drink_facts"."item_id"));

REVOKE ALL ON "public"."discover_drink_facts" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."discover_drink_facts" TO "authenticated";
GRANT ALL ON "public"."discover_drink_facts" TO "service_role";

-- Rebuilds the facts for the given drinks (all of them when NULL). A drink
-- that's no longer a public bar's drink loses its row. Ingredient lines
-- count only where an ordinary signed-in reader sees them
-- (app_recipe_presentation): a seeded drink at a bar whose page is open,
-- or a drink published with its spec.
CREATE FUNCTION "private"."refresh_discover_facts"("p_ids" "uuid"[] DEFAULT NULL)
    RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM public.discover_drink_facts f
    WHERE (p_ids IS NULL OR f.item_id = ANY (p_ids))
      AND NOT EXISTS (
          SELECT 1 FROM public.items i JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.kind = 'bar'
          WHERE i.id = f.item_id AND i.item_type = 'cocktail' AND i.bar_id IS NULL
      );

    -- Set-wise, one rule at a time over every drink (the LATERALs keep each
    -- rule's patterns hot): Postgres caches 32 compiled patterns, and drink by
    -- drink the 45 rules would recompile every pattern on every row.
    INSERT INTO public.discover_drink_facts AS t ("item_id", "bar_profile_id", "name", "styles", "spirits", "notes", "haystack", "base_rank", "refreshed_at")
    WITH src AS MATERIALIZED (
        SELECT i.id, i.name, i.description, i.origin_bar_profile_id, rf.name AS riff_name,
               CASE WHEN (i.created_by IS NULL AND coalesce(ob.page_visibility, 'description') = 'open') OR ps.id IS NOT NULL THEN (
                   SELECT array_agg(n.name ORDER BY r.sort_order)
                   FROM public.recipes r JOIN public.items n ON n.id = r.ingredient_item_id
                   WHERE r.recipe_item_id = i.id
               ) END AS lines
        FROM public.items i
        JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.kind = 'bar'
        LEFT JOIN public.bars ob ON ob.id = p.bar_id
        LEFT JOIN public.items rf ON rf.id = i.riff_of_id
        LEFT JOIN private.published_listing ps ON ps.id = i.id AND ps.effective_mode = 'spec'
        WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL
          AND (p_ids IS NULL OR i.id = ANY (p_ids))
    ), folded AS MATERIALIZED (
        -- As lib/drinkStyles.ts: the folded name, description, classic, and lines joined by " | ".
        SELECT src.*,
               private.discover_fold_ws(src.name) AS n,
               private.discover_fold_ws(src.description) AS t,
               private.discover_fold_ws(src.riff_name) AS r,
               coalesce((SELECT string_agg(private.discover_fold_ws(x), ' | ' ORDER BY o) FROM unnest(src.lines) WITH ORDINALITY u(x, o)), '') AS i,
               coalesce(cardinality(src.lines), 0) > 0 AS has_lines
        FROM src
    ), d AS MATERIALIZED (
        -- The builds' ingredient tests (stylesOf's CITRUS, SWEET, LONG, BUBBLES, APERITIVO).
        SELECT f.*,
               f.i ~ '\y(lemon|lime|grapefruit|yuzu|citrus|sudachi|calamansi|verjus)\y(?! (twist|peel|zest|wheel|wedge|coin|leaf|oil))|\yacid\y' AS citrus,
               f.i ~ 'syrup|sugar|honey|agave nectar|orgeat|grenadine|cordial|liqueur|triple sec|cointreau|cura[cç]ao|maraschino|falernum|oleo' AS sweet,
               f.i ~ 'soda|\ytonic\y|ginger beer|ginger ale|\ycola\y|seltzer|sparkling water|lemonade|kombucha' AS long,
               f.i ~ 'champagne|prosecco|cava|cremant|sparkling wine|\ysekt\y|lambrusco|franciacorta|pet[- ]nat' AS bubbles,
               f.i ~ 'aperol|campari|aperitiv|select aperitivo|bitter|vermouth|lillet|cocchi|amaro|suze' AS aperitivo,
               f.i ~ 'espresso|coffee|cold brew' AS coffee,
               f.i ~ 'cream|milk' AS cream,
               f.i ~ 'soda' AS soda
        FROM folded f
    ), styled AS (
        -- stylesOf: by the classic it's a version of, its name, its description, or its build (only with lines).
        SELECT x.id, array_agg(s.id ORDER BY s.ord) AS styles
        FROM private.discover_style_rules s
        CROSS JOIN LATERAL (
            SELECT d.id FROM d
            WHERE (d.r <> '' AND d.r = ANY (s.classics))
               OR (s.name_re IS NOT NULL AND d.n ~ s.name_re)
               OR (s.text_re IS NOT NULL AND d.t ~ s.text_re)
               OR (s.riff_re IS NOT NULL AND d.t ~ s.riff_re)
               OR (d.has_lines AND CASE s.id
                      WHEN 'espresso-martini' THEN d.coffee
                      WHEN 'sour' THEN d.citrus AND d.sweet AND NOT d.long AND NOT d.bubbles AND NOT d.cream
                      WHEN 'highball' THEN d.long AND NOT d.bubbles
                      WHEN 'spritz' THEN d.bubbles OR (d.aperitivo AND d.soda)
                      ELSE false
                   END)
        ) x
        GROUP BY x.id
    ), spirited AS (
        -- spiritsOf: from the lines when any match, else the name and description.
        SELECT x.id,
               array_agg(s.id ORDER BY s.ord) FILTER (WHERE x.from_lines) AS from_lines,
               array_agg(s.id ORDER BY s.ord) FILTER (WHERE x.from_words) AS from_words
        FROM private.discover_spirit_rules s
        CROSS JOIN LATERAL (
            SELECT d.id, d.i ~ s.match_re AS from_lines, (d.n || ' | ' || d.t) ~ s.match_re AS from_words FROM d
        ) x
        GROUP BY x.id
    )
    SELECT d.id, d.origin_bar_profile_id, d.name,
           coalesce(st.styles, '{}'),
           coalesce(sp.from_lines, sp.from_words, '{}'),
           coalesce(fl.notes, '{}'),
           private.discover_fold_ws(concat_ws(' | ', d.name, d.riff_name, d.description, array_to_string(d.lines, ' | '))),
           (CASE WHEN run.is_current THEN 0 WHEN run.end_year IS NOT NULL THEN 2 ELSE 1 END) * 4
             + CASE WHEN hero.has THEN 0 ELSE 2 END
             + CASE WHEN d.name ~ '^[[:alpha:]]' THEN 0 ELSE 1 END,
           now()
    FROM d
    LEFT JOIN styled st ON st.id = d.id
    LEFT JOIN spirited sp ON sp.id = d.id
    LEFT JOIN LATERAL (
        SELECT true AS has FROM public.item_images ii WHERE ii.item_id = d.id AND ii.angle = 'hero' LIMIT 1
    ) hero ON true
    -- Its run on its own bar's menus first, as discover_drinks.
    LEFT JOIN LATERAL (
        SELECT r.end_year, r.is_current
        FROM public.menu_drink_runs r
        WHERE r.item_id = d.id
        ORDER BY (r.profile_id = d.origin_bar_profile_id) DESC, r.is_current DESC
        LIMIT 1
    ) run ON true
    LEFT JOIN LATERAL (
        SELECT array_remove(ARRAY[
            CASE WHEN f.sweet >= 0.4 THEN 'sweet' END,
            CASE WHEN f.sour >= 0.4 THEN 'sour' END,
            CASE WHEN f.bitter >= 0.4 THEN 'bitter' END,
            CASE WHEN f.botanical >= 0.4 THEN 'botanical' END,
            CASE WHEN f.herbal >= 0.4 THEN 'herbal' END,
            CASE WHEN f.fruity >= 0.4 THEN 'fruity' END,
            CASE WHEN f.spiced >= 0.4 THEN 'spiced' END,
            CASE WHEN f.spicy >= 0.4 THEN 'spicy' END,
            CASE WHEN f.smoky >= 0.4 THEN 'smoky' END,
            CASE WHEN f.savory >= 0.4 THEN 'savory' END,
            CASE WHEN f.creamy >= 0.4 THEN 'creamy' END
        ], NULL) AS notes
        FROM public.item_flavors f
        WHERE f.item_id = d.id AND f.coverage >= 0.5
    ) fl ON true
    ON CONFLICT ("item_id") DO UPDATE SET
        "bar_profile_id" = EXCLUDED."bar_profile_id",
        "name" = EXCLUDED."name",
        "styles" = EXCLUDED."styles",
        "spirits" = EXCLUDED."spirits",
        "notes" = EXCLUDED."notes",
        "haystack" = EXCLUDED."haystack",
        "base_rank" = EXCLUDED."base_rank",
        "refreshed_at" = EXCLUDED."refreshed_at";
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION "private"."refresh_discover_facts"("uuid"[]) FROM PUBLIC, "anon", "authenticated";

-- --- Keeping them fresh ---

CREATE TABLE "private"."discover_dirty" (
    "item_id" "uuid" PRIMARY KEY,
    "marked_at" timestamp with time zone NOT NULL DEFAULT "now"()
);

CREATE FUNCTION "private"."discover_mark"("p_ids" "uuid"[])
    RETURNS void
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  INSERT INTO private.discover_dirty (item_id)
  SELECT DISTINCT x FROM unnest(p_ids) x WHERE x IS NOT NULL
  ON CONFLICT (item_id) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION "private"."discover_mark"("uuid"[]) FROM PUBLIC, "anon", "authenticated";

-- One trigger function for every table: which drink ids a row touches.
CREATE FUNCTION "private"."discover_mark_trigger"()
    RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
BEGIN
    IF TG_TABLE_NAME = 'items' THEN
        -- Only bar drinks, before or after; a drink edit that changes nothing Discover reads is still cheap to redo.
        IF (v_new IS NOT NULL AND v_new->>'item_type' = 'cocktail' AND v_new->>'bar_id' IS NULL AND v_new->>'origin_bar_profile_id' IS NOT NULL)
           OR (v_old IS NOT NULL AND v_old->>'item_type' = 'cocktail' AND v_old->>'bar_id' IS NULL AND v_old->>'origin_bar_profile_id' IS NOT NULL) THEN
            PERFORM private.discover_mark(ARRAY[(coalesce(v_new, v_old)->>'id')::uuid]);
        END IF;
    ELSIF TG_TABLE_NAME = 'recipes' THEN
        PERFORM private.discover_mark(ARRAY[(v_new->>'recipe_item_id')::uuid, (v_old->>'recipe_item_id')::uuid]);
    ELSIF TG_TABLE_NAME IN ('item_flavors', 'item_images', 'profile_menu_edition_drinks') THEN
        PERFORM private.discover_mark(ARRAY[(v_new->>'item_id')::uuid, (v_old->>'item_id')::uuid]);
    ELSIF TG_TABLE_NAME = 'profile_menu_editions' THEN
        PERFORM private.discover_mark(ARRAY(
            SELECT d.item_id FROM public.profile_menu_edition_drinks d
            WHERE d.edition_id IN ((v_new->>'id')::uuid, (v_old->>'id')::uuid)
        ));
    ELSIF TG_TABLE_NAME = 'bars' THEN
        IF v_new->>'page_visibility' IS DISTINCT FROM v_old->>'page_visibility' THEN
            PERFORM private.discover_mark(ARRAY(
                SELECT i.id FROM public.items i JOIN public.profiles p ON p.id = i.origin_bar_profile_id
                WHERE p.bar_id = (v_new->>'id')::uuid AND i.item_type = 'cocktail' AND i.bar_id IS NULL
            ));
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "discover_mark" AFTER INSERT OR UPDATE OR DELETE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();
CREATE TRIGGER "discover_mark" AFTER INSERT OR UPDATE OR DELETE ON "public"."recipes" FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();
CREATE TRIGGER "discover_mark" AFTER INSERT OR UPDATE OR DELETE ON "public"."item_flavors" FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();
CREATE TRIGGER "discover_mark" AFTER INSERT OR UPDATE OR DELETE ON "public"."item_images" FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();
CREATE TRIGGER "discover_mark" AFTER INSERT OR UPDATE OR DELETE ON "public"."profile_menu_edition_drinks" FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();
CREATE TRIGGER "discover_mark" AFTER UPDATE OR DELETE ON "public"."profile_menu_editions" FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();
CREATE TRIGGER "discover_mark" AFTER UPDATE OF "page_visibility" ON "public"."bars" FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();

-- The 30-second job: the marked drinks, oldest first, a batch at a time.
CREATE FUNCTION "private"."run_discover_dirty"("p_batch" integer DEFAULT 2000)
    RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_ids uuid[];
BEGIN
    WITH picked AS (
        SELECT d.item_id FROM private.discover_dirty d
        ORDER BY d.marked_at
        LIMIT p_batch
        FOR UPDATE SKIP LOCKED
    ), gone AS (
        DELETE FROM private.discover_dirty d USING picked WHERE d.item_id = picked.item_id
        RETURNING d.item_id
    )
    SELECT array_agg(gone.item_id) INTO v_ids FROM gone;
    IF v_ids IS NULL THEN
        RETURN 0;
    END IF;
    RETURN private.refresh_discover_facts(v_ids);
END;
$$;

REVOKE ALL ON FUNCTION "private"."run_discover_dirty"(integer) FROM PUBLIC, "anon", "authenticated";

-- --- The reads ---

-- The bars in an area, as discover_drinks (a point within p_radius_km, a
-- city and/or country, or anywhere), or in a box (p_west..p_north, as a map
-- tile; west > east crosses the antimeridian). Closed bars too, flagged, with
-- no drinks. `drinks`: how many of the bar's drinks match the filters:
-- p_styles, p_spirits and p_notes each any-of (lib/discoverDrinks.ts
-- matchesKinds), and every word of p_query in the drink's haystack or the
-- bar's name.
CREATE FUNCTION "public"."discover_bars"(
    "p_latitude" double precision DEFAULT NULL,
    "p_longitude" double precision DEFAULT NULL,
    "p_radius_km" double precision DEFAULT 10,
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_west" double precision DEFAULT NULL,
    "p_south" double precision DEFAULT NULL,
    "p_east" double precision DEFAULT NULL,
    "p_north" double precision DEFAULT NULL,
    "p_styles" "text"[] DEFAULT NULL,
    "p_spirits" "text"[] DEFAULT NULL,
    "p_notes" "text"[] DEFAULT NULL,
    "p_query" "text" DEFAULT NULL
) RETURNS TABLE(
    "id" "uuid",
    "handle" "text",
    "display_name" "text",
    "avatar_url" "text",
    "locality" "text",
    "city" "text",
    "country_code" "text",
    "latitude" double precision,
    "longitude" double precision,
    "is_closed" boolean,
    "closed_year" integer,
    "drinks" integer
)
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_point boolean := p_latitude IS NOT NULL;
    v_box boolean := p_west IS NOT NULL;
    v_radius double precision := least(greatest(coalesce(p_radius_km, 10), 0.1), 200);
    v_words text[];
    v_dlat double precision;
    v_dlng double precision;
BEGIN
    IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
        RAISE EXCEPTION 'A point needs both a latitude and a longitude.' USING ERRCODE = '22023';
    END IF;
    IF v_point AND (p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'That point is off the map.' USING ERRCODE = '22023';
    END IF;
    IF v_box AND (p_south IS NULL OR p_east IS NULL OR p_north IS NULL OR p_south > p_north) THEN
        RAISE EXCEPTION 'A box needs west, south, east and north.' USING ERRCODE = '22023';
    END IF;
    IF v_point THEN
        v_dlat := v_radius / 111.045;
        v_dlng := v_radius / (111.045 * greatest(cos(radians(p_latitude)), 0.01));
    END IF;
    SELECT array_agg(w) INTO v_words
    FROM regexp_split_to_table(private.discover_fold_ws(p_query), '\s+') w
    WHERE w <> '';

    RETURN QUERY
    WITH area AS (
        SELECT p.id, p.handle, p.display_name, p.avatar_url, p.locality, p.city, p.country_code, p.latitude, p.longitude, p.is_closed, p.closed_year,
               CASE WHEN v_words IS NOT NULL THEN private.discover_fold_ws(p.display_name) END AS folded
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public
          AND (NOT v_box OR (
              p.latitude BETWEEN p_south AND p_north
              AND CASE WHEN p_west <= p_east THEN p.longitude BETWEEN p_west AND p_east
                       ELSE p.longitude >= p_west OR p.longitude <= p_east END
          ))
          AND (v_box OR p_country_code IS NULL OR v_point OR p.country_code = upper(p_country_code))
          AND (v_box OR p_city IS NULL OR v_point OR lower(p.city) = lower(p_city))
          AND (v_box OR NOT v_point OR (
              p.latitude BETWEEN p_latitude - v_dlat AND p_latitude + v_dlat
              AND (
                  v_dlng >= 180
                  OR p.longitude BETWEEN p_longitude - v_dlng AND p_longitude + v_dlng
                  OR p.longitude >= p_longitude - v_dlng + 360
                  OR p.longitude <= p_longitude + v_dlng - 360
              )
              AND 2 * 6371.0088 * asin(least(1, sqrt(
                  power(sin(radians(p.latitude - p_latitude) / 2), 2)
                  + cos(radians(p_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_longitude) / 2), 2)
              ))) <= v_radius
          ))
    )
    SELECT a.id, a.handle, a.display_name, a.avatar_url, a.locality, a.city, a.country_code, a.latitude, a.longitude, a.is_closed, a.closed_year::integer,
           CASE WHEN a.is_closed THEN 0 ELSE coalesce(c.n, 0) END::integer
    FROM area a
    LEFT JOIN LATERAL (
        SELECT count(*) AS n
        FROM public.discover_drink_facts f
        WHERE f.bar_profile_id = a.id
          AND (p_styles IS NULL OR f.styles && p_styles)
          AND (p_spirits IS NULL OR f.spirits && p_spirits)
          AND (p_notes IS NULL OR f.notes && p_notes)
          AND (v_words IS NULL OR NOT EXISTS (
              SELECT 1 FROM unnest(v_words) w
              WHERE strpos(f.haystack, w) = 0 AND strpos(a.folded, w) = 0
          ))
    ) c ON NOT a.is_closed
    ORDER BY a.id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."discover_bars"(double precision, double precision, double precision, "text", "text", double precision, double precision, double precision, double precision, "text"[], "text"[], "text"[], "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."discover_bars"(double precision, double precision, double precision, "text", "text", double precision, double precision, double precision, double precision, "text"[], "text"[], "text"[], "text") TO "authenticated", "service_role";

-- The matching drinks at open public bars in an area (or at p_bar_id), best
-- first: with a search, name matches before the rest (+12), then base_rank,
-- then name. Pages are keyset on (rank, name, id): pass the last row's.
-- The first page (no cursor) carries the totals: how many drinks, at how
-- many bars. p_limit is at most 500.
CREATE FUNCTION "public"."discover_list"(
    "p_latitude" double precision DEFAULT NULL,
    "p_longitude" double precision DEFAULT NULL,
    "p_radius_km" double precision DEFAULT 10,
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_bar_id" "uuid" DEFAULT NULL,
    "p_styles" "text"[] DEFAULT NULL,
    "p_spirits" "text"[] DEFAULT NULL,
    "p_notes" "text"[] DEFAULT NULL,
    "p_query" "text" DEFAULT NULL,
    "p_after_rank" smallint DEFAULT NULL,
    "p_after_name" "text" DEFAULT NULL,
    "p_after_id" "uuid" DEFAULT NULL,
    "p_limit" integer DEFAULT 30
) RETURNS TABLE(
    "id" "uuid",
    "name" "text",
    "description" "text",
    "image_url" "text",
    "bar_profile_id" "uuid",
    "bar_handle" "text",
    "bar_name" "text",
    "bar_logo" "text",
    "bar_locality" "text",
    "bar_city" "text",
    "menu_run" smallint[],
    "rank" smallint,
    "total_drinks" integer,
    "total_bars" integer
)
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_point boolean := p_latitude IS NOT NULL;
    v_radius double precision := least(greatest(coalesce(p_radius_km, 10), 0.1), 200);
    v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 500);
    v_words text[];
    v_q text;
    v_dlat double precision;
    v_dlng double precision;
BEGIN
    IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
        RAISE EXCEPTION 'A point needs both a latitude and a longitude.' USING ERRCODE = '22023';
    END IF;
    IF v_point AND (p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'That point is off the map.' USING ERRCODE = '22023';
    END IF;
    IF (p_after_id IS NULL) <> (p_after_rank IS NULL) OR (p_after_id IS NULL) <> (p_after_name IS NULL) THEN
        RAISE EXCEPTION 'A cursor needs its rank, name and id.' USING ERRCODE = '22023';
    END IF;
    IF v_point THEN
        v_dlat := v_radius / 111.045;
        v_dlng := v_radius / (111.045 * greatest(cos(radians(p_latitude)), 0.01));
    END IF;
    SELECT array_agg(w) INTO v_words
    FROM regexp_split_to_table(private.discover_fold_ws(p_query), '\s+') w
    WHERE w <> '';
    v_q := array_to_string(v_words, ' ');

    RETURN QUERY
    WITH bars AS (
        SELECT p.id, p.handle, p.display_name, p.avatar_url, p.locality, p.city,
               CASE WHEN v_words IS NOT NULL THEN private.discover_fold_ws(p.display_name) END AS folded
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public AND NOT p.is_closed
          AND (p_bar_id IS NULL OR p.id = p_bar_id)
          AND (p_bar_id IS NOT NULL OR p_country_code IS NULL OR v_point OR p.country_code = upper(p_country_code))
          AND (p_bar_id IS NOT NULL OR p_city IS NULL OR v_point OR lower(p.city) = lower(p_city))
          AND (p_bar_id IS NOT NULL OR NOT v_point OR (
              p.latitude BETWEEN p_latitude - v_dlat AND p_latitude + v_dlat
              AND (
                  v_dlng >= 180
                  OR p.longitude BETWEEN p_longitude - v_dlng AND p_longitude + v_dlng
                  OR p.longitude >= p_longitude - v_dlng + 360
                  OR p.longitude <= p_longitude + v_dlng - 360
              )
              AND 2 * 6371.0088 * asin(least(1, sqrt(
                  power(sin(radians(p.latitude - p_latitude) / 2), 2)
                  + cos(radians(p_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_longitude) / 2), 2)
              ))) <= v_radius
          ))
    ), hits AS MATERIALIZED (
        SELECT f.item_id, f.name, f.bar_profile_id,
               (f.base_rank + CASE WHEN v_q IS NOT NULL AND strpos(private.discover_fold_ws(f.name), v_q) = 0 THEN 12 ELSE 0 END)::smallint AS rank
        FROM public.discover_drink_facts f
        JOIN bars b ON b.id = f.bar_profile_id
        WHERE (p_styles IS NULL OR f.styles && p_styles)
          AND (p_spirits IS NULL OR f.spirits && p_spirits)
          AND (p_notes IS NULL OR f.notes && p_notes)
          AND (v_words IS NULL OR NOT EXISTS (
              SELECT 1 FROM unnest(v_words) w
              WHERE strpos(f.haystack, w) = 0 AND strpos(b.folded, w) = 0
          ))
    ), totals AS (
        SELECT count(*)::integer AS drinks, count(DISTINCT h.bar_profile_id)::integer AS bars
        FROM hits h
        WHERE p_after_id IS NULL
    ), page AS (
        SELECT h.* FROM hits h
        WHERE p_after_id IS NULL OR (h.rank, h.name, h.item_id) > (p_after_rank, p_after_name, p_after_id)
        ORDER BY h.rank, h.name, h.item_id
        LIMIT v_limit
    )
    SELECT pg.item_id, i.name, i.description, hero.url, pg.bar_profile_id,
           b.handle, b.display_name, b.avatar_url, b.locality, b.city,
           CASE WHEN run.start_year IS NOT NULL THEN
               ARRAY[run.start_year, run.start_month, run.end_year, run.end_month, run.is_current::integer::smallint]
           END,
           pg.rank,
           CASE WHEN p_after_id IS NULL THEN (SELECT t.drinks FROM totals t) END,
           CASE WHEN p_after_id IS NULL THEN (SELECT t.bars FROM totals t) END
    FROM page pg
    JOIN public.items i ON i.id = pg.item_id
    JOIN bars b ON b.id = pg.bar_profile_id
    -- The hero: photos before sketches, then their saved order (lib/itemImages.ts orderedPictures).
    LEFT JOIN LATERAL (
        SELECT im.url
        FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
        WHERE ii.item_id = pg.item_id AND ii.angle = 'hero'
        ORDER BY ii.is_generated, coalesce(ii.sort_order, 0)
        LIMIT 1
    ) hero ON true
    LEFT JOIN LATERAL (
        SELECT r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
        FROM public.menu_drink_runs r
        WHERE r.item_id = pg.item_id
        ORDER BY (r.profile_id = pg.bar_profile_id) DESC, r.is_current DESC
        LIMIT 1
    ) run ON true
    ORDER BY pg.rank, pg.name, pg.item_id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."discover_list"(double precision, double precision, double precision, "text", "text", "uuid", "text"[], "text"[], "text"[], "text", smallint, "text", "uuid", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."discover_list"(double precision, double precision, double precision, "text", "text", "uuid", "text"[], "text"[], "text"[], "text", smallint, "text", "uuid", integer) TO "authenticated", "service_role";

-- --- First build, and the jobs ---

SELECT "private"."refresh_discover_facts"(NULL);

SELECT cron.schedule('discover-facts', '30 seconds', 'SELECT private.run_discover_dirty()');
SELECT cron.schedule('discover-facts-full', '23 4 * * *', 'SELECT private.refresh_discover_facts(NULL)');
