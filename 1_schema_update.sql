-- Create lookup tables
CREATE TABLE IF NOT EXISTS methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS glassware (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT UNIQUE NOT NULL
);

-- Ensure ingredients and recipes tables exist (based on your screenshot)
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cocktail_id UUID REFERENCES cocktails(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    ingredient_ml NUMERIC,
    ingredient_dash NUMERIC,
    ingredient_amount NUMERIC
);

-- Modify cocktails table
ALTER TABLE cocktails
ADD COLUMN IF NOT EXISTS method_id UUID REFERENCES methods(id),
ADD COLUMN IF NOT EXISTS glassware_id UUID REFERENCES glassware(id),
ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS origin TEXT,
ADD COLUMN IF NOT EXISTS garnish TEXT,
ADD COLUMN IF NOT EXISTS spec TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cocktails_method_id ON cocktails(method_id);
CREATE INDEX IF NOT EXISTS idx_cocktails_glassware_id ON cocktails(glassware_id);
CREATE INDEX IF NOT EXISTS idx_cocktails_family_id ON cocktails(family_id);
CREATE INDEX IF NOT EXISTS idx_recipes_cocktail_id ON recipes(cocktail_id);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient_id ON recipes(ingredient_id);
