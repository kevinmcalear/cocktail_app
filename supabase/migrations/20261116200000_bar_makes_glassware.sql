-- A bar's page may make glassware, so a tiki bar's own mugs point at the bar
-- (Kevin, 25 Oct 2026, Open decisions d42: "Let a bar page make glassware").
-- One page per company: a second maker page for the same bar would split its
-- fans and its logo.
--
--   * profiles.makes: a bar's page may say it makes glassware (nothing else;
--     a bar's own ice is credited on its own drinks, 20261011155500).
--   * A glass model's maker, a venue glass's maker and a drink's "glass by"
--     credit may be a bar's page that makes glassware, as well as a maker's.
--   * The ten tiki bars that sell their own mugs (20261112100000) say so.
--   * Their mugs in the glass catalog point at the bar's page. The catalog had
--     them under the pottery that made them for the bar (Tiki Farm, Munktiki;
--     Cocktail Kingdom for Latitude 29's coconut), the bar's name in the
--     series. The pottery stays in each mug's sources and in its seed file
--     (supabase/seeds/glass-models), whose rows have loaded and don't reload.
--     The Forgotten Float bowl (Hale Pele, Smuggler's Cove and False Idol
--     together) goes to Hale Pele, whose name it carries. A venue glass that
--     picked one of these mugs follows it to the bar.

-- --- What a page makes ---

ALTER TABLE "public"."profiles" DROP CONSTRAINT "profiles_makes_known";
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_makes_known" CHECK (
    "makes" <@ ARRAY['bottles', 'ice', 'garnish', 'glassware', 'barware', 'equipment']::"text"[]
    AND ("kind" = 'maker' OR ("kind" = 'bar' AND "makes" <@ ARRAY['glassware']::"text"[]) OR cardinality("makes") = 0)
);

COMMENT ON COLUMN "public"."profiles"."makes" IS
    'What it makes (bottles, ice, garnish, glassware, barware, equipment): a maker''s, or glassware for a bar that sells its own glasses. Empty for people.';

-- --- Who may make a glass ---

CREATE OR REPLACE FUNCTION "private"."guard_glass_model"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = NEW.maker_profile_id AND kind IN ('maker', 'bar') AND 'glassware' = ANY (makes)
    ) THEN
        RAISE EXCEPTION 'A glass model''s maker must be a page that makes glassware.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.shape_item_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.items WHERE id = NEW.shape_item_id AND item_type = 'glassware' AND bar_id IS NULL
    ) THEN
        RAISE EXCEPTION 'A glass model''s shape must be a shared glassware item.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "private"."guard_bar_glassware_maker"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.maker_profile_id IS NULL THEN RETURN NEW; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = NEW.maker_profile_id AND kind IN ('maker', 'bar') AND 'glassware' = ANY (makes)
    ) THEN
        RAISE EXCEPTION 'A glass''s maker must be a page that makes glassware.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "private"."guard_item_maker_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_item public.items;
    v_profile public.profiles;
BEGIN
    SELECT * INTO v_item FROM public.items WHERE id = NEW.item_id;
    IF v_item.id IS NULL OR v_item.item_type <> 'cocktail' THEN
        RAISE EXCEPTION 'Credit a maker on a drink.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.profile_id;
    -- The drink's own bar, cutting its own ice: confirmed as it's made.
    IF v_profile.kind = 'bar' AND NEW.makes = 'ice' AND v_item.bar_id IS NOT NULL AND v_profile.bar_id = v_item.bar_id THEN
        NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
        RETURN NEW;
    END IF;
    -- A maker, or a bar that makes glassware, saying it makes this.
    IF v_profile.kind IS NULL OR v_profile.kind NOT IN ('maker', 'bar') OR NOT (NEW.makes = ANY (v_profile.makes)) THEN
        RAISE EXCEPTION 'That maker''s page doesn''t say it makes %.', NEW.makes USING ERRCODE = 'check_violation';
    END IF;
    -- Anyone else's credit waits for the maker to confirm it.
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL AND NOT private.is_app_admin() THEN
        NEW.confirmed_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

-- --- The tiki bars and their mugs ---

UPDATE public.profiles SET makes = ARRAY['glassware']
 WHERE kind = 'bar' AND cardinality(makes) = 0
   AND handle IN ('tonga.hut', 'hale.pele', 'false.idol', 'maxs.south.seas.hideaway', 'cliftons.pacific.seas',
                  'smugglerscovesf', 'threedotsandadash', 'latitude29nola', 'lostlakechicago', 'tradervics.oakland');

CREATE TEMP TABLE bar_mug (maker text NOT NULL, name text NOT NULL, bar text NOT NULL);
INSERT INTO bar_mug VALUES
('tiki.farm', 'Clifton''s Pacific Seas Fogcutter Mug', 'cliftons.pacific.seas'),
('tiki.farm', 'False Idol Volcano Barrel Mug', 'false.idol'),
('tiki.farm', 'Smuggler''s Cove Kuhiko (Sunken Tiki) Mug', 'smugglerscovesf'),
('tiki.farm', 'Three Dots and a Dash Coconut Mug', 'threedotsandadash'),
('tiki.farm', 'Three Dots and a Dash Keko Pepeiao Mug', 'threedotsandadash'),
('tiki.farm', 'Three Dots and a Dash Rum Barrel Mug', 'threedotsandadash'),
('munktiki', 'False Idol The Mighty Alkala Mug', 'false.idol'),
('munktiki', 'Hale Pele Cannibal Trio Mug', 'hale.pele'),
('munktiki', 'Hale Pele The Forgotten Float Bowl', 'hale.pele'),
('munktiki', 'Hale Pele Little Lava Person Mug', 'hale.pele'),
('munktiki', 'Smuggler''s Cove Rum Barrel Mug', 'smugglerscovesf'),
('munktiki', 'Three Dots and a Dash Skull Pineapple Mug', 'threedotsandadash'),
('cocktail.kingdom', 'Latitude 29 Coconut Mug', 'latitude29nola');

CREATE TEMP TABLE mug_move AS
SELECT m.id AS model_id, m.maker_profile_id AS from_id, b.id AS to_id
  FROM bar_mug x
  JOIN public.profiles f ON f.kind = 'maker' AND f.handle = x.maker
  JOIN public.glass_models m ON m.maker_profile_id = f.id AND public.ingredient_key(m.name) = public.ingredient_key(x.name)
  JOIN public.profiles b ON b.kind = 'bar' AND b.handle = x.bar AND 'glassware' = ANY (b.makes);

UPDATE public.glass_models m SET maker_profile_id = v.to_id FROM mug_move v WHERE m.id = v.model_id;

UPDATE public.bar_glassware g SET maker_profile_id = v.to_id
  FROM mug_move v
 WHERE g.model_id = v.model_id AND g.maker_profile_id = v.from_id;

DROP TABLE bar_mug, mug_move;
