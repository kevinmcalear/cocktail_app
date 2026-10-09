-- Is a bar's version of a classic the classic itself, or a variation of it?
--
-- A catalog classic like the Boulevardier also exists as one cocktail per bar
-- that pours it (riff_of_id points at the classic). Kevin's rules
-- (2026-10-09), for folding them into one "served at" row:
--   same       the same ingredients in the same measures. A bottle of the
--              classic's style counts as that style (Bulleit is Bourbon,
--              Carpano Antica is Sweet Vermouth). Garnishes, optional lines,
--              bitters, dashes, saline and water don't count.
--   unlisted   no spec, or a partial one that adds and swaps nothing: we
--              don't know it differs, so it takes the default cocktail.
--   variation  any change: a different base spirit (rye for bourbon), other
--              measures, a swapped modifier, an added or missing ingredient,
--              a house prep. Its own row under the classic, with a note.
--   riff       a different name: the bar's own drink.
--
-- The verdict is worked out from the full spec and kept in
-- private.item_spec_matches, refreshed when a spec, a link or a name changes.
-- What changed is kept as recipe line ids, never names, because who may see a
-- bar's spec differs (a Locked bar page, brand masking for floor staff).
-- public.spec_matches() answers for the caller: a spec the caller can't see
-- reads as unlisted, names come through the caller's own masked view of the
-- spec (as drink_allergens does), and with amounts hidden a "same" or a
-- measures-only change reads as unlisted. Editors of a drink can override
-- the verdict with set_spec_match().
--
-- Also links the bar versions that share a classic's exact name but had no
-- riff_of_id (314 in production on 2026-10-09), so they rank with the classic
-- and fold under it. Versions linked to a different classic are left alone.
--
-- ponytail: a change to the ingredient tree (generic_id) doesn't refresh
-- verdicts. Run SELECT private.spec_match_refresh_all() after a catalog data
-- migration; upgrade path is a trigger on items.generic_id that refreshes the
-- drinks using that ingredient. Bulk seeds can SET app.spec_match = 'off' and
-- refresh after.

-- --- Storage ---

CREATE TABLE "private"."item_spec_matches" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "classic_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "verdict" "text" NOT NULL CHECK ("verdict" IN ('same', 'unlisted', 'variation', 'riff')),
    -- {"swaps": [{"line": recipe id, "from": classic ingredient, "base": bool}],
    --  "adds": [{"line": recipe id, "house": bool}], "drops": [classic ingredient],
    --  "measures": [recipe id]}
    "diff" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "has_amounts" boolean DEFAULT false NOT NULL,
    "override" "text" CHECK ("override" IN ('same', 'variation')),
    "override_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "override_at" timestamp with time zone,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE INDEX "item_spec_matches_classic_idx" ON "private"."item_spec_matches" ("classic_id");

ALTER TABLE "private"."item_spec_matches" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "private"."item_spec_matches" FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON TABLE "private"."item_spec_matches" TO "service_role";

