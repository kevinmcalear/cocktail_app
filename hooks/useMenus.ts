import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { sortRecipesByOrder } from '@/lib/recipeUtils';
import { normalizeAllowedTypes, type SectionDrinkType } from '@/lib/sectionAllowedTypes';
import { supabase } from '@/lib/supabase';
import type { MenuDetail, MenuDrink, MenuSummary } from '@/types/menus';

const MENU_COLUMNS = 'id, name, bar_id, created_by, cover_url, cover_position, starts_at, ends_at, created_at';

interface MenuRow {
  id: string;
  name: string;
  bar_id: string | null;
  created_by: string | null;
  cover_url: string | null;
  cover_position: number | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function toSummaryBase(row: MenuRow) {
  return {
    id: row.id,
    name: row.name,
    barId: row.bar_id,
    createdBy: row.created_by,
    coverUrl: row.cover_url,
    coverPosition: row.cover_position ?? 50,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  };
}

/** Query keys, for invalidating after a write. */
export const menuKeys = {
  all: ['menus-v2'] as const,
  venue: (barId: string | null, userId: string | null) => ['menus-v2', 'venue', barId, userId] as const,
  detail: (menuId: string) => ['menus-v2', 'detail', menuId] as const,
};

/**
 * A venue's menus, plus the person's own menus (no venue), for the Menus list
 * and Tonight. Every state: drafts, coming up, on now, previous.
 */
export function useVenueMenus(barId: string | null | undefined) {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: menuKeys.venue(barId ?? null, userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<MenuSummary[]> => {
      // ponytail: every menu the venue has ever had, in one page. A venue runs
      // a handful a year; page by ends_at if one ever has hundreds.
      const scope = barId ? `bar_id.eq.${barId},and(bar_id.is.null,created_by.eq.${userId})` : `and(bar_id.is.null,created_by.eq.${userId})`;
      const { data, error } = await supabase
        .from('menus')
        .select(`${MENU_COLUMNS}, menu_drinks(item_id), events(id, name, starts_at)`)
        .or(scope)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const event = one(row.events as { id: string; name: string; starts_at: string }[] | null);
        return {
          ...toSummaryBase(row as MenuRow),
          itemIds: ((row.menu_drinks ?? []) as { item_id: string | null }[]).map((d) => d.item_id).filter((id): id is string => !!id),
          event: event ? { id: event.id, name: event.name, startsAt: event.starts_at } : null,
        };
      });
    },
  });
}

interface ItemRow {
  id: string;
  name: string;
  item_type: string;
  description: string | null;
  brand_maker: string | null;
  origin: string | null;
  price: string | null;
  glass: { icon_key: string | null; name: string | null } | { icon_key: string | null; name: string | null }[] | null;
  item_images: ItemImageLink[] | ItemImageLink | null;
  recipes: { sort_order: number | null; created_at?: string; display_ingredient: { name: string } | { name: string }[] | null }[] | null;
}

const KINDS: SectionDrinkType[] = ['cocktail', 'beer', 'wine'];

export function toMenuDrink(item: ItemRow): MenuDrink | null {
  const kind = KINDS.find((k) => k === item.item_type);
  if (!kind) return null;
  const images = Array.isArray(item.item_images) ? item.item_images : item.item_images ? [item.item_images] : [];
  const hero = heroPicture(images);
  const glass = one(item.glass);
  const line =
    kind === 'cocktail'
      ? sortRecipesByOrder(item.recipes ?? [])
          .map((r) => one(r.display_ingredient)?.name)
          .filter((n): n is string => !!n)
          .join(', ') || (item.description ?? '')
      : [item.brand_maker, item.origin].filter(Boolean).join(' · ') || (item.description ?? '');
  return {
    id: item.id,
    name: item.name,
    kind,
    line,
    price: item.price ?? null,
    imageUrl: hero?.url ?? null,
    isSketch: hero?.isSketch ?? false,
    glass: glass?.icon_key || glass?.name || null,
  };
}

export const MENU_DRINK_ITEM = `item:items!item_id(id, name, item_type, description, brand_maker, origin, price, glass:glassware_id(icon_key, name),
  item_images(sort_order, is_generated, images(url)),
  recipes:app_recipe_presentation!recipe_item_id(sort_order, created_at, display_ingredient(name)))`;

/** One menu with its sections in order and each section's drinks in order. */
export function useMenu(menuId: string | null | undefined) {
  return useQuery({
    queryKey: menuKeys.detail(menuId ?? ''),
    enabled: !!menuId,
    staleTime: 30_000,
    queryFn: async (): Promise<MenuDetail | null> => {
      const [menuRes, sectionsRes] = await Promise.all([
        supabase.from('menus').select(MENU_COLUMNS).eq('id', menuId!).maybeSingle(),
        supabase
          .from('menu_sections')
          .select(`id, name, sort_order, min_items, max_items, allowed_types, menu_drinks(sort_order, ${MENU_DRINK_ITEM})`)
          .eq('menu_id', menuId!)
          .order('sort_order'),
      ]);
      if (menuRes.error) throw menuRes.error;
      if (sectionsRes.error) throw sectionsRes.error;
      if (!menuRes.data) return null;
      return {
        ...toSummaryBase(menuRes.data as MenuRow),
        sections: (sectionsRes.data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          minItems: s.min_items ?? 0,
          maxItems: s.max_items ?? null,
          allowedTypes: normalizeAllowedTypes(s.allowed_types),
          drinks: [...((s.menu_drinks ?? []) as { sort_order: number | null; item: ItemRow | ItemRow[] | null }[])]
            .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
            .map((d) => one(d.item))
            .filter((i): i is ItemRow => !!i)
            .map(toMenuDrink)
            .filter((d): d is MenuDrink => !!d),
        })),
      };
    },
  });
}
