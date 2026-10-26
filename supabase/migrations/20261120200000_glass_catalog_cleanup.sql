-- Glass catalog cleanup, after 20261120100000. Kevin, 25 Oct 2026: the Savage
-- Pony showed twice in Find the one you pour into.
--
-- 1. Nude's Savage line was loaded twice: from Nude's own catalog
--    (20261113200000: Savage Pony, Coupetini, Lowball, Highball, Water, codes
--    P67276 and so on) and again from a stockist's listing in wave 5
--    (20261113400000: "Savage 4 oz. Pony Glass", code 67276 and so on). The
--    load's check matched codes exactly, so P67276 and 67276 both went in.
--    The maker's rows stay (their sizes are Nude's own: the Pony is "4oz
--    (13.5cl)", 135 ml, where the stockist rounds 4 oz to 118 ml); whatever
--    named a stockist row (Caretaker's Cottage's Pony) now names the maker's,
--    and the five stockist rows go. Both were traced; the maker's outlines
--    stay. The Savage Coupe (67296), which only the stockist lists, joins the
--    Savage series.
-- 2. Glasses wave 5 filed under the wrong type, checked against their pages:
--      Bar/Giani Old Fashioned Cocktail Glass   Martini -> Rocks (Difford's
--                                               Guide: an old fashioned tumbler)
--      Bar/Giani Long Drink Cocktail Glass      Martini -> Highball (Difford's:
--                                               tall, collins and highball)
--      Gintonica 20.5 oz. Gin and Tonic Glass   Rocks -> Spritz, the copa (a
--                                               stemmed 184 mm balloon)
--      Savor 12 oz. Whiskey Tasting Glass       Rocks -> Snifter, Glencairn
--                                               (rim narrower than its bowl)
--      Reserva 14.25 oz. Stemmed Beer Glass     Rocks -> Beer
--    The two Bar/Giani tumblers were traced as stemmed glasses (the photo on
--    their page wasn't theirs), so their outlines go: they're drawn as their
--    type until they're traced again.
-- 3. Nude's Hemingway 55 oz. Glass Ice Bucket isn't a glass anyone pours a
--    drink into; it goes.
--
-- Nothing points at the retyped or removed rows but the one Pony. Retyped and
-- re-traced glasses redraw the drinks drawn in them (glass_models'
-- refresh_sketches trigger). No RLS or grant changes; no AI jobs. Running it
-- again changes nothing.

-- --- 1. One Savage line ---

CREATE TEMP TABLE savage_dup AS
SELECT keep.id AS keep_id, gone.id AS gone_id
  FROM (VALUES ('P67276', '67276'), ('P67286', '67286'), ('P64154', '64154'), ('P64135', '64135'), ('P64172', '64172')) c(keep_code, gone_code)
  JOIN public.profiles p ON p.kind = 'maker' AND p.handle = 'nude'
  JOIN public.glass_models keep ON keep.maker_profile_id = p.id AND keep.model_code = c.keep_code
  JOIN public.glass_models gone ON gone.maker_profile_id = p.id AND gone.model_code = c.gone_code;

UPDATE public.bar_glassware g SET model_id = d.keep_id FROM savage_dup d WHERE g.model_id = d.gone_id;
UPDATE public.home_glassware g SET model_id = d.keep_id FROM savage_dup d WHERE g.model_id = d.gone_id;
UPDATE public.items i SET glass_model_id = d.keep_id FROM savage_dup d WHERE i.glass_model_id = d.gone_id;
UPDATE public.glass_shares s SET model_id = d.keep_id FROM savage_dup d WHERE s.model_id = d.gone_id;
DELETE FROM public.glass_models m USING savage_dup d WHERE m.id = d.gone_id;

DROP TABLE savage_dup;

UPDATE public.glass_models m SET series = 'Savage', designer = 'Rémy Savage'
  FROM public.profiles p
 WHERE p.id = m.maker_profile_id AND p.kind = 'maker' AND p.handle = 'nude'
   AND m.model_code = '67296' AND (m.series, m.designer) IS DISTINCT FROM ('Savage', 'Rémy Savage');

-- --- 2. The right type ---

CREATE TEMP TABLE retype (name text, glass text, variant text, shape text, untrace boolean);
INSERT INTO retype VALUES
('Bar/Giani Old Fashioned Cocktail Glass', 'rocks', NULL, 'Rocks', true),
('Bar/Giani Long Drink Cocktail Glass', 'highball', NULL, 'Highball', true),
('Gintonica 20.5 oz. Gin and Tonic Glass', 'spritz', 'spritz_copa', 'Spritz', false),
('Savor 12 oz. Whiskey Tasting Glass', 'snifter', 'snifter_glencairn', 'Snifter', false),
('Reserva 14.25 oz. Stemmed Beer Glass', 'beer', NULL, 'Beer', false);

UPDATE public.glass_models m
   SET glass = r.glass,
       variant = r.variant,
       shape_item_id = (SELECT i.id FROM public.items i WHERE i.item_type = 'glassware' AND i.bar_id IS NULL AND lower(i.name) = lower(r.shape)
                         ORDER BY i.created_at, i.id LIMIT 1),
       outline = CASE WHEN r.untrace THEN NULL ELSE m.outline END
  FROM retype r, public.profiles p
 WHERE p.id = m.maker_profile_id AND p.kind = 'maker' AND p.handle = 'nude' AND m.name = r.name
   AND (m.glass IS DISTINCT FROM r.glass OR (r.untrace AND m.outline IS NOT NULL));

DROP TABLE retype;

-- --- 3. Not a glass ---

DELETE FROM public.glass_models m
 USING public.profiles p
 WHERE p.id = m.maker_profile_id AND p.kind = 'maker' AND p.handle = 'nude' AND m.name = 'Hemingway 55 oz. Glass Ice Bucket';
