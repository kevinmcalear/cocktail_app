-- Demo prep data for LOCAL development only, on top of supabase/seed_demo.sql
-- and the step 4 tables (bar_zones, item_prep, suppliers, item_purchasing,
-- events). Made-up venues; classic specs.
--
--   docker exec -i supabase_db_<project> psql -U postgres < supabase/seed_demo.sql
--   docker exec -i supabase_db_<project> psql -U postgres < supabase/seed_demo_prep.sql

begin;

-- Ingredients: bought ones are shared catalogue items; house-made ones belong
-- to Little Rye.
insert into public.items (id, name, item_type, bar_id) values
  ('00000000-0000-4000-f000-000000000001', 'Blended Scotch', 'ingredient', null),
  ('00000000-0000-4000-f000-000000000002', 'Lemon juice', 'ingredient', null),
  ('00000000-0000-4000-f000-000000000003', 'Islay Scotch', 'ingredient', null),
  ('00000000-0000-4000-f000-000000000004', 'Honey', 'ingredient', null),
  ('00000000-0000-4000-f000-000000000005', 'Fresh ginger', 'ingredient', null),
  ('00000000-0000-4000-f000-000000000006', 'London dry gin', 'ingredient', null),
  ('00000000-0000-4000-f000-000000000007', 'Dry vermouth', 'ingredient', null),
  ('00000000-0000-4000-f000-000000000008', 'Extra virgin olive oil', 'ingredient', null),
  ('00000000-0000-4000-f000-000000000101', 'Honey-ginger syrup', 'ingredient', '00000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-f000-000000000102', 'Olive oil-washed gin', 'ingredient', '00000000-0000-4000-a000-000000000001')
on conflict (id) do nothing;

-- Specs (per serve) and house-made recipes (per batch).
insert into public.recipes (id, recipe_item_id, ingredient_item_id, amount, unit, sort_order) values
  -- Penicillin
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-c000-000000000004', '00000000-0000-4000-f000-000000000001', 60, 'ml', 1),
  ('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-c000-000000000004', '00000000-0000-4000-f000-000000000002', 22.5, 'ml', 2),
  ('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-c000-000000000004', '00000000-0000-4000-f000-000000000101', 22.5, 'ml', 3),
  ('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-c000-000000000004', '00000000-0000-4000-f000-000000000003', 7.5, 'ml', 4),
  -- House Martini
  ('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-f000-000000000102', 60, 'ml', 1),
  ('00000000-0000-4000-9000-000000000012', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-f000-000000000007', 15, 'ml', 2),
  -- Honey-ginger syrup, one batch
  ('00000000-0000-4000-9000-000000000021', '00000000-0000-4000-f000-000000000101', '00000000-0000-4000-f000-000000000004', 500, 'g', 1),
  ('00000000-0000-4000-9000-000000000022', '00000000-0000-4000-f000-000000000101', '00000000-0000-4000-f000-000000000005', 200, 'g', 2),
  -- Olive oil-washed gin, one batch
  ('00000000-0000-4000-9000-000000000031', '00000000-0000-4000-f000-000000000102', '00000000-0000-4000-f000-000000000006', 1, 'L', 1),
  ('00000000-0000-4000-9000-000000000032', '00000000-0000-4000-f000-000000000102', '00000000-0000-4000-f000-000000000008', 100, 'ml', 2)
on conflict (id) do nothing;

insert into public.item_prep (item_id, yield_amount, yield_unit, shelf_life_hours, lead_time_minutes, lead_time_note) values
  ('00000000-0000-4000-f000-000000000101', 750, 'ml', 168, 30, 'Cool before bottling'),
  ('00000000-0000-4000-f000-000000000102', 1, 'L', 336, 720, '12 h in the freezer, then strain')
on conflict (item_id) do nothing;

insert into public.suppliers (id, bar_id, name) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-a000-000000000001', 'Northside Liquor'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-a000-000000000001', 'Victoria Market')
on conflict (id) do nothing;

insert into public.item_purchasing (bar_id, item_id, supplier_id, pack_size_amount, pack_size_unit) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-f000-000000000001', '00000000-0000-4000-8000-000000000001', 700, 'ml'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-f000-000000000003', '00000000-0000-4000-8000-000000000001', 700, 'ml'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-f000-000000000006', '00000000-0000-4000-8000-000000000001', 700, 'ml'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-f000-000000000007', '00000000-0000-4000-8000-000000000001', 750, 'ml'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-f000-000000000004', '00000000-0000-4000-8000-000000000002', 1, 'kg'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-f000-000000000005', '00000000-0000-4000-8000-000000000002', 500, 'g')
on conflict (bar_id, item_id) do nothing;

-- A takeover next Friday at 7 pm, on the Autumn menu, for 140 guests.
insert into public.events (id, bar_id, name, starts_at, menu_id, covers_estimate) values
  ('00000000-0000-4000-7000-000000000001', '00000000-0000-4000-a000-000000000001', 'Pale Moth takeover',
   date_trunc('day', now()) + ((12 - extract(dow from now())::int) % 7 + 1) * interval '1 day' + interval '19 hours',
   '00000000-0000-4000-d000-000000000001', 140)
on conflict (id) do nothing;

commit;
