-- Drink types allowed in a menu section (cocktail / beer / wine). Default: all three.
alter table public.template_sections
  add column if not exists allowed_types text[] not null default array['cocktail', 'beer', 'wine']::text[];

alter table public.template_sections
  drop constraint if exists template_sections_allowed_types_check;

alter table public.template_sections
  add constraint template_sections_allowed_types_check
  check (
    allowed_types <@ array['cocktail', 'beer', 'wine']::text[]
    and cardinality(allowed_types) >= 1
  );
