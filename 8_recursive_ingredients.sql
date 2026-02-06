-- 8_recursive_ingredients.sql

-- 1. Modify ingredients to support batch metadata
ALTER TABLE ingredients
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_batch BOOLEAN DEFAULT false;

-- 2. Modify recipes to support recursion (ingredients having recipes)
ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS parent_ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE;

-- Ensure cocktail_id can be null (if it wasn't already)
ALTER TABLE recipes
ALTER COLUMN cocktail_id DROP NOT NULL;

-- 3. Add constraint: A recipe item belongs to EITHER a cocktail OR a parent ingredient
-- We use a DO block to safely add the constraint only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'recipes_parent_check'
    ) THEN
        ALTER TABLE recipes
        ADD CONSTRAINT recipes_parent_check
        CHECK (
            (cocktail_id IS NOT NULL AND parent_ingredient_id IS NULL) OR
            (cocktail_id IS NULL AND parent_ingredient_id IS NOT NULL)
        );
    END IF;
END $$;

-- 4. Add index for performance on the new column
CREATE INDEX IF NOT EXISTS idx_recipes_parent_ingredient_id ON recipes(parent_ingredient_id);

-- 5. Modify cocktails to support structured garnishes (linking to ingredients)
ALTER TABLE cocktails
ADD COLUMN IF NOT EXISTS garnish_id UUID REFERENCES ingredients(id) ON DELETE SET NULL;

-- 6. Add index for garnish lookup
CREATE INDEX IF NOT EXISTS idx_cocktails_garnish_id ON cocktails(garnish_id);

-- 7. Comment on implementation
COMMENT ON COLUMN recipes.parent_ingredient_id IS 'If set, this recipe item belongs to a batch ingredient, not a cocktail directly.';
COMMENT ON COLUMN cocktails.garnish_id IS 'Links to an ingredient that serves as the garnish. That ingredient may be a simple item or a batch with its own recipe.';
