-- 1. DROP UNUSED TABLES
DROP TABLE IF EXISTS public.categories;

-- 2. CREATE NEW ENUMS
CREATE TYPE item_domain AS ENUM ('beer', 'wine', 'spirit', 'ingredient', 'cocktail_family', 'glassware_style');
CREATE TYPE entity_type AS ENUM ('cocktail', 'ingredient', 'beer', 'wine', 'glassware', 'method', 'ice', 'family');
CREATE TYPE attribute_type_enum AS ENUM ('tasting_note', 'physical_trait');

-- 3. CREATE NEW CORE TABLES

-- The Taxonomy Tree
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    domain item_domain,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- The Monolithic Items Table
CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    item_type entity_type NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Cocktail/Recipe Specific Fields
    glassware_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    family_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    ice_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    notes TEXT,
    origin TEXT,

    -- Product/Ingredient Specific Fields
    price TEXT,
    status TEXT,
    brand_maker TEXT,
    abv NUMERIC,
    location TEXT,
    style TEXT
);

-- Item <> Category Mapping
CREATE TABLE public.item_categories (
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    PRIMARY KEY (item_id, category_id)
);

-- Item <> Method Mapping (A cocktail can have multiple methods)
CREATE TABLE public.item_methods (
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    method_item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    sort_order NUMERIC,
    PRIMARY KEY (item_id, method_item_id)
);

-- Attributes structure
CREATE TABLE public.attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type attribute_type_enum NOT NULL
);

CREATE TABLE public.category_attributes (
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    attribute_id UUID REFERENCES public.attributes(id) ON DELETE CASCADE,
    PRIMARY KEY (category_id, attribute_id)
);

CREATE TABLE public.item_attributes (
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    attribute_id UUID REFERENCES public.attributes(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, attribute_id)
);

-- 4. UPDATE EXISTING TABLES TO POINT TO NEW ITEMS

-- We need a temporary structure to hold the new recipes until we drop the old one, 
-- or we can just alter the existing recipes table. It's safer to create a new one and drop the old one.
CREATE TABLE public.new_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    recipe_item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    ingredient_item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    amount NUMERIC,
    unit TEXT,
    preparation_notes TEXT,
    is_optional BOOLEAN DEFAULT false,
    parent_ingredient_id UUID REFERENCES public.items(id) ON DELETE SET NULL
);

-- Ingredient Replacements
CREATE TABLE public.substitutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    substitute_item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    notes TEXT
);

-- Polymorphic Images
CREATE TABLE public.item_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    image_id UUID REFERENCES public.images(id) ON DELETE CASCADE,
    sort_order NUMERIC
);

-- Menu Drinks Refactor
CREATE TABLE public.new_menu_drinks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    menu_id UUID REFERENCES public.menus(id) ON DELETE CASCADE,
    template_section_id UUID REFERENCES public.template_sections(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    sort_order NUMERIC
);

-- 5. DATA MIGRATION SCRIPT

-- Migrate Ingredients
INSERT INTO public.items (id, name, item_type, description, created_at)
SELECT id, name, 'ingredient'::entity_type, description, created_at
FROM public.ingredients;

-- Migrate Beers
INSERT INTO public.items (id, name, item_type, description, abv, location, style, brand_maker, created_at)
SELECT id, name, 'beer'::entity_type, description, abv, location, style, brewery, created_at
FROM public.beers;

-- Migrate Wines
INSERT INTO public.items (id, name, item_type, description, price, abv, location, created_at)
SELECT id, name, 'wine'::entity_type, description, price, abv, location, created_at
FROM public.wines;

-- Migrate Methods, Glassware, Ice, Families
INSERT INTO public.items (id, name, item_type, created_at)
SELECT id, name, 'method'::entity_type, created_at FROM public.methods;

INSERT INTO public.items (id, name, item_type, created_at)
SELECT id, name, 'glassware'::entity_type, created_at FROM public.glassware;

INSERT INTO public.items (id, name, item_type, created_at)
SELECT id, name, 'ice'::entity_type, created_at FROM public.ice;

INSERT INTO public.items (id, name, item_type, created_at)
SELECT id, name, 'family'::entity_type, created_at FROM public.families;

-- Migrate Cocktails (This relies on the relationships above existing in items now)
-- method_id is omitted here because it moves to the join table
-- garnish and spec fields are also permanently dropped as obsolete
INSERT INTO public.items (
    id, name, item_type, description, created_at, 
    glassware_id, family_id, ice_id, 
    notes, origin
)
SELECT 
    id, name, 'cocktail'::entity_type, description, created_at,
    glassware_id, family_id, ice_id,
    notes, origin
