-- Add sort_order to menu_drinks if it doesn't exist
ALTER TABLE menu_drinks 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_drinks ENABLE ROW LEVEL SECURITY;

-- Policies for Menus
-- Anyone can view active menus
CREATE POLICY "Public menus are viewable by everyone" 
ON menus FOR SELECT 
USING (true);

-- Authenticated users can create/edit menus
CREATE POLICY "Users can insert menus" 
ON menus FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can update menus" 
ON menus FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Users can delete menus" 
ON menus FOR DELETE 
TO authenticated 
USING (true);

-- Policies for Menu Drinks
-- Anyone can view menu items
CREATE POLICY "Public menu drinks are viewable by everyone" 
ON menu_drinks FOR SELECT 
USING (true);

-- Authenticated users can manage menu items
CREATE POLICY "Users can insert menu drinks" 
ON menu_drinks FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can update menu drinks" 
ON menu_drinks FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Users can delete menu drinks" 
ON menu_drinks FOR DELETE 
TO authenticated 
USING (true);
