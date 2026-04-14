-- 1. Create bars table
CREATE TABLE public.bars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    default_visibility_level INT NOT NULL DEFAULT 10,
    default_generic_ingredient_level INT NOT NULL DEFAULT 20,
    default_specific_brand_level INT NOT NULL DEFAULT 30,
    default_measurement_level INT NOT NULL DEFAULT 30,
    default_prep_level INT NOT NULL DEFAULT 40,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create user_bars table
CREATE TABLE public.user_bars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
    role_level INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, bar_id)
);

-- Enable RLS on new tables
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bars" ON public.bars FOR SELECT USING (true);
CREATE POLICY "Users can view their bar roles" ON public.user_bars FOR SELECT USING (auth.uid() = user_id);

-- 3. Alter items table to support progressive disclosure overrides
ALTER TABLE public.items
ADD COLUMN bar_id UUID REFERENCES public.bars(id),
ADD COLUMN override_visibility_level INT,
ADD COLUMN override_generic_ingredient_level INT,
ADD COLUMN override_specific_brand_level INT,
ADD COLUMN override_measurement_level INT,
ADD COLUMN override_prep_level INT;

-- 4. Create the Secure Views
-- 4A. View for Cocktail/Items
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
    c.bar_id
FROM public.items c
LEFT JOIN public.bars b ON c.bar_id = b.id
LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
WHERE
    -- If it isn't assigned to a bar, assume it's global/public
    c.bar_id IS NULL OR 
    (COALESCE(ub.role_level, 10) >= COALESCE(c.override_visibility_level, b.default_visibility_level));

-- 4B. View for Recipes (Ingredients masking)
CREATE OR REPLACE VIEW public.app_recipe_presentation AS
SELECT 
    r.id,
    r.created_at,
    r.recipe_item_id,
    
    -- Ingredient Selection (Specific vs Generic vs Hidden)
    CASE
        WHEN c.bar_id IS NULL THEN r.ingredient_item_id
        WHEN COALESCE(ub.role_level, 10) >= COALESCE(c.override_specific_brand_level, b.default_specific_brand_level)
        THEN r.ingredient_item_id
        
        WHEN COALESCE(ub.role_level, 10) >= COALESCE(c.override_generic_ingredient_level, b.default_generic_ingredient_level)
        THEN COALESCE(r.parent_ingredient_id, r.ingredient_item_id)
        
        ELSE NULL
    END AS display_ingredient_id,

    -- Measurements
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

    -- Prep Notes
    CASE
        WHEN c.bar_id IS NULL THEN r.preparation_notes
        WHEN COALESCE(ub.role_level, 10) >= COALESCE(c.override_prep_level, b.default_prep_level)
        THEN r.preparation_notes
        ELSE NULL
    END AS preparation_notes,
    
    r.is_optional,
    r.parent_ingredient_id,
    r.ingredient_item_id -- Keep original for reference if needed globally by admins, but generally clients should use display_ingredient_id

FROM public.recipes r
JOIN public.items c ON r.recipe_item_id = c.id
LEFT JOIN public.bars b ON c.bar_id = b.id
LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
WHERE
    -- Master visibility guard
    c.bar_id IS NULL OR 
    (COALESCE(ub.role_level, 10) >= COALESCE(c.override_visibility_level, b.default_visibility_level));

