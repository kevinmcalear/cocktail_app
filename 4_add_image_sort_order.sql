-- Add sort_order column to cocktail_images for ordering support
ALTER TABLE cocktail_images 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Ensure we can upsert by adding a specific unique index if it doesn't exist
-- We use "IF NOT EXISTS" idiom or just try to create it. PostgreSQL 9.5+ supports "IF NOT EXISTS" for indexes? 
-- Yes, CREATE INDEX IF NOT EXISTS...
CREATE UNIQUE INDEX IF NOT EXISTS idx_cocktail_images_cocktail_image 
ON cocktail_images (cocktail_id, image_id);
