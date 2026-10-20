import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { LINEAGE_COLUMNS, PROFILE_COLUMNS } from '@/hooks/useLineage';
import { MENU_DRINK_COLUMNS, toMenuDrink, type MenuItemRow } from '@/hooks/useMenus';
import { viewerScoped } from '@/lib/authCache';
import { sortAwards, type Award } from '@/lib/awards';
import type { ClaimEvidence, ClaimMethod } from '@/lib/claimVerification';
import { countWaiting, workedBars, type CreditRow, type JobRow, type Waiting } from '@/lib/findYourself';
import { runDates, sortEditions, type MenuDates, type MenuEdition, type MenuEditionDrink, type MenuRunRow } from '@/lib/menuEditions';
import type { ItemImageLink } from '@/lib/itemImages';
import type { CreditProfile, CreditStatus, LineageDrink, ProfileKind } from '@/lib/lineage';
import type { PageVisibility } from '@/lib/pageVisibility';
import { groupMenuCredits, parseProfileRef, profileQueryShows, type MenuCredit, type MenuDrinkRow, type ProfileChange, type ShareMode, type ShareSection } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import type { MenuDrink } from '@/types/menus';

export interface Profile {
  id: string;
  kind: ProfileKind;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  instagram: string | null;
  /** Facebook, TikTok, X, YouTube and Threads pages, as links. */
  social_links: string[] | null;
  locality: string | null;
  city: string | null;
  country_code: string | null;
  bar_id: string | null;
  is_public: boolean;
  /** False for a historic creator or a bar not on the app. (The owner's user_id is hidden from signed-out visitors.) */
  is_claimed: boolean;
  /** A bar that has shut for good; closed_year when it's known. */
  is_closed: boolean;
  closed_year: number | null;
  /** How much of the drinks they've had a person shows, with their scores. */
  had_mode: ShareMode;
  /** The bars they've had drinks at, with their average at each. */
  bars_mode: ShareMode;
  /** The drinks they've made. A bar's always show. */
  made_mode: ShareMode;
  /** A bar's: who outside it sees its page. Null for a person. */
  page_visibility: PageVisibility | null;
  /** A person's own line under their name ("Home bartender"). */
  tagline: string | null;
  /** Or one of their jobs, shown while the bar has confirmed it (profileLine). */
  headline_position_id: string | null;
  /** A maker's: what it makes (bottles, ice, glassware...). Empty for bars and people. */
  makes: string[];
  /** A maker's or supplier's: the cities it delivers to. */
  serves: string[];
  /** A supplier's: what it supplies (bottles, ice, produce...). Empty for everyone else. */
  supplies: string[];
  /** A maker's group (Tanqueray is part of Diageo), set by moderators. */
  part_of_profile_id: string | null;
}

const COLUMNS = 'id, kind, handle, display_name, bio, avatar_url, website, instagram, social_links, locality, city, country_code, bar_id, is_public, is_claimed, is_closed, closed_year, had_mode, bars_mode, made_mode, page_visibility, tagline, headline_position_id, makes, serves, supplies, part_of_profile_id';

export const isUnclaimed = (p: Pick<Profile, 'is_claimed'>) => !p.is_claimed;

/** Filters for invalidateQueries: the cached profile pages a write changed, not every one opened. */
export const changedProfiles = (change: ProfileChange) => ({
  queryKey: ['profile'],
  predicate: (query: Query) => profileQueryShows(query.queryKey, query.state.data, change),
});

/** A profile by id or handle (a /p/<ref> link). Public ones for anyone; private ones for their owner. */
export function useProfile(ref: string | string[] | null | undefined) {
  const parsed = parseProfileRef(ref);
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['profile', parsed, viewer.key],
    meta: viewer.meta,
    enabled: !!parsed,
    queryFn: async (): Promise<Profile | null> => {
      const query = supabase.from('profiles').select(COLUMNS);
      const { data, error } = await ('id' in parsed! ? query.eq('id', parsed.id) : query.eq('handle', parsed!.handle)).maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });
}

export interface Original extends LineageDrink {
  item_type: string;
  description: string | null;
  glass: { icon_key: string | null } | null;
  item_images: ItemImageLink[] | null;
  /** How many drinks name it as their classic (riffs and bar versions you can see): "riffed 12×". */
  versions?: { count: number }[] | null;
}

