import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { LINEAGE_COLUMNS, PROFILE_COLUMNS } from '@/hooks/useLineage';
import { MENU_DRINK_COLUMNS, toMenuDrink, type MenuItemRow } from '@/hooks/useMenus';
import { viewerScoped } from '@/lib/authCache';
import { sortAwards, type Award } from '@/lib/awards';
import type { ClaimEvidence, ClaimMethod } from '@/lib/claimVerification';
import { runDates, sortEditions, type MenuDates, type MenuEdition, type MenuEditionDrink, type MenuRunRow } from '@/lib/menuEditions';
import type { ItemImageLink } from '@/lib/itemImages';
import type { CreditProfile, CreditStatus, LineageDrink } from '@/lib/lineage';
import type { PageVisibility } from '@/lib/pageVisibility';
import { groupMenuCredits, parseProfileRef, profileQueryShows, type MenuCredit, type MenuDrinkRow, type ProfileChange } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import type { MenuDrink } from '@/types/menus';

export interface Profile {
  id: string;
  kind: 'person' | 'bar';
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
  /** A person who shows the drinks they've had, with their scores. */
  shares_rankings: boolean;
  /** A person who shows the bars they've had drinks at, with their average at each. */
  shares_bars: boolean;
  /** Shows the drinks they've made. Always true for a bar. */
  shares_made: boolean;
  /** A bar's: who outside it sees its page. Null for a person. */
  page_visibility: PageVisibility | null;
}

const COLUMNS = 'id, kind, handle, display_name, bio, avatar_url, website, instagram, social_links, locality, city, country_code, bar_id, is_public, is_claimed, is_closed, closed_year, shares_rankings, shares_bars, shares_made, page_visibility';

export const isUnclaimed = (p: Pick<Profile, 'is_claimed'>) => !p.is_claimed;

/** Filters for invalidateQueries: the cached profile pages a write changed, not every one opened. */
export const changedProfiles = (change: ProfileChange) => ({
  queryKey: ['profile'],
  predicate: (query: Query) => profileQueryShows(query.queryKey, query.state.data, change),
});

/** A profile by id or handle (a /p/<ref> link). Public ones for anyone; private ones for their owner. */
export function useProfile(ref: string | string[] | null | undefined) {
  const parsed = parseProfileRef(ref);
  const viewer = viewerScoped(useAuth().user?.id);
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
}

const ORIGINAL_COLUMNS = `${LINEAGE_COLUMNS}, item_type, description, glass:glassware_id(icon_key), item_images(angle, sort_order, is_generated, outdated_since, images(url))`;

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

/** Drinks credited to a profile: made by the person (alone or with others), or first made at the bar. */
export function useProfileOriginals(profileId: string | null | undefined) {
  const userId = useAuth().user?.id;
  const viewer = viewerScoped(userId);
  return useQuery({
    queryKey: ['profile-originals', profileId, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<Original[]> => {
      if (!userId) return publicOriginals(profileId!);
      const { data, error } = await supabase
        .from('items')
        .select(ORIGINAL_COLUMNS)
        .or((await creditedTo(profileId!)).join(','))
        .order('name')
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Original[];
    },
  });
}

/**
 * The drinks I've made: every drink I wrote up here (at a venue or on my
 * own), plus the ones credited to my profile when I have one. My own view;
 * other people see only what's credited (useProfileOriginals).
 */
export function useMyMadeDrinks(profileId: string | null | undefined) {
  const userId = useAuth().user?.id ?? null;
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
  const viewer = viewerScoped(useAuth().user?.id);
  return useQuery({
    queryKey: ['profile-awards', profileId, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<Award[]> => {
      const { data, error } = await supabase
        .from('profile_awards')
        .select('id, award, year, position, title, source_url')
        .eq('profile_id', profileId!);
      if (error) throw error;
      return sortAwards((data ?? []) as Award[]);
    },
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
  const viewer = viewerScoped(useAuth().user?.id);
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
  const userId = useAuth().user?.id ?? null;
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
  const viewer = viewerScoped(useAuth().user?.id);
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
}

export const CLAIM_COLUMNS = 'id, profile_id, user_id, bar_id, message, status, created_at, method, code, evidence, decline_reason';

/** The signed-in person's claims on one profile, newest first. */
export function useMyClaims(profileId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile-claims', 'mine', profileId, user?.id],
    enabled: !!profileId && !!user,
    queryFn: async (): Promise<ProfileClaim[]> => {
      const { data, error } = await supabase
        .from('profile_claims')
        .select(CLAIM_COLUMNS)
        .eq('profile_id', profileId!)
        .eq('user_id', user!.id)
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
  kind: 'person' | 'bar';
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
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile-claims', 'pending', user?.id],
    enabled: !!user,
    // A moderation queue: always refetch rather than trust the persisted cache.
    staleTime: 0,
    queryFn: async (): Promise<ClaimForReview[]> => {
      const { data, error } = await supabase
        .from('profile_claims')
        .select(`${CLAIM_COLUMNS}, profile:profiles(id, kind, handle, display_name, website, instagram, social_links, locality, city, country_code, is_closed), bar:bars(name)`)
        .eq('status', 'pending')
        .neq('user_id', user!.id)
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
  const { user } = useAuth();
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
          reviewed_by: user?.id ?? null,
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
}

/** Public people by name, so someone can find a profile we already have. */
export function usePublicPeople(search: string) {
  const term = search.replace(/[%_\\]/g, '').trim();
  return useQuery({
    queryKey: ['public-people', term],
    enabled: term.length >= 2,
    queryFn: async (): Promise<PublicPerson[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, handle, display_name, city, is_claimed')
        .eq('kind', 'person')
        .eq('is_public', true)
        .ilike('display_name', `%${term}%`)
        .order('display_name')
        .limit(8);
      if (error) throw error;
      return (data ?? []) as PublicPerson[];
    },
  });
}

export interface WorkedMenu {
  id: string;
  name: string;
  year: number | null;
  bar: { id: string; handle: string; display_name: string; is_closed: boolean };
}

/** Menus a person says they worked on, including at a bar that has closed. */
export function useWorkedMenus(profileId: string | null | undefined) {
  const viewer = viewerScoped(useAuth().user?.id);
  return useQuery({
    queryKey: ['profile-worked-menus', profileId, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<WorkedMenu[]> => {
      const { data, error } = await supabase
        .from('profile_worked_menus')
        .select('id, name, year, bar:profiles!bar_profile_id(id, handle, display_name, is_closed)')
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
  const viewer = viewerScoped(useAuth().user?.id);
  return useQuery({
    queryKey: ['profile-positions', profile?.id, viewer.key],
    meta: viewer.meta,
    enabled: !!profile,
    queryFn: async (): Promise<Position[]> => {
      const { data, error } = await supabase
        .from('profile_positions')
        .select(`id, title, is_current, is_shown, person_accepted, bar_accepted, person:profiles!person_profile_id(${POSITION_PROFILE}), bar:profiles!bar_profile_id(${POSITION_PROFILE})`)
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

/** The person's switch on one past job. Only they can turn it on (a trigger checks). */
export function useShowPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, shown }: { id: string; shown: boolean }) => {
      const { data, error } = await supabase.from('profile_positions').update({ is_shown: shown }).eq('id', id).select('id');
      if (error || !data?.length) throw new Error("Couldn't save that. Check your connection and try again.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-positions'] }),
    // Shown inline by PastJobs, not as the global toast.
    onError: () => {},
  });
}
