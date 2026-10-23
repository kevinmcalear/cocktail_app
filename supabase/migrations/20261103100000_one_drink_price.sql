-- Every drink has one price: items.price, the text the bar typed ("19",
-- "19.50", "MP"). Decided by Kevin on 23 Oct 2026 (canvas board "Every
-- drink has one price"); a menu shows each drink's own price.
--
-- Until now the costing screens kept a second, numeric price
-- (items.price_minor) that the menus never printed, so the two could
-- disagree. The app now reads and writes items.price only and works cost
-- and GP out from it (MP has no margin).
--
-- What changes:
--   * private.price_minor_of(price, currency) reads the first number in a
--     typed price as minor units, and private.price_text_of(minor,
--     currency) writes minor units back as a plain price ("23", "23.50").
--   * items_price_in_step keeps items.price_minor in step with items.price
--     both ways, for app versions from before this change: they read
--     price_minor for cost and GP and write it from the drink page and menu
--     costing. A write to price sets price_minor; a write to price_minor
--     alone sets price. A follow-up PR drops price_minor and this trigger
--     once every installed app reads price.
--   * Existing rows: a price_minor with no price gets its price, and every
--     price_minor is worked out again from its price.
--   * credited_drink_details.price_minor goes (it was always empty). A
--     drink credited to a bar keeps its typed price in
--     credited_drink_details.price, hidden with its spec until the bar's
--     page is open (20261010100000_bar_page_direct_reads.sql); on items it
--     keeps no price_minor at all. keep_credited_price now also catches an
--     older app's write to price_minor, through the price it sets.
--   * app_item_presentation.price_minor is items.price_minor only.

-- --- Reading and writing a typed price ---

-- Minor units per major unit for the bar's currency: 1 for yen and the
-- like, 100 otherwise (and when there's no bar), as lib/money.ts.
CREATE OR REPLACE FUNCTION private.minor_per_major(p_currency text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
    SELECT CASE WHEN p_currency IN ('JPY', 'KRW', 'VND', 'ISK', 'HUF') THEN 1 ELSE 100 END;
$$;

-- "19", "$19.50", "19 / 60" (the glass price first) as minor units; NULL
-- for "MP", blanks and anything with no number in it.
CREATE OR REPLACE FUNCTION private.price_minor_of(p_price text, p_currency text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
    SELECT round(replace(m[1], ',', '')::numeric * private.minor_per_major(p_currency))::integer
    FROM (SELECT regexp_match(p_price, '([0-9][0-9,]*(?:\.[0-9]+)?)') AS m) x
    WHERE m IS NOT NULL;
$$;

-- 2300 -> "23", 2350 -> "23.50" (100 a major unit); 1200 yen -> "1200".
CREATE OR REPLACE FUNCTION private.price_text_of(p_minor integer, p_currency text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
    SELECT CASE
        WHEN p_minor IS NULL THEN NULL
        WHEN p_minor % private.minor_per_major(p_currency) = 0 THEN (p_minor / private.minor_per_major(p_currency))::text
        ELSE to_char(p_minor::numeric / private.minor_per_major(p_currency), 'FM999999990.00')
    END;
$$;

-- --- items.price_minor follows items.price ---

-- Named to run before keep_credited_price (BEFORE triggers fire by name), so
-- a credited drink's price is moved away after this has set it. Security
-- definer to read the bar's currency whatever the writer sees of bars.
-- An UPDATE that changes neither (SET price = price) brings them back in
-- step from whichever is set, the price first.
CREATE OR REPLACE FUNCTION private.items_price_in_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_currency text;
BEGIN
    IF NEW.bar_id IS NOT NULL THEN
        SELECT b.currency INTO v_currency FROM public.bars b WHERE b.id = NEW.bar_id;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.price IS DISTINCT FROM OLD.price THEN
        NEW.price_minor := private.price_minor_of(NEW.price, v_currency);
    ELSIF TG_OP = 'UPDATE' AND NEW.price_minor IS DISTINCT FROM OLD.price_minor THEN
        NEW.price := private.price_text_of(NEW.price_minor, v_currency);
    ELSIF NEW.price IS NOT NULL THEN
        NEW.price_minor := private.price_minor_of(NEW.price, v_currency);
    ELSIF NEW.price_minor IS NOT NULL THEN
        NEW.price := private.price_text_of(NEW.price_minor, v_currency);
    END IF;
    IF NEW.bar_id IS NULL AND NOT NEW.is_catalog AND NEW.created_by IS NULL AND NEW.origin_bar_profile_id IS NOT NULL THEN
        NEW.price_minor := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS items_price_in_step ON public.items;
CREATE TRIGGER items_price_in_step
    BEFORE INSERT OR UPDATE OF price, price_minor ON public.items
    FOR EACH ROW EXECUTE FUNCTION private.items_price_in_step();

-- --- A credited drink keeps only its typed price, out of sight ---

DROP TRIGGER IF EXISTS keep_credited_price_minor ON public.items;
DROP TRIGGER IF EXISTS keep_credited_price ON public.items;
CREATE TRIGGER keep_credited_price
    BEFORE INSERT OR UPDATE OF price, price_minor ON public.items
    FOR EACH ROW
    WHEN (NEW.bar_id IS NULL AND NOT NEW.is_catalog AND NEW.created_by IS NULL AND NEW.origin_bar_profile_id IS NOT NULL)
    EXECUTE FUNCTION private.keep_credited_drink_detail('price');

-- A credited drink with only a number gets it as its typed price first.
UPDATE public.credited_drink_details
   SET price = private.price_text_of(price_minor, NULL)
 WHERE price IS NULL AND price_minor IS NOT NULL;

-- As 20261010100000_bar_page_direct_reads.sql, without price_minor: the
-- price comes back as typed and items_price_in_step works the number out.
CREATE OR REPLACE FUNCTION private.move_credited_drink_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF private.is_bar_credited_drink(NEW.bar_id, NEW.is_catalog, NEW.created_by, NEW.origin_bar_profile_id) THEN
        UPDATE public.items
           SET serve_ml = serve_ml, serve_abv = serve_abv, dilution_pct = dilution_pct, price = price
         WHERE id = NEW.id;
    ELSE
        UPDATE public.items i
           SET serve_ml = COALESCE(i.serve_ml, d.serve_ml),
               serve_abv = COALESCE(i.serve_abv, d.serve_abv),
               dilution_pct = COALESCE(i.dilution_pct, d.dilution_pct),
               price = COALESCE(i.price, d.price)
          FROM public.credited_drink_details d
         WHERE d.item_id = i.id AND i.id = NEW.id;
        DELETE FROM public.credited_drink_details WHERE item_id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$;

-- --- The view: price_minor from items only ---

-- As 20261101200000_role_permissions_per_role.sql, with price_minor read
-- from items alone (a credited drink has none).
CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    COALESCE(c.notes, (SELECT n.notes FROM public.credited_drink_notes n WHERE n.item_id = c.id)) AS notes,
    c.origin,
    COALESCE(c.price, (SELECT cd.price FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price,
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
    c.generic_id,
    c.service_style,
    c.density_g_ml,
    COALESCE(c.dilution_pct, (SELECT cd.dilution_pct FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS dilution_pct,
    COALESCE(c.serve_ml, (SELECT cd.serve_ml FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_ml,
    COALESCE(c.serve_abv, (SELECT cd.serve_abv FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_abv,
    c.abv_source,
    c.capacity_ml,
    c.iced_capacity_ml,
    c.ice_per_serve_g,
    c.price_minor,
    c.is_core,
    c.ingredient_role,
    c.made_from_id,
    c.method_ice_id,
    c.ice_build
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
     LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
     LEFT JOIN public.venue_level_overrides lo ON ub.venue_role_id IS NULL AND lo.bar_id = ub.bar_id AND lo.base_level = ub.role_level
     CROSS JOIN LATERAL (SELECT public.effective_bar_role(ub.role_level) AS role) er
  WHERE c.bar_id IS NULL
     OR private.cap_open('menu', er.role >= COALESCE(c.override_visibility_level, b.default_visibility_level),
                         CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                         CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END)
     OR (ub.user_id IS NOT NULL
         AND private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(er.role)),
                              CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                              CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END));

ALTER TABLE public.credited_drink_details DROP COLUMN price_minor;

-- --- Existing rows ---

-- Every number follows its price, and a number with no typed price gets
-- one (items_price_in_step does the work).
UPDATE public.items SET price = price WHERE price IS NOT NULL OR price_minor IS NOT NULL;
