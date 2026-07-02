-- Custom glassware icon metadata (built-in icon key or generated image URL)
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS icon_key TEXT,
ADD COLUMN IF NOT EXISTS icon_url TEXT;

CREATE OR REPLACE VIEW public.app_item_presentation AS
SELECT
    c.id,
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
    c.icon_url
FROM public.items c
LEFT JOIN public.bars b ON c.bar_id = b.id
LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
WHERE
    c.bar_id IS NULL
    OR (COALESCE(ub.role_level, 10) >= COALESCE(c.override_visibility_level, b.default_visibility_level));