const ORIGINAL_COLUMNS = `${LINEAGE_COLUMNS}, item_type, description, glass:glassware_id(icon_key), item_images(angle, sort_order, is_generated, outdated_since, images(url)), versions:items!riff_of_id(count)`;

/** The `or` filters for drinks credited to a profile: its creator, its first bar, or one of several creators. */
async function creditedTo(profileId: string): Promise<string[]> {
  const co = await supabase.from('item_co_creators').select('item_id').eq('profile_id', profileId).limit(100);
  if (co.error) throw co.error;
  const coIds = (co.data ?? []).map((r) => r.item_id as string);
  return [`creator_profile_id.eq.${profileId}`, `origin_bar_profile_id.eq.${profileId}`, ...(coIds.length ? [`id.in.(${coIds.join(',')})`] : [])];
}

interface PublicOriginalRow {
  id: string;
  name: string;
  item_type: string;
  description: string | null;
  origin: string | null;
  origin_year: number | null;
  riff_of_id: string | null;
  credit_status: CreditStatus | null;
  creator_profile_id: string | null;
  origin_bar_profile_id: string | null;
  image_url: string | null;
  image_is_generated: boolean | null;
}

/**
 * Signed out: the same drinks' public cards (published_items), with who made
 * them. A Locked page's cards come back without description, maker or picture.
 */
async function publicOriginals(profileId: string): Promise<Original[]> {
  const { data, error } = await supabase
    .from('published_items')
    .select('id, name, item_type, description, origin, origin_year, riff_of_id, credit_status, creator_profile_id, origin_bar_profile_id, image_url, image_is_generated')
    .eq('is_reference', false)
    .or(`creator_profile_id.eq.${profileId},origin_bar_profile_id.eq.${profileId}`)
    .order('name')
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as PublicOriginalRow[];
  const makerIds = [...new Set(rows.flatMap((r) => [r.creator_profile_id, r.origin_bar_profile_id]).filter((x): x is string => !!x))];
  const makers = makerIds.length ? await supabase.from('profiles').select(PROFILE_COLUMNS).in('id', makerIds) : { data: [], error: null };
  if (makers.error) throw makers.error;
  const byId = new Map(((makers.data ?? []) as CreditProfile[]).map((p) => [p.id, p]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    item_type: r.item_type,
    description: r.description,
    origin: r.origin,
    origin_year: r.origin_year,
    riff_of_id: r.riff_of_id,
    credit_status: r.credit_status,
    creator: (r.creator_profile_id && byId.get(r.creator_profile_id)) || null,
    origin_bar: (r.origin_bar_profile_id && byId.get(r.origin_bar_profile_id)) || null,
    glass: null,
    item_images: r.image_url ? [{ angle: 'hero', is_generated: r.image_is_generated, images: { url: r.image_url } }] : [],
  }));
}

/**
 * Drinks credited to a profile: made by the person (alone or with others), or
 * first made at the bar. A Locked bar page's drinks are its team's alone in
 * items, so everyone else gets their public cards (names and credits) as well.
 */
export function useProfileOriginals(profileId: string | null | undefined, { locked = false }: { locked?: boolean } = {}) {
  const userId = useUserId();
  const viewer = viewerScoped(userId);
  return useQuery({
    queryKey: ['profile-originals', profileId, viewer.key, locked],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<Original[]> => {
      if (!userId) return publicOriginals(profileId!);
      const [{ data, error }, cards] = await Promise.all([
        supabase
          .from('items')
          .select(ORIGINAL_COLUMNS)
          .or((await creditedTo(profileId!)).join(','))
          .order('name')
          .limit(100),
        locked ? publicOriginals(profileId!) : Promise.resolve([]),
      ]);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Original[];
      const seen = new Set(rows.map((r) => r.id));
      const missing = cards.filter((c) => !seen.has(c.id));
      return missing.length ? [...rows, ...missing].sort((a, b) => a.name.localeCompare(b.name)) : rows;
    },
  });
}

/** Credited drinks by id, for a signed-in viewer (items RLS decides which come back). */
export async function originalsByIds(ids: string[]): Promise<Original[]> {
  const { data, error } = await supabase.from('items').select(ORIGINAL_COLUMNS).in('id', ids).order('name').limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as Original[];
}

/**
 * The drinks I've made: every drink I wrote up here (at a venue or on my
 * own), plus the ones credited to my profile when I have one. My own view;
 * other people see only what's credited (useProfileOriginals).
 */
