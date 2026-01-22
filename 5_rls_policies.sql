-- Enable RLS
ALTER TABLE cocktails ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Cocktails Policies
DROP POLICY IF EXISTS "Public read access" ON cocktails;
CREATE POLICY "Public read access" ON cocktails FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert access" ON cocktails;
CREATE POLICY "Authenticated insert access" ON cocktails FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update access" ON cocktails;
CREATE POLICY "Authenticated update access" ON cocktails FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated delete access" ON cocktails;
CREATE POLICY "Authenticated delete access" ON cocktails FOR DELETE TO authenticated USING (true);

-- Ingredients Policies
DROP POLICY IF EXISTS "Public read access" ON ingredients;
CREATE POLICY "Public read access" ON ingredients FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert access" ON ingredients;
CREATE POLICY "Authenticated insert access" ON ingredients FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update access" ON ingredients;
CREATE POLICY "Authenticated update access" ON ingredients FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated delete access" ON ingredients;
CREATE POLICY "Authenticated delete access" ON ingredients FOR DELETE TO authenticated USING (true);

-- Recipes Policies
DROP POLICY IF EXISTS "Public read access" ON recipes;
CREATE POLICY "Public read access" ON recipes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert access" ON recipes;
CREATE POLICY "Authenticated insert access" ON recipes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update access" ON recipes;
CREATE POLICY "Authenticated update access" ON recipes FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated delete access" ON recipes;
CREATE POLICY "Authenticated delete access" ON recipes FOR DELETE TO authenticated USING (true);