FROM public.cocktails;

-- Migrate the old 1:1 method_id into the new many:many item_methods table
INSERT INTO public.item_methods (item_id, method_item_id, sort_order)
SELECT id, method_id, 1 
FROM public.cocktails 
WHERE method_id IS NOT NULL;

-- Automatically generate unique Ingredients from the legacy text-based Garnishes!
-- We use a WHERE NOT EXISTS subquery to guarantee we don't create "Lime Wedge" if it already exists in the ingredients table.
INSERT INTO public.items (name, item_type)
SELECT DISTINCT trim(g), 'ingredient'::entity_type
FROM (
    SELECT garnish_1 as g FROM public.cocktails WHERE garnish_1 IS NOT NULL
    UNION
    SELECT garnish_2 as g FROM public.cocktails WHERE garnish_2 IS NOT NULL
) temp
WHERE g != '' 
AND NOT EXISTS (
    SELECT 1 FROM public.items i WHERE lower(i.name) = lower(trim(temp.g)) AND i.item_type = 'ingredient'
);

-- Migrate Images to the highly polymorphic table
INSERT INTO public.item_images (item_id, image_id, sort_order)
SELECT ingredient_id, image_id, sort_order FROM public.ingredient_images;

INSERT INTO public.item_images (item_id, image_id, sort_order)
SELECT cocktail_id, image_id, sort_order FROM public.cocktail_images;

INSERT INTO public.item_images (item_id, image_id, sort_order)
SELECT wine_id, image_id, sort_order FROM public.wine_images;

INSERT INTO public.item_images (item_id, image_id, sort_order)
SELECT beer_id, image_id, sort_order FROM public.beer_images;

-- Migrate Recipes 
-- This elegantly converts the old 4 columns into the new standardized 'amount' and 'unit' columns
INSERT INTO public.new_recipes (
    id, created_at, recipe_item_id, ingredient_item_id, 
    amount, unit, parent_ingredient_id
)
SELECT 
    id, created_at, cocktail_id, ingredient_id,
    -- If it's a 'top', the amount is 1, otherwise coalesce the old values
    CASE WHEN is_top = true THEN 1 ELSE COALESCE(ingredient_amount, ingredient_ml, ingredient_dash, ingredient_bsp) END,
    -- Convert our is_top boolean into just another unit, else map the amounts
    CASE 
        WHEN is_top = true THEN 'top'
        WHEN ingredient_amount IS NOT NULL THEN 'oz'
        WHEN ingredient_ml IS NOT NULL THEN 'ml'
        WHEN ingredient_dash IS NOT NULL THEN 'dash'
        WHEN ingredient_bsp IS NOT NULL THEN 'bsp'
        ELSE NULL
    END as unit,
    parent_ingredient_id
FROM public.recipes;

-- Now map the recently created Garnish Ingredients via the Recipes table!
INSERT INTO public.new_recipes (recipe_item_id, ingredient_item_id, preparation_notes, amount)
SELECT c.id, i.id, 'garnish', 1
FROM public.cocktails c
JOIN public.items i ON i.name = trim(c.garnish_1) AND i.item_type = 'ingredient'
WHERE c.garnish_1 IS NOT NULL;

INSERT INTO public.new_recipes (recipe_item_id, ingredient_item_id, preparation_notes, amount)
SELECT c.id, i.id, 'garnish', 1
FROM public.cocktails c
JOIN public.items i ON i.name = trim(c.garnish_2) AND i.item_type = 'ingredient'
WHERE c.garnish_2 IS NOT NULL;

-- Migrate Menu Drinks
INSERT INTO public.new_menu_drinks (id, created_at, menu_id, template_section_id, item_id, sort_order)
SELECT id, created_at, menu_id, template_section_id, COALESCE(cocktail_id, beer_id, wine_id), sort_order
FROM public.menu_drinks;

-- 6. DROP OLD TABLES AND RENAME NEW ONES

-- Drop old image tables
DROP TABLE IF EXISTS public.ingredient_images CASCADE;
DROP TABLE IF EXISTS public.cocktail_images CASCADE;
DROP TABLE IF EXISTS public.wine_images CASCADE;
DROP TABLE IF EXISTS public.beer_images CASCADE;

-- Drop old relations
DROP TABLE IF EXISTS public.recipes CASCADE;
DROP TABLE IF EXISTS public.menu_drinks CASCADE;

-- Rename new relations to the expected names
ALTER TABLE public.new_recipes RENAME TO recipes;
ALTER TABLE public.new_menu_drinks RENAME TO menu_drinks;

-- (Keep the actual entity tables like public.cocktails for now as backup, we will drop them in a later migration once verify types.ts works)