export function useMyMadeDrinks(profileId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['my-made', userId, profileId ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<Original[]> => {
      const { data, error } = await supabase
        .from('items')
        .select(ORIGINAL_COLUMNS)
        .eq('item_type', 'cocktail')
        .or([`created_by.eq.${userId}`, ...(profileId ? await creditedTo(profileId) : [])].join(','))
        .order('name')
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Original[];
    },
  });
}

/** A profile's list places and titled awards, newest first. */
export function useProfileAwards(profileId: string | null | undefined) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['profile-awards', profileId, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<Award[]> => {
      const { data, error } = await supabase
        .from('profile_awards')
        .select('id, award, year, position, title, source_url, status, is_finalist, on_profile, added_by, bar:profiles!bar_profile_id(id, handle, display_name)')
        .eq('profile_id', profileId!);
      if (error) throw error;
      return sortAwards((data ?? []) as unknown as Award[]);
    },
  });
}

export interface NewAward {
  profileId: string;
  /** The awards body: "Tales of the Cocktail Spirited Awards". */
  award: string;
  title: string;
  year: number;
  isFinalist: boolean;
  barProfileId: string | null;
  sourceUrl: string;
}

/** Sends one of your own awards for checking. It comes in pending ("Not confirmed yet") until a moderator confirms it. */
export function useAddAward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: NewAward) => {
      const { error } = await supabase.from('profile_awards').insert({
        profile_id: a.profileId,
        award: a.award.trim(),
        title: a.title.trim(),
        year: a.year,
        is_finalist: a.isFinalist,
        bar_profile_id: a.barProfileId,
        source_url: a.sourceUrl.trim(),
      });
      if (error?.code === '23505') throw new Error('That award is already on your profile.');
      if (error?.code === '54000' || error?.message.startsWith('That ')) throw new Error(error.message);
      if (error) throw new Error('Couldn’t send that. Check the link starts with https:// and try again.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-awards'] }),
    // Shown inline by the sheet, not as the global toast.
    onError: () => {},
  });
}

/** Shows or hides one award on your own profile (its pick; profiles.awards_mode decides the rest). */
export function useSetAwardPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, shown }: { id: string; shown: boolean }) => {
      const { data, error } = await supabase.from('profile_awards').update({ on_profile: shown }).eq('id', id).select('id');
      if (error || !data?.length) throw new Error("Couldn't save that. Check your connection and try again.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-awards'] }),
    onError: () => {},
  });
}

/** Every cocktail menu a bar has put out, newest first. */
export function useMenuEditions(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-menu-editions', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<MenuEdition[]> => {
      const { data, error } = await supabase.rpc('get_menu_editions', { p_profile_id: profileId! });
      if (error) throw error;
      return sortEditions((data ?? []) as MenuEdition[]);
    },
  });
}

export interface DrinkMenuRun extends MenuDates {
  barId: string;
  barName: string;
  /** The menu to open: the one on now, else the latest it was on. */
  editionId: string;
  editionName: string;
}

/** The bar menus a drink was on, and when (menu_drink_runs). Empty for a drink no menu lists. */
export function useDrinkMenuRuns(itemId: string | null) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['drink-menu-runs', itemId, viewer.key],
    meta: viewer.meta,
    enabled: !!itemId,
    queryFn: async (): Promise<DrinkMenuRun[]> => {
      const { data, error } = await supabase
        .from('menu_drink_runs')
        .select('profile_id, edition_id, edition_name, start_year, start_month, end_year, end_month, is_current')
        .eq('item_id', itemId!);
      if (error) throw error;
      const rows = (data ?? []) as (MenuRunRow & { profile_id: string; edition_id: string; edition_name: string })[];
      if (!rows.length) return [];
      const bars = await supabase.from('profiles').select('id, display_name').in('id', rows.map((r) => r.profile_id));
      if (bars.error) throw bars.error;
      const names = new Map((bars.data ?? []).map((b) => [b.id as string, b.display_name as string]));
      return rows.map((r) => ({ ...runDates(r), barId: r.profile_id, barName: names.get(r.profile_id) ?? 'A bar', editionId: r.edition_id, editionName: r.edition_name }));
    },
  });
}

/**
 * The drinks on a menu edition with their ingredients and pictures, for
 * signed-in readers. Signed out, a bar's own drinks aren't readable, so the
 * menu shows their names (lib/menuEditions editionMenuDrinks).
 */