-- "The Boulevardier", "Boulevardier" and "boulevardier." are one name.
CREATE FUNCTION "private"."drink_name_key"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT btrim(regexp_replace(
           regexp_replace(regexp_replace(public.discover_fold(p_name), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g'),
           '^\s*(the|classic|house|le|el|la) ', ''));
$$;

-- --- Working out one drink ---

CREATE FUNCTION "private"."spec_match_compute"("p_item_id" "uuid") RETURNS "void"
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
        WHEN private.drink_name_key(v_item.name) <> private.drink_name_key(v_classic.name) THEN 'riff'
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

-- These drinks, and every version of any classic among them.
CREATE FUNCTION "private"."spec_match_refresh"("p_item_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_id uuid;
BEGIN
    IF coalesce(current_setting('app.spec_match', true), '') = 'off' THEN
        RETURN;
    END IF;
    FOR v_id IN
        SELECT i.id FROM public.items i WHERE i.id = ANY (p_item_ids) AND i.item_type = 'cocktail'
        UNION
        SELECT v.id FROM public.items c JOIN public.items v ON v.riff_of_id = c.id
         WHERE c.id = ANY (p_item_ids) AND c.is_catalog AND c.item_type = 'cocktail'
    LOOP
        PERFORM private.spec_match_compute(v_id);
    END LOOP;
    -- Drinks no longer linked to a classic.
    DELETE FROM private.item_spec_matches m
     WHERE m.item_id = ANY (p_item_ids)
       AND NOT EXISTS (SELECT 1 FROM public.items i WHERE i.id = m.item_id AND i.riff_of_id IS NOT NULL);
END;
$$;

CREATE FUNCTION "private"."spec_match_refresh_all"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_id uuid;
    v_n integer := 0;
BEGIN
    DELETE FROM private.item_spec_matches m
     WHERE NOT EXISTS (SELECT 1 FROM public.items i WHERE i.id = m.item_id AND i.riff_of_id IS NOT NULL);
    FOR v_id IN SELECT i.id FROM public.items i WHERE i.riff_of_id IS NOT NULL AND i.item_type = 'cocktail' AND NOT i.is_catalog LOOP
        PERFORM private.spec_match_compute(v_id);
        v_n := v_n + 1;
    END LOOP;
    RETURN v_n;
END;
$$;

-- --- Keeping it fresh ---

CREATE FUNCTION "private"."spec_match_recipes_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_ids uuid[];
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT array_agg(DISTINCT recipe_item_id) INTO v_ids FROM old_lines;
    ELSIF TG_OP = 'INSERT' THEN
        SELECT array_agg(DISTINCT recipe_item_id) INTO v_ids FROM new_lines;
    ELSE
        SELECT array_agg(DISTINCT x) INTO v_ids
          FROM (SELECT recipe_item_id AS x FROM new_lines UNION SELECT recipe_item_id FROM old_lines) s;
    END IF;
    IF v_ids IS NOT NULL THEN
        PERFORM private.spec_match_refresh(v_ids);
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "spec_match_recipes_inserted" AFTER INSERT ON "public"."recipes"
    REFERENCING NEW TABLE AS "new_lines" FOR EACH STATEMENT EXECUTE FUNCTION "private"."spec_match_recipes_changed"();
CREATE TRIGGER "spec_match_recipes_updated" AFTER UPDATE ON "public"."recipes"
    REFERENCING NEW TABLE AS "new_lines" OLD TABLE AS "old_lines" FOR EACH STATEMENT EXECUTE FUNCTION "private"."spec_match_recipes_changed"();
CREATE TRIGGER "spec_match_recipes_deleted" AFTER DELETE ON "public"."recipes"
    REFERENCING OLD TABLE AS "old_lines" FOR EACH STATEMENT EXECUTE FUNCTION "private"."spec_match_recipes_changed"();

CREATE FUNCTION "private"."spec_match_item_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.item_type = 'cocktail' THEN
        PERFORM private.spec_match_refresh(ARRAY[NEW.id]);
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "spec_match_item_inserted" AFTER INSERT ON "public"."items"
    FOR EACH ROW WHEN (NEW."riff_of_id" IS NOT NULL) EXECUTE FUNCTION "private"."spec_match_item_changed"();
CREATE TRIGGER "spec_match_item_updated" AFTER UPDATE OF "riff_of_id", "name", "is_catalog" ON "public"."items"
    FOR EACH ROW
    WHEN (OLD."riff_of_id" IS DISTINCT FROM NEW."riff_of_id" OR OLD."name" IS DISTINCT FROM NEW."name" OR OLD."is_catalog" IS DISTINCT FROM NEW."is_catalog")
    EXECUTE FUNCTION "private"."spec_match_item_changed"();

REVOKE ALL ON FUNCTION "private"."drink_name_key"("text") FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "private"."spec_match_compute"("uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."spec_match_refresh"("uuid"[]) FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."spec_match_refresh_all"() FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."spec_match_recipes_changed"() FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."spec_match_item_changed"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "private"."drink_name_key"("text") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."spec_match_refresh_all"() TO "service_role";

-- --- Reading it, as the caller sees the spec ---

-- One row per drink the caller can see that is linked to a classic:
--   spec_match  same | unlisted | variation | riff
--   notes       {"swaps": [{"to": "Rye Whiskey", "from": "Bourbon", "base": true}],
--                "adds": [{"name": "Mezcal", "house": false}], "drops": ["Campari"],
--                "measures": true}, names as the caller sees them; {} when
--                the caller can't see what changed.
-- private.spec_matches_seen has no cap, for other server functions that run
-- as the caller (My Bar's "served at"); public.spec_matches caps it at 500.
CREATE FUNCTION "private"."spec_matches_seen"("p_item_ids" "uuid"[])
RETURNS TABLE("item_id" "uuid", "classic_id" "uuid", "spec_match" "text", "notes" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH asked AS (
    SELECT DISTINCT x AS id FROM unnest(p_item_ids) AS x
  ), found AS (
    SELECT m.*, coalesce(m.override, m.verdict) AS said
      FROM asked a
      JOIN private.item_spec_matches m ON m.item_id = a.id
     WHERE private.can_view_item(a.id)
  ), seen AS (
    -- What the caller can see of each spec, through the same masking as the
    -- drink page: every line, its ingredient, its amount.
    SELECT r.item_id,
           (SELECT count(*) FROM public.recipes x WHERE x.recipe_item_id = r.item_id AND x.ingredient_item_id IS NOT NULL) AS lines,
           (SELECT count(*) FROM public.app_recipe_presentation p WHERE p.recipe_item_id = r.item_id AND p.display_ingredient_id IS NOT NULL) AS shown,
           (SELECT count(*) FROM public.recipes x WHERE x.recipe_item_id = r.item_id AND x.amount IS NOT NULL) AS amounts,
           (SELECT count(*) FROM public.app_recipe_presentation p WHERE p.recipe_item_id = r.item_id AND p.amount IS NOT NULL) AS amounts_shown
      FROM found r
  ), named AS (
    SELECT r.item_id,
           s.lines = s.shown AS spec_seen,
           s.amounts = s.amounts_shown AS amounts_seen,
           (SELECT jsonb_agg(jsonb_build_object('to', d.name, 'from', e->>'from', 'base', (e->>'base')::boolean))
              FROM jsonb_array_elements(r.diff->'swaps') e
              JOIN public.app_recipe_presentation p ON p.id = (e->>'line')::uuid
              JOIN public.items d ON d.id = p.display_ingredient_id) AS swaps,
           (SELECT jsonb_agg(jsonb_build_object('name', d.name, 'house', (e->>'house')::boolean))
              FROM jsonb_array_elements(r.diff->'adds') e
              JOIN public.app_recipe_presentation p ON p.id = (e->>'line')::uuid
              JOIN public.items d ON d.id = p.display_ingredient_id) AS adds,
           r.diff->'drops' AS drops,
           jsonb_array_length(coalesce(r.diff->'measures', '[]'::jsonb)) > 0 AS measures
      FROM found r JOIN seen s ON s.item_id = r.item_id
  )
  SELECT r.item_id, r.classic_id,
         CASE
           WHEN r.said = 'riff' THEN 'riff'
           WHEN r.override IS NOT NULL THEN r.override
           WHEN NOT n.spec_seen THEN 'unlisted'
           WHEN r.said = 'same' AND r.has_amounts AND NOT n.amounts_seen THEN 'unlisted'
           WHEN r.said = 'variation' AND NOT n.amounts_seen AND n.swaps IS NULL AND n.adds IS NULL AND n.drops IS NULL THEN 'unlisted'
           ELSE r.said
         END,
         CASE WHEN NOT n.spec_seen THEN '{}'::jsonb
              ELSE jsonb_strip_nulls(jsonb_build_object(
                     'swaps', n.swaps, 'adds', n.adds, 'drops', n.drops,
                     'measures', CASE WHEN n.measures AND n.amounts_seen THEN true END))
         END
    FROM found r JOIN named n ON n.item_id = r.item_id;
$$;

CREATE FUNCTION "public"."spec_matches"("p_item_ids" "uuid"[])
RETURNS TABLE("item_id" "uuid", "classic_id" "uuid", "spec_match" "text", "notes" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT * FROM private.spec_matches_seen(p_item_ids[1:500]);
$$;

REVOKE ALL ON FUNCTION "private"."spec_matches_seen"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."spec_matches_seen"("uuid"[]) TO "authenticated", "service_role";
REVOKE ALL ON FUNCTION "public"."spec_matches"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."spec_matches"("uuid"[]) TO "authenticated", "service_role";

-- --- An editor's call ---

-- "This is just the classic" or "this is our variation", from someone who can
-- edit the drink (its venue's editors, or an app admin). NULL clears it.
CREATE FUNCTION "public"."set_spec_match"("p_item_id" "uuid", "p_spec_match" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to change this.';
    END IF;
    IF p_spec_match IS NOT NULL AND p_spec_match NOT IN ('same', 'variation') THEN
        RAISE EXCEPTION 'Choose same or variation.';
    END IF;
    IF NOT (private.can_edit_item(p_item_id) OR private.is_app_admin()) THEN
        RAISE EXCEPTION 'Only people who can edit this drink can change this.';
    END IF;
    UPDATE private.item_spec_matches
       SET override = p_spec_match,
           override_by = CASE WHEN p_spec_match IS NULL THEN NULL ELSE auth.uid() END,
           override_at = CASE WHEN p_spec_match IS NULL THEN NULL ELSE now() END
     WHERE item_id = p_item_id AND verdict <> 'riff';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'This drink isn''t a version of a classic.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION "public"."set_spec_match"("uuid", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."set_spec_match"("uuid", "text") TO "authenticated", "service_role";

-- --- Data: link same-name versions, then work out every version ---

-- A bar's drink with exactly a classic's name is a version of it. Only when
-- one catalog cocktail has that name. Worked out once, after, not per row.
SET "app.spec_match" = 'off';
WITH classics AS (
    SELECT private.drink_name_key(c.name) AS k, (array_agg(c.id))[1] AS id
      FROM public.items c
     WHERE c.is_catalog AND c.item_type = 'cocktail'
     GROUP BY 1
    HAVING count(*) = 1
)
UPDATE public.items v SET riff_of_id = c.id
  FROM classics c
 WHERE v.item_type = 'cocktail' AND NOT v.is_catalog AND v.riff_of_id IS NULL
   AND (v.origin_bar_profile_id IS NOT NULL OR v.bar_id IS NOT NULL)
   AND private.drink_name_key(v.name) = c.k
   AND v.id <> c.id;

RESET "app.spec_match";

SELECT private.spec_match_refresh_all();
