import { useQuery } from '@tanstack/react-query';

import { MOST_LEVELS, namesList } from '@/lib/houseMadeParts';
import { shelfLifeLabel } from '@/lib/scale';
import { supabase } from '@/lib/supabase';

/** One of a house-made's parts (board Add-parts, 4), plain JSON. */
export interface ItsPart {
  id: string;
  name: string;
  /** 2 for a part of it, 3 for a part of a part: the list indents by it. */
  level: number;
  /** "Its own recipe · uses Fresh ginger juice", "Its own recipe · keeps 3 days". */
  detail: string;
}

type Line = { recipe_item_id: string | null; display_ingredient: { id: string; name: string | null; ingredient_role: string | null } | null };

/**
 * A house-made's parts: the lines that are house-mades themselves, and
 * theirs, three levels at most (board Add-parts, "Saves together: its
 * parts"). Each opens its own page.
 */
export function useItsParts(itemId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['its-parts', itemId],
    enabled: !!itemId && enabled,
    queryFn: async (): Promise<ItsPart[]> => {
      // The presentation view: whoever can read the recipe sees its lines (the raw table is for its editors).
      const linesOf = async (ids: string[]) => {
        const { data, error } = await supabase.from('app_recipe_presentation').select('recipe_item_id, display_ingredient(id, name, ingredient_role)').in('recipe_item_id', ids).order('sort_order');
        if (error) throw error;
        return ((data ?? []) as Line[]).filter((l) => l.display_ingredient?.ingredient_role === 'prep');
      };
      const top = await linesOf([itemId!]);
      if (!top.length) return [];
      const ids = top.map((l) => l.display_ingredient!.id);
      const below = MOST_LEVELS > 2 ? await linesOf(ids) : [];
      const all = [...ids, ...below.map((l) => l.display_ingredient!.id)];
      const { data: cards, error } = await supabase.from('item_prep').select('item_id, shelf_life_hours').in('item_id', all);
      if (error) throw error;
      const keeps = new Map((cards ?? []).map((c) => [c.item_id, shelfLifeLabel(c.shelf_life_hours)]));
      const part = (id: string, name: string, level: number, uses: string[]): ItsPart => {
        const kept = keeps.get(id);
        return { id, name, level, detail: ['Its own recipe', uses.length ? `uses ${namesList(uses)}` : kept ? `keeps ${kept}` : null].filter(Boolean).join(' · ') };
      };
      return top.flatMap(({ display_ingredient: p }) => {
        const inner = below.filter((l) => l.recipe_item_id === p!.id).map((l) => l.display_ingredient!);
        return [part(p!.id, p!.name ?? '', 2, inner.map((i) => i.name ?? '')), ...inner.map((i) => part(i.id, i.name ?? '', 3, []))];
      });
    },
  });
}
