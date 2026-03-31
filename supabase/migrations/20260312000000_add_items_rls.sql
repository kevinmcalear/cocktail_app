-- Enable RLS on all new tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_drinks ENABLE ROW LEVEL SECURITY;

-- Create Policies to allow public read access
CREATE POLICY "Allow public read access to categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow public read access to items" ON public.items FOR SELECT USING (true);
CREATE POLICY "Allow public read access to item_categories" ON public.item_categories FOR SELECT USING (true);
CREATE POLICY "Allow public read access to item_methods" ON public.item_methods FOR SELECT USING (true);
CREATE POLICY "Allow public read access to attributes" ON public.attributes FOR SELECT USING (true);
CREATE POLICY "Allow public read access to category_attributes" ON public.category_attributes FOR SELECT USING (true);
CREATE POLICY "Allow public read access to item_attributes" ON public.item_attributes FOR SELECT USING (true);
CREATE POLICY "Allow public read access to recipes" ON public.recipes FOR SELECT USING (true);
CREATE POLICY "Allow public read access to substitutions" ON public.substitutions FOR SELECT USING (true);
CREATE POLICY "Allow public read access to item_images" ON public.item_images FOR SELECT USING (true);
CREATE POLICY "Allow public read access to menu_drinks" ON public.menu_drinks FOR SELECT USING (true);

-- Create Policies to allow public write access for edits/adds
CREATE POLICY "Allow public insert access to categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to categories" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to categories" ON public.categories FOR DELETE USING (true);

CREATE POLICY "Allow public insert access to items" ON public.items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to items" ON public.items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to items" ON public.items FOR DELETE USING (true);

CREATE POLICY "Allow public insert access to item_categories" ON public.item_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to item_categories" ON public.item_categories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to item_categories" ON public.item_categories FOR DELETE USING (true);

CREATE POLICY "Allow public insert access to item_methods" ON public.item_methods FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to item_methods" ON public.item_methods FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to item_methods" ON public.item_methods FOR DELETE USING (true);

CREATE POLICY "Allow public insert access to recipes" ON public.recipes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to recipes" ON public.recipes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to recipes" ON public.recipes FOR DELETE USING (true);

CREATE POLICY "Allow public insert access to item_images" ON public.item_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to item_images" ON public.item_images FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to item_images" ON public.item_images FOR DELETE USING (true);

CREATE POLICY "Allow public insert access to menu_drinks" ON public.menu_drinks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to menu_drinks" ON public.menu_drinks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to menu_drinks" ON public.menu_drinks FOR DELETE USING (true);
