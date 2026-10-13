-- Public pages, signed out (canvas group 9): a public drink's ingredient
-- names without amounts, and a catalog classic's lineage parent.
--
-- Decided 10 Oct: signed out, a drink page shows the ingredients without
-- amounts. app_recipe_presentation names a drink's ingredients only when its
-- spec is shared, and recipes are closed to anon, so a classic or a bar's
-- description-only drink shows no names (ppl-pub-drink-phone draws them, and
-- the shared menu rows and link previews read them as the drink's line).
-- A catalog classic's family (Whisky Sour > Gold Rush > Penicillin) is in
-- items.lineage_parent_id, which published_items doesn't carry, so the public
-- family tree stops at the drink (ppl-pub-drink-desktop draws the ancestors).

-- Names only: never amounts, units or prep. Named as a shared spec names them
-- (published_items' reference rows, #502): the line's parent, else the
-- bottle's generic, else the ingredient itself, and only when that is a shared
-- catalog ingredient (no bar, no creator); a bar's house prep stays unnamed.
-- A locked bar page shows none.
create or replace function public.public_drink_ingredients(p_item_ids uuid[])
returns table (item_id uuid, sort_order integer, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.recipe_item_id, r.sort_order, pi.name
  from private.published_listing l
  join public.recipes r on r.recipe_item_id operator(pg_catalog.=) l.id
  left join public.items s on s.id operator(pg_catalog.=) r.ingredient_item_id
  join public.items pi
    on pi.id operator(pg_catalog.=) coalesce(r.parent_ingredient_id, s.generic_id, r.ingredient_item_id)
   and pi.bar_id is null and pi.created_by is null and pi.moderated_at is null
  where l.id operator(pg_catalog.=) any (p_item_ids[1:200])
    and l.effective_mode operator(pg_catalog.<>) 'private'::public.item_publish_mode
    and not l.page_locked
  order by r.recipe_item_id, r.sort_order, r.created_at;
$$;

revoke all on function public.public_drink_ingredients(uuid[]) from public;
grant execute on function public.public_drink_ingredients(uuid[]) to anon, authenticated;

-- A public catalog classic's parent classic, when both are public.
create or replace function public.public_lineage_parent(p_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.lineage_parent_id
  from public.items i
  join private.published_listing l on l.id operator(pg_catalog.=) i.id
  join private.published_listing p on p.id operator(pg_catalog.=) i.lineage_parent_id
  where i.id operator(pg_catalog.=) p_item_id
    and i.is_catalog
    and i.riff_of_id is null;
$$;

revoke all on function public.public_lineage_parent(uuid) from public;
grant execute on function public.public_lineage_parent(uuid) to anon, authenticated;