export function useMenuEditionDrinks(drinks: MenuEditionDrink[]) {
  const userId = useUserId();
  const ids = drinks.map((d) => d.id);
  return useQuery({
    queryKey: ['menu-edition-drinks', ids, userId],
    enabled: !!userId && ids.length > 0,
    queryFn: async (): Promise<MenuDrink[]> => {
      const { data, error } = await supabase.from('items').select(MENU_DRINK_COLUMNS).in('id', ids);
      if (error) throw error;
      return ((data ?? []) as unknown as MenuItemRow[]).map(toMenuDrink).filter((d): d is MenuDrink => !!d);
    },
  });
}

export interface MenuCreditWithProfile extends MenuCredit {
  /** The bar's public profile, to link to, when it has one. */
  barProfileId: string | null;
}

/**
 * Where these drinks are on bar menus: the credit that matters most.
 * ponytail: menus are readable by the bar's own members only, so a visitor
 * sees the menus of bars they work at. Showing every bar needs a public
 * "on the menu at" read from the publishing piece (7d).
 */
export function useMenuCredits(itemIds: string[]) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['menu-credits', itemIds, viewer.key],
    meta: viewer.meta,
    enabled: itemIds.length > 0,
    queryFn: async (): Promise<MenuCreditWithProfile[]> => {
      const { data, error } = await supabase
        .from('menu_drinks')
        .select('item_id, menu:menus(id, name, is_active, bar_id, bar:bars(name))')
        .in('item_id', itemIds);
      if (error) throw error;
      const credits = groupMenuCredits((data ?? []) as unknown as MenuDrinkRow[]);
      const barIds = [...new Set(credits.map((c) => c.barId).filter((id): id is string => !!id))];
      const profiles = barIds.length ? await supabase.from('profiles').select('id, bar_id').in('bar_id', barIds) : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const byBar = new Map((profiles.data ?? []).map((p) => [p.bar_id as string, p.id as string]));
      return credits.map((c) => ({ ...c, barProfileId: (c.barId && byBar.get(c.barId)) || null }));
    },
  });
}

// --- Claims ---

export interface ProfileClaim {
  id: string;
  profile_id: string;
  user_id: string;
  bar_id: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  /** How a bar proves it's theirs; 'note' for a person's claim. */
  method: ClaimMethod;
  /** The six digits for an Instagram bio or a call. */
  code: string | null;
  evidence: ClaimEvidence | null;
  /** A moderator's words when they turn it down. */
  decline_reason: string | null;
  /** Page settings chosen during venue setup while it waits; applied on approval (save_claim_setup). */
  setup: ClaimSetup | null;
}

/** What save_claim_setup keeps on a waiting bar claim. */
export interface ClaimSetup {
  page_visibility?: PageVisibility;
  hours?: Record<string, [string, string][]> | null;
  timezone?: string | null;
  phone?: string | null;
  website?: string | null;
}

export const CLAIM_COLUMNS = 'id, profile_id, user_id, bar_id, message, status, created_at, method, code, evidence, decline_reason, setup';

/** The signed-in person's claims on one profile, newest first. */
export function useMyClaims(profileId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['profile-claims', 'mine', profileId, userId],
    enabled: !!profileId && !!userId,
    queryFn: async (): Promise<ProfileClaim[]> => {
      const { data, error } = await supabase
        .from('profile_claims')
        .select(CLAIM_COLUMNS)
        .eq('profile_id', profileId!)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileClaim[];
    },
  });
}

export interface NewClaim {
  profile_id: string;
  /** How a moderator can check it: "I'm Jo, here's my Instagram". */
  message: string;
  /** Claiming a bar's profile on behalf of this venue. */
  bar_id: string | null;
}

/** Asks to take over an unclaimed profile. A moderator approves it. */
export function useClaimProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (claim: NewClaim): Promise<ProfileClaim> => {
      const message = claim.message.trim().slice(0, 1000) || null;
      const { data, error } = await supabase
        .from('profile_claims')
        .insert({ profile_id: claim.profile_id, message, bar_id: claim.bar_id })
        .select(CLAIM_COLUMNS)
        .single();
      if (error) throw error;
      return data as ProfileClaim;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-claims'] }),
    // Shown inline by ClaimProfile, not as the global toast.
    onError: () => {},
  });
}

/** What a moderator checks a claim against: the page as it stands. */
export interface ClaimPage {
  id: string;
  kind: ProfileKind;
  handle: string;
  display_name: string;
  website: string | null;
  instagram: string | null;
  social_links: string[] | null;
  locality: string | null;
  city: string | null;
  country_code: string | null;
  is_closed: boolean;
}

