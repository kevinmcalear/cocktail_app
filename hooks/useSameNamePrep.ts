import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { useDebounced } from '@/hooks/useDiscover';
import { nameKey, nameLike, sameName } from '@/lib/sameName';
import { supabase } from '@/lib/supabase';

/** The ingredient already here by a name (Add-house, Name taken). Plain JSON. */
export interface SameNamePrep {
  id: string;
  name: string;
  /** Here: the venue's own, or yours at home. Otherwise one in the shared list (a name a venue may still use for its own version). */
  here: boolean;
  /** How many drinks use it, when it's here. */
  drinks: number | null;
  /** When it was made (ISO), when it's here. */
  made: string | null;
}

// ponytail: a venue's (or your) ingredients whose letters come in the name's order, enough for any one bar; a page of them if a bar ever has more.
const CANDIDATES = 500;

/**
 * Something you make, named like one already here (board Add-house, Name
 * taken): the venue's own ingredient at a bar; at home one you made, or one
 * in the shared list, which a home ingredient can't share a name with (the
 * database's one-of-each guard). A venue may make its own version of a
 * shared one, so at a bar only its own count. Asked once typing pauses;
 * `checking` is true while the answer for the name as typed is still to come.
 */
export function useSameNamePrep({ barId, name }: { barId: string | null; name: string }) {
  const userId = useUserId();
  const settled = useDebounced(name, 300);
  const key = nameKey(settled);
  const query = useQuery({
    queryKey: ['same-name-prep', barId, key, userId],
    enabled: !!key && !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<SameNamePrep | null> => {
      const pattern = nameLike(settled)!;
      const own = supabase.from('items').select('id, name, created_at').eq('item_type', 'ingredient').ilike('name', pattern);
      const { data, error } = await (barId ? own.eq('bar_id', barId) : own.is('bar_id', null).eq('created_by', userId!)).limit(CANDIDATES);
      if (error) throw error;
      const mine = (data ?? []).find((r) => sameName(r.name, settled));
      if (mine) {
        const { data: used } = await supabase.rpc('ingredient_used_in', { p_ingredient_id: mine.id, p_limit: 200 });
        return { id: mine.id, name: mine.name, here: true, drinks: used?.length ?? null, made: mine.created_at };
      }
      if (barId) return null;
      // At home, the shared list's one by this very name (the guard compares names the same way, near enough).
      const { data: shared, error: sharedError } = await supabase.from('items').select('id, name').eq('item_type', 'ingredient').is('bar_id', null).ilike('name', settled.trim().replace(/[%_\\]/g, '\\$&')).limit(5);
      if (sharedError) throw sharedError;
      const found = (shared ?? []).find((r) => sameName(r.name, settled));
      return found ? { id: found.id, name: found.name, here: false, drinks: null, made: null } : null;
    },
  });
  const typed = nameKey(name);
  const checking = !!typed && !!userId && (typed !== key || query.isLoading);
  return { data: query.data && sameName(query.data.name, name) ? query.data : null, checking };
}

/** The Name taken card's words (Add-house): who has it, and how much it's used. */
export function takenPrepWords(taken: SameNamePrep, barName: string | null): { title: string; body: string } {
  const where = !taken.here ? 'The shared list has one' : barName ? `${barName} has one` : 'You have one';
  const used = taken.drinks ? `, in ${taken.drinks} ${taken.drinks === 1 ? 'drink' : 'drinks'}` : '';
  const open = taken.here ? 'Open it to change it' : 'Open it to see it';
  return { title: `${taken.name} is already here`, body: `${where}${used}. ${open}, or name this one so they’re told apart.` };
}

/**
 * A part's name taken (Add-parts, 6): "You have a Fresh ginger juice /
 * Caretaker's made it in October, in 2 drinks. Use that one here, or make a
 * new one." One in the shared list (at home) is used the same way.
 */
export function takenPartWords(taken: SameNamePrep, barName: string | null): { title: string; body: string; use: string } {
  if (!taken.here) return { title: `${taken.name} is in the shared list`, body: 'Use that one here, or make a new one.', use: 'Use that one' };
  const month = taken.made ? ` in ${new Date(taken.made).toLocaleString('en', { month: 'long' })}` : '';
  const used = taken.drinks ? `, in ${taken.drinks} ${taken.drinks === 1 ? 'drink' : 'drinks'}` : '';
  return { title: `You have a ${taken.name}`, body: `${barName ?? 'You'} made it${month}${used}. Use that one here, or make a new one.`, use: 'Use yours' };
}
