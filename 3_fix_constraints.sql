-- Add UNIQUE constraints to existing tables to allow ON CONFLICT to work
-- NOTE: If you have duplicate data in these columns, this will fail. You may need to clean it up first.

ALTER TABLE ingredients ADD CONSTRAINT ingredients_name_key UNIQUE (name);
ALTER TABLE cocktails ADD CONSTRAINT cocktails_name_key UNIQUE (name);

-- Methods, Glassware, Families were created with UNIQUE constraints in step 1, 
-- but just in case they didn't exist or were modified, we ensure them here too (safely):
-- (Postgres doesn't have "ADD CONSTRAINT IF NOT EXISTS" cleanly, but the above created tables usually have it if my script ran.
-- If you need to enforce it on those too, uncomment below ONE BY ONE and run only if needed.
-- ALTER TABLE methods ADD CONSTRAINT methods_name_key UNIQUE (name);
-- ALTER TABLE glassware ADD CONSTRAINT glassware_name_key UNIQUE (name);
-- ALTER TABLE families ADD CONSTRAINT families_name_key UNIQUE (name);