export interface ClaimForReview extends ProfileClaim {
  profile: ClaimPage | null;
  bar: { name: string } | null;
  /** The claimant's own person profile, if they have one. */
  claimant: { display_name: string; handle: string } | null;
}

/**
 * Pending claims by other people. Only moderators can read other people's
 * claims (RLS), so for everyone else this is empty.
 */
export function usePendingClaims() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['profile-claims', 'pending', userId],
    enabled: !!userId,
    // A moderation queue: always refetch rather than trust the persisted cache.
    staleTime: 0,
    queryFn: async (): Promise<ClaimForReview[]> => {
      const { data, error } = await supabase
        .from('profile_claims')
        .select(`${CLAIM_COLUMNS}, profile:profiles(id, kind, handle, display_name, website, instagram, social_links, locality, city, country_code, is_closed), bar:bars(name)`)
        .eq('status', 'pending')
        .neq('user_id', userId!)
        .order('created_at')
        .limit(100);
      if (error) throw error;
      const claims = (data ?? []) as unknown as Omit<ClaimForReview, 'claimant'>[];
      const userIds = [...new Set(claims.map((c) => c.user_id))];
      const people = userIds.length
        ? await supabase.from('profiles').select('user_id, display_name, handle').in('user_id', userIds)
        : { data: [], error: null };
      if (people.error) throw people.error;
      const byUser = new Map((people.data ?? []).map((p) => [p.user_id as string, { display_name: p.display_name as string, handle: p.handle as string }]));
      return claims.map((c) => ({ ...c, claimant: byUser.get(c.user_id) ?? null }));
    },
  });
}

export interface ClaimReview {
  claimId: string;
  approve: boolean;
  /** For a phone claim: the code the bar read out. */
  code?: string;
  /** For turning one down: what the claimant will see. */
  reason?: string;
}

/** Approves (hands the profile over) or turns down a claim. Moderators only. */
export function useReviewClaim() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ claimId, approve, code, reason }: ClaimReview) => {
      if (approve) {
        const { error } = await supabase.rpc('approve_profile_claim', { p_claim_id: claimId, p_code: code ?? null });
        if (error) throw error;
        return;
      }
      const { data, error } = await supabase
        .from('profile_claims')
        .update({
          status: 'rejected',
          decline_reason: reason?.trim().slice(0, 300) || null,
          reviewed_by: userId ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claimId)
        .eq('status', 'pending')
        .select('id');
      if (error) throw error;
      // RLS turns a non-moderator's update into a silent no-op; say so.
      if (!data?.length) throw new Error('Only moderators can turn down claims, and only pending ones.');
    },
    onSuccess: (_data, { approve }) => {
      qc.invalidateQueries({ queryKey: ['profile-claims'] });
      // An approval claims an unclaimed page; turning one down changes no page.
      if (approve) qc.invalidateQueries(changedProfiles({ unclaimed: true }));
    },
    // Shown inline by ClaimsReview, not as the global toast.
    onError: () => {},
  });
}

// --- Positions ---

