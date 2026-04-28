-- 1. Create top-level parent categories for Beer and Wine
DO $$
DECLARE
    gen_beer_styles_id UUID := gen_random_uuid();
    gen_beer_regions_id UUID := gen_random_uuid();
    gen_wine_styles_id UUID := gen_random_uuid();
    gen_wine_regions_id UUID := gen_random_uuid();
    
    cat_id UUID;
    rec RECORD;
BEGIN
    -- Insert root parent domains
    INSERT INTO public.categories (id, name, domain) VALUES
    (gen_beer_styles_id, 'Beer Styles', 'beer'),
    (gen_beer_regions_id, 'Beer Regions', 'beer'),
    (gen_wine_styles_id, 'Wine Styles', 'wine'),
    (gen_wine_regions_id, 'Wine Regions', 'wine');

    -- Seed Industry Best Practice Sub-Categories
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
