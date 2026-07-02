-- Add explicit ordering for recipe ingredients (cocktails, complex ingredients)
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill from insertion order within each parent item
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY recipe_item_id
           ORDER BY created_at ASC
         ) - 1 AS rn
  FROM public.recipes
)
UPDATE public.recipes r
SET sort_order = ranked.rn
FROM ranked
WHERE r.id = ranked.id;

CREATE UNIQUE INDEX IF NOT EXISTS recipes_recipe_item_sort_order_idx
  ON public.recipes (recipe_item_id, sort_order);

-- Expose sort_order through the presentation view (append column to preserve view column order)
CREATE OR REPLACE VIEW public.app_recipe_presentation AS
SELECT 
    r.id,
    r.created_at,
    r.recipe_item_id,
    
    CASE
        WHEN c.bar_id IS NULL THEN r.ingredient_item_id
        WHEN COALESCE(ub.role_level, 10) >= COALESCE(c.override_specific_brand_level, b.default_specific_brand_level)
        THEN r.ingredient_item_id
        
        WHEN COALESCE(ub.role_level, 10) >= COALESCE(c.override_generic_ingredient_level, b.default_generic_ingredient_level)
        THEN COALESCE(r.parent_ingredient_id, r.ingredient_item_id)
        
        ELSE NULL
    END AS display_ingredient_id,

    CASE
        WHEN c.bar_id IS NULL THEN r.amount
        WHEN COALESCE(ub.role_level, 10) >= COALESCE(c.override_measurement_level, b.default_measurement_level)
        THEN r.amount
        ELSE NULL
    END AS amount,
    
    CASE
        WHEN c.bar_id IS NULL THEN r.unit
        WHEN COALESCE(ub.role_level, 10) >= COALESCE(c.override_measurement_level, b.default_measurement_level)
        THEN r.unit
        ELSE NULL
    END AS unit,

    CASE
        WHEN c.bar_id IS NULL THEN r.preparation_notes
        WHEN COALESCE(ub.role_level, 10) >= COALESCE(c.override_prep_level, b.default_prep_level)
        THEN r.preparation_notes
        ELSE NULL
    END AS preparation_notes,
    
    r.is_optional,
    r.parent_ingredient_id,
    r.ingredient_item_id,
    r.sort_order

FROM public.recipes r
JOIN public.items c ON r.recipe_item_id = c.id
LEFT JOIN public.bars b ON c.bar_id = b.id
LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
WHERE
    c.bar_id IS NULL OR 
    (COALESCE(ub.role_level, 10) >= COALESCE(c.override_visibility_level, b.default_visibility_level));
