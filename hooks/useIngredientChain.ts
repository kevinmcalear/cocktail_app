import { useQuery, type QueryClient } from '@tanstack/react-query';

import { shownIngredientPicture, type IngredientPicture, type ShownIngredientPicture } from '@/lib/ingredientPicture';
import { supabase } from '@/lib/supabase';

// What an ingredient is, for its drawing (lib/sketch/ingredientArt.ts): its
// name, the names of the kinds above it ("White Rum", "Rum", "Spirit") and its
// role, and the picture its editor chose (lib/ingredientPicture.ts). Every
// picture asking in the same tick shares one walk up the chain, and kinds
// already seen this session aren't read again.

export interface IngredientChain {
  names: string[];
  role: string | null;
  /** The ingredient's own picture choice: its kinds' choices don't pass down. */
  picture: ShownIngredientPicture;
}

interface Row {
  id: string;
  name: string | null;
  generic_id: string | null;
  ingredient_role: string | null;
  picture?: IngredientPicture | null;
  picture_url?: string | null;
}

const CHUNK = 100;
/** The kinds chains run through, kept for the session: a few hundred at most. */
const seen = new Map<string, Row>();
let pending: { ids: Set<string>; result: Promise<void> } | null = null;

async function read(ids: string[]) {
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('app_item_presentation')
      .select('id, name, generic_id, ingredient_role, picture, picture_url')
      .in('id', ids.slice(i, i + CHUNK));
    // Decorative: an unreadable row draws from its name alone.
    if (error) continue;
    for (const row of (data ?? []) as Row[]) seen.set(row.id, row);
  }
}

/**
 * Reads the ingredients, then each layer of kinds above them, until every
 * chain ends. The ingredients themselves are read every time (their picture
 * can change on another device); kinds already seen aren't.
 */
async function walk(ids: string[]) {
  let next = ids;
  for (let depth = 0; next.length && depth < 8; depth++) {
    await read(next);
    next = [...new Set(next.map((id) => seen.get(id)?.generic_id).filter((id): id is string => !!id && !seen.has(id)))];
  }
}

function chainOf(id: string): IngredientChain {
  const names: string[] = [];
  const row = seen.get(id);
  for (let cur = row, depth = 0; cur && depth < 8; cur = cur.generic_id ? seen.get(cur.generic_id) : undefined, depth++) {
    if (cur.name) names.push(cur.name);
  }
  return { names, role: row?.ingredient_role ?? null, picture: shownIngredientPicture(row?.picture, row?.picture_url) };
}

function load(id: string): Promise<IngredientChain> {
  if (!pending) {
    const ids = new Set<string>();
    const result = new Promise<void>((resolve) => {
      setTimeout(() => {
        pending = null;
        walk([...ids]).then(resolve, () => resolve());
      }, 16);
    });
    pending = { ids, result };
  }
  pending.ids.add(id);
  return pending.result.then(() => chainOf(id));
}

/** After its picture changes here: read it again now, not when its query goes stale. */
export function forgetIngredientChain(queryClient: QueryClient, id: string) {
  seen.delete(id);
  return queryClient.invalidateQueries({ queryKey: ['ingredient-chain', id] });
}

/** An ingredient's name and kinds, nearest first. Pass null to skip. */
export function useIngredientChain(id: string | null | undefined) {
  return useQuery({
    queryKey: ['ingredient-chain', id],
    enabled: !!id,
    queryFn: () => load(id!),
  });
}
