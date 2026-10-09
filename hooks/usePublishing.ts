import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { changedProfiles } from '@/hooks/useProfiles';
import type { PageVisibility } from '@/lib/pageVisibility';
import { effectivePublish, type PublishMode, type PublishSource } from '@/lib/publishing';
import { supabase } from '@/lib/supabase';

interface MenuLink {
  menus: { id: string; bar_id: string | null; publish_mode: PublishMode | null } | null;
}

export interface ItemPublishing {
  own: PublishMode | null;
  createdBy: string | null;
  barDefault: PublishMode | null;
  menuModes: (PublishMode | null)[];
  mode: PublishMode;
  source: PublishSource;
  /** What the drink would get if its own setting went back to inherit. */
  inherited: { mode: PublishMode; source: PublishSource };
}

/** A drink's or ingredient's publish mode: its own, its menus', its bar's, and the result. */
export function useItemPublishing(itemId: string, barId: string | null) {
  return useQuery({
    queryKey: ['item-publishing', itemId],
    // Settings: always check on open, since menus, the bar and its page change elsewhere.
    staleTime: 0,
    queryFn: async (): Promise<ItemPublishing> => {
      const [item, links, bar] = await Promise.all([
        supabase.from('items').select('publish_mode, created_by').eq('id', itemId).single(),
        supabase.from('menu_drinks').select('menus!inner(id, bar_id, publish_mode)').eq('item_id', itemId),
        barId ? supabase.from('bars').select('default_publish_mode').eq('id', barId).single() : Promise.resolve({ data: null, error: null }),
      ]);
      if (item.error) throw item.error;
      if (links.error) throw links.error;
      if (bar.error) throw bar.error;
      const { publish_mode: own, created_by: createdBy } = item.data as { publish_mode: PublishMode | null; created_by: string | null };
      // Only the drink's own bar's menus publish it.
      const menuModes = ((links.data ?? []) as unknown as MenuLink[])
        .map((l) => l.menus)
        .filter((m): m is NonNullable<MenuLink['menus']> => !!m && m.bar_id === barId)
        .map((m) => m.publish_mode);
      const barDefault = (bar.data as { default_publish_mode: PublishMode } | null)?.default_publish_mode ?? null;
      const { mode, source } = effectivePublish({ own, menuModes, barDefault });
      return { own, createdBy, barDefault, menuModes, mode, source, inherited: effectivePublish({ own: null, menuModes, barDefault }) };
    },
  });
}

export interface BarPublishing {
  barDefault: PublishMode;
  /** Who outside the venue sees its page: Locked, names and descriptions, or Open. */
  pageVisibility: PageVisibility;
  /** The venue's public page, which has to exist before anything goes public. */
  profile: PublishingProfile | null;
  menus: { id: string; name: string; publish_mode: PublishMode | null }[];
  /** Drinks (not ingredients) by what the public sees. */
  counts: Record<PublishMode, number>;
  /** The venue's drinks by name, with what the public sees of each. */
  drinks: { id: string; name: string; mode: PublishMode }[];
}

/** The venue's public page; makes and serves are a maker page's own. */
export interface PublishingProfile {
  id: string;
  handle: string | null;
  instagram: string | null;
  kind: string;
  makes: string[] | null;
  serves: string[] | null;
}

interface BarItem {
  id: string;
  name: string;
  item_type: string;
  publish_mode: PublishMode | null;
}

/** A venue's default, whether it can publish, its menus' settings, and how many drinks are public. */
export function useBarPublishing(barId: string) {
  return useQuery({
    queryKey: ['bar-publishing', barId],
    staleTime: 0,
    queryFn: async (): Promise<BarPublishing> => {
      const [bar, profile, menus, items] = await Promise.all([
        supabase.from('bars').select('default_publish_mode, page_visibility').eq('id', barId).single(),
        supabase.from('profiles').select('id, handle, instagram, kind, makes, serves').eq('bar_id', barId).eq('is_public', true).is('moderated_at', null).maybeSingle(),
        supabase.from('menus').select('id, name, publish_mode, menu_drinks(item_id)').eq('bar_id', barId).order('name'),
        supabase.from('items').select('id, name, item_type, publish_mode').eq('bar_id', barId).in('item_type', ['cocktail', 'beer', 'wine']),
      ]);
      for (const r of [bar, profile, menus, items]) if (r.error) throw r.error;
      const { default_publish_mode: barDefault, page_visibility: pageVisibility } = bar.data as { default_publish_mode: PublishMode; page_visibility: PageVisibility };
      const menuRows = (menus.data ?? []) as { id: string; name: string; publish_mode: PublishMode | null; menu_drinks: { item_id: string }[] }[];
      const menusOf = new Map<string, (PublishMode | null)[]>();
      for (const m of menuRows) for (const d of m.menu_drinks) menusOf.set(d.item_id, [...(menusOf.get(d.item_id) ?? []), m.publish_mode]);
      const counts: Record<PublishMode, number> = { private: 0, description: 0, spec: 0 };
      const drinks = ((items.data ?? []) as BarItem[])
        .map((i) => ({ id: i.id, name: i.name, mode: effectivePublish({ own: i.publish_mode, menuModes: menusOf.get(i.id) ?? [], barDefault }).mode }))
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const d of drinks) counts[d.mode] += 1;
      return {
        barDefault,
        pageVisibility,
        profile: (profile.data as PublishingProfile | null) ?? null,
        menus: menuRows.map(({ id, name, publish_mode }) => ({ id, name, publish_mode })),
        counts,
        drinks,
      };
    },
  });
}

/**
 * Change one level. The database checks the publish permission and asks for a
 * public profile before anything goes public, and its message says so.
 */
export function useSetPublish(barId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      change: { level: 'bar'; mode: PublishMode } | { level: 'page'; visibility: PageVisibility } | { level: 'menu' | 'item'; id: string; mode: PublishMode | null },
    ) => {
      const { error } =
        change.level === 'page'
          ? await supabase.from('bars').update({ page_visibility: change.visibility }).eq('id', barId!)
          : change.level === 'bar'
          ? await supabase.from('bars').update({ default_publish_mode: change.mode }).eq('id', barId!)
          : change.level === 'menu'
            ? await supabase.from('menus').update({ publish_mode: change.mode }).eq('id', change.id)
            : await supabase.from('items').update({ publish_mode: change.mode }).eq('id', change.id);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['item-publishing'] });
      client.invalidateQueries({ queryKey: ['bar-publishing'] });
      // The bar's page and its drinks' locks follow the page setting.
      if (barId) client.invalidateQueries(changedProfiles({ barId }));
      client.invalidateQueries({ queryKey: ['spec-lock'] });
    },
  });
}
