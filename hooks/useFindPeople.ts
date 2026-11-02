import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { useBars } from '@/hooks/useBars';
import { PERSON_COLUMNS, toPerson, type FollowPerson } from '@/hooks/useFollows';
import { personSearchFilter } from '@/lib/profiles';
import { roleLabel } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

/**
 * Find people's reads, kept apart from hooks/useFollows so Tonight and You
 * (which only need who you follow) don't load the search and team reads.
 */

/** People's public pages by name or handle (Find people). Not you. */
export function useFindPeople(term: string) {
  const userId = useUserId();
  const q = term.trim().replace(/^@/, '').replace(/\s+/g, ' ');
  return useQuery({
    queryKey: ['find-people', q.toLowerCase(), userId],
    enabled: !!userId && q.length >= 2,
    queryFn: async ({ signal }): Promise<FollowPerson[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(PERSON_COLUMNS)
        .eq('kind', 'person')
        .or(personSearchFilter(q))
        .order('display_name')
        .limit(20)
        .abortSignal(signal);
      if (error) throw error;
      return (data ?? []).filter((r) => r.user_id !== userId).map(toPerson);
    },
  });
}

/** Someone on a team with you (Find people's From your bars). */
export interface Barmate {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** "Head bartender, Caretaker’s". */
  line: string;
}

/** The people on your bars' teams, not you, each once (their first bar). */
export function useBarmates() {
  const userId = useUserId();
  const bars = useBars().data ?? [];
  const ids = bars.map((b) => b.bar_id).sort();
  return useQuery({
    queryKey: ['barmates', userId, ids],
    enabled: !!userId && ids.length > 0,
    queryFn: async (): Promise<Barmate[]> => {
      const lists = await Promise.all(
        bars.map(async (b) => {
          const { data, error } = await supabase.rpc('get_bar_members', { p_bar_id: b.bar_id });
          if (error) throw error;
          return (data ?? []).map((m) => ({ m, bar: b.bars?.name ?? '' }));
        }),
      );
      const seen = new Set<string>([userId!]);
      return lists.flat().flatMap(({ m, bar }) => {
        if (seen.has(m.user_id)) return [];
        seen.add(m.user_id);
        const role = m.venue_role_name || roleLabel(m.role_level);
        return [{ userId: m.user_id, name: m.display_name || 'Someone on your team', avatarUrl: m.avatar_url ?? null, line: bar ? `${role}, ${bar}` : role }];
      });
    },
  });
}
