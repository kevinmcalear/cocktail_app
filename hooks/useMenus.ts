import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { fetchPublished, type PublishedDrink } from '@/hooks/usePublished';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { sortRecipesByOrder } from '@/lib/recipeUtils';
import { normalizeAllowedTypes, type SectionDrinkType } from '@/lib/sectionAllowedTypes';
import { supabase } from '@/lib/supabase';
import type { MenuDetail, MenuDrink, MenuSummary } from '@/types/menus';

const MENU_COLUMNS = 'id, name, bar_id, created_by, cover_url, cover_position, starts_at, ends_at, created_at, menu_date, guest_count, shared_at';

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
  menu_date: string | null;
  guest_count: number | null;
  shared_at: string | null;
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
    menuDate: row.menu_date,
    guestCount: row.guest_count,
    sharedAt: row.shared_at,
  };
}

/** How many drinks a cover-less menu shows as its visual. */
export const MENU_PICTURES = 4;

type PictureItem = { id: string; name: string; item_images: ItemImageLink[] | ItemImageLink | null };

/** Query keys, for invalidating after a write. */
export const menuKeys = {
  all: ['menus-v2'] as const,
  // 'venue-2': summaries gained pictures, so a persisted older list isn't read back.
  venue: (barId: string | null, userId: string | null) => ['menus-v2', 'venue-2', barId, userId] as const,
  detail: (menuId: string) => ['menus-v2', 'detail', menuId] as const,
};

/**
 * A venue's menus, plus the person's own menus (no venue), for the Menus list
 * and Tonight. Every state: drafts, coming up, on now, previous.
 */
export function useVenueMenus(barId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: menuKeys.venue(barId ?? null, userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<MenuSummary[]> => {
      // ponytail: every menu the venue has ever had, in one page. A venue runs
      // a handful a year; page by ends_at if one ever has hundreds.
      // A venue's list is only the venue's menus; your own live in home mode.
      const scope = barId ? `bar_id.eq.${barId}` : `and(bar_id.is.null,created_by.eq.${userId})`;
      const { data, error } = await supabase
        .from('menus')
        // Every drink's id (Library's "on a menu" filter), but pictures for
        // only the first few: a cover-less menu's visual shows MENU_PICTURES.
        .select(
          `${MENU_COLUMNS}, menu_drinks(item_id), pictured:menu_drinks(sort_order, item:items!item_id(id, name, item_images(angle, sort_order, is_generated, images(url)))), events(id, name, starts_at)`
        )
        .or(scope)
        .order('created_at', { ascending: false })
        .order('sort_order', { referencedTable: 'pictured' })
        .limit(MENU_PICTURES, { referencedTable: 'pictured' });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const event = one(row.events as { id: string; name: string; starts_at: string }[] | null);
        type Drink = { item: PictureItem | PictureItem[] | null };
        const drinks = (row.pictured ?? []) as unknown as Drink[];
        return {
          ...toSummaryBase(row as MenuRow),
          itemIds: (row.menu_drinks ?? []).map((d) => d.item_id).filter((id): id is string => !!id),
          pictures: drinks.flatMap((d) => {
            const item = one(d.item);
            if (!item) return [];
            const hero = heroPicture(Array.isArray(item.item_images) ? item.item_images : item.item_images ? [item.item_images] : []);
            return [{ id: item.id, name: item.name, imageUrl: hero?.url ?? null, isSketch: hero?.isSketch ?? false }];
          }).slice(0, MENU_PICTURES),
          event: event ? { id: event.id, name: event.name, startsAt: event.starts_at } : null,
        };
      });
    },
  });
}

export interface MenuItemRow {
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

export function toMenuDrink(item: MenuItemRow): MenuDrink | null {
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

/** A drink another bar published, as a menu shows it: its menu card, no price. */
export function publishedMenuDrink(p: PublishedDrink): MenuDrink | null {
  const kind = KINDS.find((k) => k === p.itemType);
  if (!kind) return null;
  return { id: p.id, name: p.name, kind, line: p.description ?? '', price: null, imageUrl: p.imageUrl, isSketch: p.imageIsGenerated, glass: null };
}

/** The columns a menu needs from a drink (items), for toMenuDrink. */
export const MENU_DRINK_COLUMNS = `id, name, item_type, description, brand_maker, origin, price, glass:glassware_id(icon_key, name),
  item_images(angle, sort_order, is_generated, images(url)),
  recipes:app_recipe_presentation!recipe_item_id(sort_order, created_at, display_ingredient(name))`;
const MENU_DRINK_ITEM = `item:items!item_id(${MENU_DRINK_COLUMNS})`;

/**
 * One menu with its sections in order and each section's drinks in order.
 * `fresh`: always fetch on mount, whatever is cached (the editor starts from this).
 */
export function useMenu(menuId: string | null | undefined, { fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: menuKeys.detail(menuId ?? ''),
    enabled: !!menuId,
    staleTime: 30_000,
    refetchOnMount: fresh ? 'always' : true,
    queryFn: async (): Promise<MenuDetail | null> => {
      const [menuRes, sectionsRes] = await Promise.all([
        supabase.from('menus').select(MENU_COLUMNS).eq('id', menuId!).maybeSingle(),
        supabase
          .from('menu_sections')
          .select(`id, name, sort_order, min_items, max_items, allowed_types, menu_drinks(sort_order, item_id, ${MENU_DRINK_ITEM})`)
          .eq('menu_id', menuId!)
          .order('sort_order'),
      ]);
      if (menuRes.error) throw menuRes.error;
      if (sectionsRes.error) throw sectionsRes.error;
      if (!menuRes.data) return null;
      type Row = { sort_order: number | null; item_id: string | null; item: MenuItemRow | MenuItemRow[] | null };
      const rows = (sectionsRes.data ?? []).flatMap((s) => (s.menu_drinks ?? []) as Row[]);
      // A home menu can hold drinks other bars published: the public read them
      // through published_items, not items.
      const published = await fetchPublished(rows.filter((r) => !one(r.item) && r.item_id).map((r) => r.item_id!));
      const drinkFor = (r: Row): MenuDrink | null => {
        const item = one(r.item);
        if (item) return toMenuDrink(item);
        const p = published.find((x) => x.id === r.item_id);
        return p ? publishedMenuDrink(p) : null;
      };
      return {
        ...toSummaryBase(menuRes.data as MenuRow),
        sections: (sectionsRes.data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          minItems: s.min_items ?? 0,
          maxItems: s.max_items ?? null,
          allowedTypes: normalizeAllowedTypes(s.allowed_types),
          drinks: [...((s.menu_drinks ?? []) as Row[])]
            .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
            .map(drinkFor)
            .filter((d): d is MenuDrink => !!d),
        })),
      };
    },
  });
}
