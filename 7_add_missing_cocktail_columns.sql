-- Ensure lookup tables exist
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

-- Add missing columns to cocktails table
ALTER TABLE cocktails
ADD COLUMN IF NOT EXISTS method_id UUID REFERENCES methods(id),
ADD COLUMN IF NOT EXISTS glassware_id UUID REFERENCES glassware(id),
ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS origin TEXT,
ADD COLUMN IF NOT EXISTS garnish TEXT,
ADD COLUMN IF NOT EXISTS spec TEXT;

-- Enable RLS for new tables
ALTER TABLE methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE glassware ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Public read policies for lookups
CREATE POLICY "Public methods are viewable" ON methods FOR SELECT USING (true);
CREATE POLICY "Public glassware are viewable" ON glassware FOR SELECT USING (true);
CREATE POLICY "Public families are viewable" ON families FOR SELECT USING (true);
