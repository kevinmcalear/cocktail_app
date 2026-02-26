-- Create menu_templates table
CREATE TABLE IF NOT EXISTS public.menu_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create template_sections table
CREATE TABLE IF NOT EXISTS public.template_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.menu_templates(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    min_items INTEGER DEFAULT 1,
    max_items INTEGER DEFAULT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update menus table
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.menu_templates(id);

-- Update menu_drinks table
ALTER TABLE public.menu_drinks ADD COLUMN IF NOT EXISTS template_section_id UUID REFERENCES public.template_sections(id);

-- Add updated_at trigger for menu_templates
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_menu_templates_modtime ON public.menu_templates;
CREATE TRIGGER update_menu_templates_modtime
    BEFORE UPDATE ON public.menu_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.menu_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_sections ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies (Allow all for now, assuming authenticated users can manage menus or public can view)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.menu_templates;
CREATE POLICY "Enable read access for all users" ON public.menu_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.menu_templates;
CREATE POLICY "Enable insert access for all users" ON public.menu_templates FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for all users" ON public.menu_templates;
CREATE POLICY "Enable update access for all users" ON public.menu_templates FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON public.template_sections;
CREATE POLICY "Enable read access for all users" ON public.template_sections FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.template_sections;
CREATE POLICY "Enable insert access for all users" ON public.template_sections FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for all users" ON public.template_sections;
CREATE POLICY "Enable update access for all users" ON public.template_sections FOR UPDATE USING (true);
