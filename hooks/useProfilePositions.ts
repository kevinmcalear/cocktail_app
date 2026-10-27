// Jobs and people: positions, the public people search, find-yourself counts and worked menus.
// Split out of hooks/useProfiles.ts, which still re-exports it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import type { Profile } from '@/hooks/useProfiles';
import { withNear, type MaybeNear } from '@/hooks/useSearchNear';
import { viewerScoped } from '@/lib/authCache';
import { countWaiting, workedBars, type CreditRow, type JobRow, type Waiting } from '@/lib/findYourself';
import { personSearchFilter } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

export interface PositionProfile {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  /** A bar page's venue on Cocktail: set once the bar is claimed. */
  bar_id: string | null;
}

export interface Position {
  id: string;
  title: string;
  is_current: boolean;
  /** The person's switch for a past job. Others read a past job only while it's on. */
  is_shown: boolean;
  /** The person's off switch, on any job (current too). Wins over is_shown. */
  is_hidden: boolean;
  /** "2023 to now": months are optional, a current job has no end. */
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  /** Both sides have said yes. Until then only they (and moderators) read it. */
  person_accepted: boolean;
  bar_accepted: boolean;
  person: PositionProfile;
  bar: PositionProfile;
}

const POSITION_PROFILE = 'id, handle, display_name, avatar_url, bar_id';

export interface PublicPerson {
  id: string;
  handle: string;
  display_name: string;
  city: string | null;
  is_claimed: boolean;
  /** Where they work now, when a job says so: "Bar Bianca". */
  current_bar: string | null;
  /** Their current job, when they show it: "Head bartender, Little Rye". */
  job: string | null;
  /** Where they work and have worked, no titles: "Pale Moth · Little Rye". */
  worked: string | null;
}

type PersonRow = Omit<PublicPerson, 'job' | 'current_bar' | 'worked'> & {
  jobs: { title: string | null; is_current: boolean; is_shown: boolean; is_hidden: boolean; person_accepted: boolean; bar_accepted: boolean; bar: { display_name: string } | null }[] | null;
};

/** Public people by name or @handle, so someone can find a profile we already have. */
export function usePublicPeople(search: string, { near = false }: { near?: boolean } = {}) {
  const typed = search.trim().replace(/^@/, '');
  // The close-names lookup gets plain words; the name and handle match takes what was typed.
  const term = typed.replace(/[%_\\]/g, '').trim();
  // A picker asks for close names too ("dayle degrof": Dale DeGroff), marked `near`; they need an account.
  const userId = useUserId();
  const close = near && !!userId;
  return useQuery({
    queryKey: ['public-people', typed.toLowerCase(), close],
    enabled: typed.length >= 2,
    queryFn: async ({ signal }): Promise<MaybeNear<PublicPerson>[]> => {
      const read = async (ids?: string[]): Promise<PublicPerson[]> => {
        const q = supabase
          .from('profiles')
          .select('id, handle, display_name, city, is_claimed, jobs:profile_positions!person_profile_id(title, is_current, is_shown, is_hidden, person_accepted, bar_accepted, bar:profiles!bar_profile_id(display_name))')
          .eq('kind', 'person')
          .eq('is_public', true);
        const { data, error } = await (ids ? q.in('id', ids) : q.or(personSearchFilter(typed)).order('display_name').limit(8)).abortSignal(signal);
        if (error) throw error;
        return ((data ?? []) as PersonRow[]).map(({ jobs, ...p }) => {
          // Jobs both sides confirmed, as the profile shows them.
          const confirmed = (jobs ?? []).filter((j) => j.person_accepted && j.bar_accepted && j.bar);
          const now = confirmed.find((j) => j.is_current);
          return {
            ...p,
            current_bar: now?.bar?.display_name ?? null,
            job: now ? [now.title, now.bar!.display_name].filter(Boolean).join(', ') : null,
            worked: workedBars(confirmed.filter((j) => !j.is_hidden && (j.is_current || j.is_shown))),
          };
        });
      };
      return close ? withNear(term, 'person', read(), read, signal) : read();
    },
  });
}

/** Bars counted per search: the first ones each shows (a count each). */
export const WAITING_BARS = 10;
const WAITING_ROWS = 1000;

/**
 * What waits on bar and person pages a search found (find-yourself): drinks
 * credited to each (made there, made by them, or co-made), each bar's
 * people, and whether a bar's page is claimed yet. Reads what the profile
 * pages read: items signed in (RLS keeps what you can see), published cards
 * signed out.
 * ponytail: a bar's count includes classics it pours as copies (its page's
 * "originals" leaves them out), and a person's leaves out name-only credits
 * at Names and Private bars (get_profile_name_credits is one call each).
 * A count RPC would match the pages exactly.
 */
