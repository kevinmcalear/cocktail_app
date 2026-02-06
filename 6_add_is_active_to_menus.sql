-- Add is_active column to menus table
ALTER TABLE menus 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
