-- Enable RLS for image related tables
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE cocktail_images ENABLE ROW LEVEL SECURITY;

-- Images Policies
DROP POLICY IF EXISTS "Public read access" ON images;
CREATE POLICY "Public read access" ON images FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert access" ON images;
CREATE POLICY "Authenticated insert access" ON images FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update access" ON images;
CREATE POLICY "Authenticated update access" ON images FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated delete access" ON images;
CREATE POLICY "Authenticated delete access" ON images FOR DELETE TO authenticated USING (true);

-- Cocktail Images Policies
DROP POLICY IF EXISTS "Public read access" ON cocktail_images;
CREATE POLICY "Public read access" ON cocktail_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert access" ON cocktail_images;
CREATE POLICY "Authenticated insert access" ON cocktail_images FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update access" ON cocktail_images;
CREATE POLICY "Authenticated update access" ON cocktail_images FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated delete access" ON cocktail_images;
CREATE POLICY "Authenticated delete access" ON cocktail_images FOR DELETE TO authenticated USING (true);
