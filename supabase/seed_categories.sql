-- supabase/seed_categories.sql

-- 1. Create temporary ids for top-level spirits to maintain relationships easily
DO $$
DECLARE
    gen_spirits_id UUID := gen_random_uuid();
    
    -- Level 1
    gin_id UUID := gen_random_uuid();
    vodka_id UUID := gen_random_uuid();
    rum_id UUID := gen_random_uuid();
    whisky_id UUID := gen_random_uuid();
    agave_id UUID := gen_random_uuid();
    brandy_id UUID := gen_random_uuid();
    liqueur_id UUID := gen_random_uuid();
    amaro_id UUID := gen_random_uuid();
    vermouth_id UUID := gen_random_uuid();
BEGIN
    -- Ensure "Spirits" root category exists
    INSERT INTO public.categories (id, name, domain) 
    VALUES (gen_spirits_id, 'Spirits', 'spirit');

    -- Insert Top Level Categories
    INSERT INTO public.categories (id, name, parent_id, domain) VALUES
    (gin_id, 'Gin', gen_spirits_id, 'spirit'),
    (vodka_id, 'Vodka', gen_spirits_id, 'spirit'),
    (rum_id, 'Rum', gen_spirits_id, 'spirit'),
    (whisky_id, 'Whisk(e)y', gen_spirits_id, 'spirit'),
    (agave_id, 'Agave Spirits', gen_spirits_id, 'spirit'),
    (brandy_id, 'Brandy', gen_spirits_id, 'spirit'),
    (liqueur_id, 'Liqueur', gen_spirits_id, 'spirit'),
    (amaro_id, 'Amaro', gen_spirits_id, 'spirit'),
    (vermouth_id, 'Vermouth', gen_spirits_id, 'spirit');

    -- Insert Sub-categories: Gin
    INSERT INTO public.categories (name, parent_id, domain) VALUES
    ('London Dry Gin', gin_id, 'spirit'),
    ('Old Tom Gin', gin_id, 'spirit'),
    ('Navy Strength Gin', gin_id, 'spirit'),
    ('Genever', gin_id, 'spirit'),
    ('Sloe Gin', gin_id, 'spirit');

    -- Insert Sub-categories: Whisk(e)y
    INSERT INTO public.categories (name, parent_id, domain) VALUES
    ('Bourbon', whisky_id, 'spirit'),
    ('Rye Whiskey', whisky_id, 'spirit'),
    ('Scotch Whisky', whisky_id, 'spirit'),
    ('Irish Whiskey', whisky_id, 'spirit'),
    ('Japanese Whisky', whisky_id, 'spirit'),
    ('Canadian Whisky', whisky_id, 'spirit');

    -- Insert Sub-categories: Agave Spirits
    INSERT INTO public.categories (name, parent_id, domain) VALUES
    ('Tequila', agave_id, 'spirit'),
    ('Mezcal', agave_id, 'spirit'),
    ('Sotol', agave_id, 'spirit'),
    ('Raicilla', agave_id, 'spirit'),
    ('Bacanora', agave_id, 'spirit');

    -- 2. Backfill existing items by dynamically looking up the inserted categories
    
    -- GIN
    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, gin_id, true
    FROM public.items i
    WHERE i.item_type = 'ingredient' 
      AND i.name ILIKE '%Gin%'
    ON CONFLICT DO NOTHING;

    -- VODKA
    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, vodka_id, true
    FROM public.items i
    WHERE i.item_type = 'ingredient' 
      AND i.name ILIKE '%Vodka%'
    ON CONFLICT DO NOTHING;

    -- RUM
    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, rum_id, true
    FROM public.items i
    WHERE i.item_type = 'ingredient' 
      AND i.name ILIKE '%Rum%'
    ON CONFLICT DO NOTHING;

    -- WHISK(E)Y
    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, whisky_id, true
    FROM public.items i
    WHERE i.item_type = 'ingredient' 
      AND (i.name ILIKE '%Whisky%' OR i.name ILIKE '%Whiskey%' OR i.name ILIKE '%Bourbon%' OR i.name ILIKE '%Scotch%' OR i.name ILIKE '%Rye%')
    ON CONFLICT DO NOTHING;

    -- AGAVE SPIRITS - Assign specific Mezcal and Tequila back up to Agave if needed,
    -- but optimally assign to specific sub-categories if possible. We'll do a generic pass first.
    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, c.id, true
    FROM public.items i
    JOIN public.categories c ON c.name = 'Tequila' AND c.parent_id = agave_id
    WHERE i.item_type = 'ingredient' AND i.name ILIKE '%Tequila%'
    ON CONFLICT DO NOTHING;

    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, c.id, true
    FROM public.items i
    JOIN public.categories c ON c.name = 'Mezcal' AND c.parent_id = agave_id
    WHERE i.item_type = 'ingredient' AND i.name ILIKE '%Mezcal%'
    ON CONFLICT DO NOTHING;

    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, c.id, true
    FROM public.items i
    JOIN public.categories c ON c.name = 'Sotol' AND c.parent_id = agave_id
    WHERE i.item_type = 'ingredient' AND i.name ILIKE '%Sotol%'
    ON CONFLICT DO NOTHING;

    -- BRANDY
    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, brandy_id, true
    FROM public.items i
    WHERE i.item_type = 'ingredient' 
      AND (i.name ILIKE '%Brandy%' OR i.name ILIKE '%Cognac%' OR i.name ILIKE '%Armagnac%' OR i.name ILIKE '%Pisco%')
    ON CONFLICT DO NOTHING;

    -- AMARO
    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, amaro_id, true
    FROM public.items i
    WHERE i.item_type = 'ingredient' 
      AND i.name ILIKE '%Amaro%'
    ON CONFLICT DO NOTHING;

    -- VERMOUTH
    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, vermouth_id, true
    FROM public.items i
    WHERE i.item_type = 'ingredient' 
      AND i.name ILIKE '%Vermouth%'
    ON CONFLICT DO NOTHING;

    -- LIQUEUR
    INSERT INTO public.item_categories (item_id, category_id, is_primary)
    SELECT i.id, liqueur_id, true
    FROM public.items i
    WHERE i.item_type = 'ingredient' 
      AND i.name ILIKE '%Liqueur%'
    ON CONFLICT DO NOTHING;