export function useWaiting(barIds: readonly string[], personIds: readonly string[]) {
  const userId = useUserId();
  const viewer = viewerScoped(userId);
  const ids = [...barIds, ...personIds];
  return useQuery({
    queryKey: ['waiting', barIds, personIds, viewer.key],
    meta: viewer.meta,
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, Waiting>> => {
      // Signed in, the items you can see; signed out, published cards (not the reference rows).
      const drinksOf = (columns: string, head = false) =>
        userId ? supabase.from('items').select(columns, { count: head ? 'exact' : undefined, head }) : supabase.from('published_items').select(columns, { count: head ? 'exact' : undefined, head }).eq('is_reference', false);
      const none = Promise.resolve({ data: [], error: null });
      // A bar can have hundreds: the server counts each, so a big one never crowds the rest out.
      const counted = barIds.slice(0, WAITING_BARS);
      const [barCounts, mine, co, jobs, pages] = await Promise.all([
        Promise.all(counted.map((id) => drinksOf('id', true).eq('origin_bar_profile_id', id))),
        personIds.length ? drinksOf('id, creator_profile_id').in('creator_profile_id', [...personIds]).limit(WAITING_ROWS) : none,
        // Made with others, waiting for their yes or accepted (20261121200000), on drinks the reader could open.
        personIds.length ? supabase.rpc('waiting_co_credits', { p_profile_ids: [...personIds] }).limit(WAITING_ROWS) : none,
        barIds.length ? supabase.from('profile_positions').select('bar_profile_id, person_profile_id, is_current, is_shown, is_hidden').in('bar_profile_id', [...barIds]).limit(WAITING_ROWS) : none,
        // Discover's bar rows don't say whether the page is claimed (people's rows do).
        barIds.length ? supabase.from('profiles').select('id, is_claimed').in('id', [...barIds]) : none,
      ]);
      for (const r of [...barCounts, mine, co, jobs, pages]) if (r.error) throw r.error;
      const claimed = new Set(((pages.data ?? []) as { id: string; is_claimed: boolean }[]).filter((r) => r.is_claimed).map((r) => r.id));
      const barDrinks = Object.fromEntries(counted.map((id, i) => [id, barCounts[i].count ?? 0]));
      // ponytail: the table and select are chosen at run time, so supabase-js can't type the row; split into literal queries to drop this cast.
      const waiting = countWaiting(ids, (mine.data ?? []) as unknown as CreditRow[], (co.data ?? []) as { item_id: string; profile_id: string }[], (jobs.data ?? []) as JobRow[], claimed, barDrinks);
      // Bars past the counted ones keep their claimed tag but say no numbers, rather than a wrong one.
      for (const id of barIds.slice(WAITING_BARS)) waiting[id] = { ...waiting[id], drinks: 0, people: 0 };
      return waiting;
    },
  });
}

export interface WorkedMenu {
  id: string;
  name: string;
  year: number | null;
  bar: { id: string; handle: string; display_name: string; is_closed: boolean };
  /** Drinks they made for it (b62). A drink the reader can't see comes back as null. */
  drinks: { item: { id: string; name: string } | null }[] | null;
}

/** Menus a person says they worked on, including at a bar that has closed. */
export function useWorkedMenus(profileId: string | null | undefined) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['profile-worked-menus', profileId, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<WorkedMenu[]> => {
      const { data, error } = await supabase
        .from('profile_worked_menus')
        .select('id, name, year, bar:profiles!bar_profile_id(id, handle, display_name, is_closed), drinks:profile_worked_menu_drinks(item:items(id, name))')
        .eq('person_profile_id', profileId!)
        .limit(50);
      if (error) throw error;
      return (data ?? []).sort(
        (a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name)
      );
    },
  });
}

/** Where a person works, or who works at a bar: current first, then by name. */
export function useProfilePositions(profile: Pick<Profile, 'id' | 'kind'> | null | undefined) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['profile-positions', profile?.id, viewer.key],
    meta: viewer.meta,
    enabled: !!profile,
    queryFn: async (): Promise<Position[]> => {
      const { data, error } = await supabase
        .from('profile_positions')
        .select(`id, title, is_current, is_shown, is_hidden, start_year, start_month, end_year, end_month, person_accepted, bar_accepted, person:profiles!person_profile_id(${POSITION_PROFILE}), bar:profiles!bar_profile_id(${POSITION_PROFILE})`)
        .eq(profile!.kind === 'person' ? 'person_profile_id' : 'bar_profile_id', profile!.id)
        .limit(50);
      if (error) throw error;
      // Everyone else's rows need both profiles visible (RLS). The two sides of
      // a job that isn't confirmed yet can read it even when the other
      // profile is private, without that profile: leave those out here.
      const other = (p: Position) => (profile!.kind === 'person' ? p.bar : p.person).display_name;
      return (data ?? []).filter((p) => p.person && p.bar).sort((a, b) => Number(b.is_current) - Number(a.is_current) || other(a).localeCompare(other(b)));
    },
  });
}

/** The person's Shown switch on one job, current or past. Only they can turn it on (a trigger checks). */
export function useShowPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, shown }: { id: string; shown: boolean }) => {
      const { data, error } = await supabase.from('profile_positions').update({ is_shown: shown, is_hidden: !shown }).eq('id', id).select('id');
      if (error || !data?.length) throw new Error("Couldn't save that. Check your connection and try again.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-positions'] }),
    // Shown inline by PastJobs, not as the global toast.
    onError: () => {},
  });
}

export interface PositionEdit {
  id: string;
  title?: string;
  start_year?: number | null;
  start_month?: number | null;
  end_year?: number | null;
  end_month?: number | null;
}

/** Changes a job's title or dates. A new title asks the bar again (set_position_acceptance); dates don't. */
export function useEditPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...change }: PositionEdit) => {
      const { data, error } = await supabase.from('profile_positions').update(change).eq('id', id).select('id');
      if (error?.code === '23514') throw new Error('Check the years: a job can’t end before it starts, and one you have now has no end.');
      if (error || !data?.length) throw new Error("Couldn't save that. Check your connection and try again.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-positions'] }),
    onError: () => {},
  });
}