export interface PositionProfile {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
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

const POSITION_PROFILE = 'id, handle, display_name, avatar_url';

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

/** Public people by name, so someone can find a profile we already have. */
export function usePublicPeople(search: string) {
  const term = search.replace(/[%_\\]/g, '').trim();
  return useQuery({
    queryKey: ['public-people', term],
    enabled: term.length >= 2,
    queryFn: async (): Promise<PublicPerson[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, handle, display_name, city, is_claimed, jobs:profile_positions!person_profile_id(title, is_current, is_shown, is_hidden, person_accepted, bar_accepted, bar:profiles!bar_profile_id(display_name))')
        .eq('kind', 'person')
        .eq('is_public', true)
        .ilike('display_name', `%${term}%`)
        .order('display_name')
        .limit(8);
      if (error) throw error;
      return ((data ?? []) as unknown as PersonRow[]).map(({ jobs, ...p }) => {
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
    },
  });
}

/** Rows counted per search: the first page of each group (RESULT_PAGE). */
const WAITING_ROWS = 1000;

/**
 * What waits on bar and person pages a search found (find-yourself): drinks
 * credited to each (made there, made by them, or co-made), and each bar's
 * people. Reads what the profile pages read: items signed in (RLS keeps what
 * you can see), published cards signed out.
 * ponytail: counts come from at most 1000 drink rows per search, and leave
 * out name-only credits at Names and Private bars (get_profile_name_credits
 * is one call per person). A count RPC would lift both.
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
      const list = `(${ids.join(',')})`;
      const credited = `creator_profile_id.in.${list},origin_bar_profile_id.in.${list}`;
      const none = Promise.resolve({ data: [], error: null });
      const [drinks, co, jobs, pages] = await Promise.all([
        userId
          ? supabase.from('items').select('id, creator_profile_id, origin_bar_profile_id').or(credited).limit(WAITING_ROWS)
          : supabase.from('published_items').select('id, creator_profile_id, origin_bar_profile_id').eq('is_reference', false).or(credited).limit(WAITING_ROWS),
        userId && personIds.length ? supabase.from('item_co_creators').select('item_id, profile_id').in('profile_id', [...personIds]).limit(WAITING_ROWS) : none,
        barIds.length ? supabase.from('profile_positions').select('bar_profile_id, person_profile_id, is_current, is_shown, is_hidden').in('bar_profile_id', [...barIds]).limit(WAITING_ROWS) : none,
        // Discover's bar rows don't say whether the page is claimed.
        supabase.from('profiles').select('id, is_claimed').in('id', ids),
      ]);
      for (const r of [drinks, co, jobs, pages]) if (r.error) throw r.error;
      const claimed = new Set((pages.data ?? []).filter((r) => r.is_claimed).map((r) => r.id as string));
      return countWaiting(ids, (drinks.data ?? []) as CreditRow[], (co.data ?? []) as { item_id: string; profile_id: string }[], (jobs.data ?? []) as JobRow[], claimed);
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
      return ((data ?? []) as unknown as WorkedMenu[]).sort(
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
      return ((data ?? []) as unknown as Position[]).filter((p) => p.person && p.bar).sort((a, b) => Number(b.is_current) - Number(a.is_current) || other(a).localeCompare(other(b)));
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

/** A person's picks in one section, by bar profile or drink id: shown or hidden. Plain JSON. */
export type Picks = Record<string, boolean>;

/**
 * Which bars or originals a person picked to show or hide (profile_picks).
 * Anyone reads a profile's originals picks; only the person reads their bars.
 */
export function useProfilePicks(profileId: string | null | undefined, section: Exclude<ShareSection, 'had'>) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['profile-picks', profileId, section, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<Picks> => {
      const { data, error } = await supabase.from('profile_picks').select('target_id, shown').eq('profile_id', profileId!).eq('section', section).limit(1000);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.target_id as string, r.shown as boolean]));
    },
  });
}

/** Shows or hides one bar or original on your own profile. */
export function useSetPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pick: { profileId: string; section: Exclude<ShareSection, 'had'>; targetId: string; shown: boolean }) => {
      const { error } = await supabase
        .from('profile_picks')
        .upsert({ profile_id: pick.profileId, section: pick.section, target_id: pick.targetId, shown: pick.shown }, { onConflict: 'profile_id,section,target_id' });
      if (error) throw new Error("Couldn't save that. Check your connection and try again.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-picks'] }),
    onError: () => {},
  });
}

/** Show all or Hide all of one section's bars or originals on your own profile. */
export function useSetPicks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, section, targetIds, shown }: { profileId: string; section: Exclude<ShareSection, 'had'>; targetIds: string[]; shown: boolean }) => {
      if (!targetIds.length) return;
      const rows = targetIds.map((target_id) => ({ profile_id: profileId, section, target_id, shown }));
      const { error } = await supabase.from('profile_picks').upsert(rows, { onConflict: 'profile_id,section,target_id' });
      if (error) throw new Error("Couldn't save that. Check your connection and try again.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-picks'] }),
    onError: () => {},
  });
}

/** A drink credited to a person at a bar whose page is Names or Private: its name and the bar, nothing more. */
export interface NameCredit {
  item_id: string;
  name: string;
  bar_profile_id: string;
  bar_handle: string;
  bar_name: string;
}

/** A person's name-only credits (get_profile_name_credits), signed in or out. */
export function useProfileNameCredits(profileId: string | null | undefined, enabled = true) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['profile-name-credits', profileId, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId && enabled,
    queryFn: async (): Promise<NameCredit[]> => {
      const { data, error } = await supabase.rpc('get_profile_name_credits', { p_profile_id: profileId! });
      if (error) throw error;
      return (data ?? []) as NameCredit[];
    },
  });
}