END $$;

-- 3. Create generic Beer and Wine Categories
DO $$
DECLARE
    gen_beer_styles_id UUID := gen_random_uuid();
    gen_beer_regions_id UUID := gen_random_uuid();
    gen_wine_styles_id UUID := gen_random_uuid();
    gen_wine_regions_id UUID := gen_random_uuid();
BEGIN
    -- Insert root parent domains
    INSERT INTO public.categories (id, name, domain) VALUES
    (gen_beer_styles_id, 'Beer Styles', 'beer'),
    (gen_beer_regions_id, 'Beer Regions', 'beer'),
    (gen_wine_styles_id, 'Wine Styles', 'wine'),
    (gen_wine_regions_id, 'Wine Regions', 'wine');

    -- BEER STYLES
    INSERT INTO public.categories (name, parent_id, domain) VALUES
    ('IPA', gen_beer_styles_id, 'beer'),
    ('Pale Ale', gen_beer_styles_id, 'beer'),
    ('Stout', gen_beer_styles_id, 'beer'),
    ('Porter', gen_beer_styles_id, 'beer'),
    ('Lager', gen_beer_styles_id, 'beer'),
    ('Pilsner', gen_beer_styles_id, 'beer'),
    ('Wheat Beer', gen_beer_styles_id, 'beer'),
    ('Sour', gen_beer_styles_id, 'beer'),
    ('Amber Ale', gen_beer_styles_id, 'beer'),
    ('Saison', gen_beer_styles_id, 'beer');

    -- BEER REGIONS
    INSERT INTO public.categories (name, parent_id, domain) VALUES
    ('USA', gen_beer_regions_id, 'beer'),
    ('Belgium', gen_beer_regions_id, 'beer'),
    ('Germany', gen_beer_regions_id, 'beer'),
    ('UK', gen_beer_regions_id, 'beer'),
    ('Canada', gen_beer_regions_id, 'beer');

    -- WINE STYLES
    INSERT INTO public.categories (name, parent_id, domain) VALUES
    ('Red', gen_wine_styles_id, 'wine'),
    ('White', gen_wine_styles_id, 'wine'),
    ('Rosé', gen_wine_styles_id, 'wine'),
    ('Sparkling', gen_wine_styles_id, 'wine'),
    ('Dessert', gen_wine_styles_id, 'wine'),
    ('Fortified', gen_wine_styles_id, 'wine'),
    ('Orange', gen_wine_styles_id, 'wine');

    -- WINE REGIONS
    INSERT INTO public.categories (name, parent_id, domain) VALUES
    ('France', gen_wine_regions_id, 'wine'),
    ('Italy', gen_wine_regions_id, 'wine'),
    ('Spain', gen_wine_regions_id, 'wine'),
    ('USA - California', gen_wine_regions_id, 'wine'),
    ('Australia', gen_wine_regions_id, 'wine'),
    ('New Zealand', gen_wine_regions_id, 'wine'),
    ('Argentina', gen_wine_regions_id, 'wine'),
    ('Chile', gen_wine_regions_id, 'wine'),
    ('South Africa', gen_wine_regions_id, 'wine');
END $$;
