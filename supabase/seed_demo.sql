-- Demo data for LOCAL development and screen checks only: two made-up venues,
-- glassware, drinks and a current menu at each. Nothing here is real.
--
--   docker exec -i supabase_db_cocktail_app psql -U postgres < supabase/seed_demo.sql
--   node scripts/dev-user.mjs     (a local test user who works at both venues)
--
-- Safe to re-run: fixed ids, and conflicting rows are left alone.

begin;

insert into public.bars (id, name, slug, primary_color, secondary_color) values
  ('00000000-0000-4000-a000-000000000001', 'Little Rye', 'little-rye', '#D0643B', '#F4E6D0'),
  ('00000000-0000-4000-a000-000000000002', 'Pale Moth', 'pale-moth', '#B9A8F5', '#241F3D')
on conflict (id) do nothing;

-- Shared catalogue glassware (no venue). icon_key matches components/ui/CustomIcons.
insert into public.items (id, name, item_type, icon_key) values
  ('00000000-0000-4000-b000-000000000001', 'Coupe', 'glassware', 'Coupe'),
  ('00000000-0000-4000-b000-000000000002', 'Rocks', 'glassware', 'Rocks'),
  ('00000000-0000-4000-b000-000000000003', 'Nick & Nora', 'glassware', 'Coupette'),
  ('00000000-0000-4000-b000-000000000004', 'Highball', 'glassware', 'Highball')
on conflict (id) do nothing;

insert into public.items (id, name, item_type, bar_id, glassware_id, description) values
  ('00000000-0000-4000-c000-000000000001', 'House Martini', 'cocktail', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', 'Gin, dry vermouth, orange bitters. Very cold.'),
  ('00000000-0000-4000-c000-000000000002', 'Bolo Tie', 'cocktail', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000003', 'Rye, amaro, orange.'),
  ('00000000-0000-4000-c000-000000000003', 'Champ Stamp', 'cocktail', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Bourbon, strawberry, smoke.'),
  ('00000000-0000-4000-c000-000000000004', 'Penicillin', 'cocktail', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'Blended Scotch, lemon, honey-ginger, Islay float.'),
  ('00000000-0000-4000-c000-000000000005', 'Moth Colada', 'cocktail', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000001', 'Rum, coconut, champagne.'),
  ('00000000-0000-4000-c000-000000000006', 'Luna Splice', 'cocktail', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000004', 'Melon, pineapple, cream.')
on conflict (id) do nothing;

insert into public.menus (id, name, bar_id, is_active) values
  ('00000000-0000-4000-d000-000000000001', 'Autumn menu', '00000000-0000-4000-a000-000000000001', true),
  ('00000000-0000-4000-d000-000000000002', 'Night garden', '00000000-0000-4000-a000-000000000002', true)
on conflict (id) do nothing;

insert into public.menu_drinks (id, menu_id, item_id, sort_order) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000001', 1),
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000002', 2),
  ('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000003', 3),
  ('00000000-0000-4000-e000-000000000004', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000004', 4),
  ('00000000-0000-4000-e000-000000000005', '00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c000-000000000005', 1),
  ('00000000-0000-4000-e000-000000000006', '00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c000-000000000006', 2)
on conflict (id) do nothing;

commit;
