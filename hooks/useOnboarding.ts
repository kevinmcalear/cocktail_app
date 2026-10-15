import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth, useUserId } from '@/ctx/AuthContext';
import { majorityUnit, splitName } from '@/lib/onboarding';
import { DEFAULT_IDENTITY } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

import { saveNewRound } from './useFirstRound';
import { useSaveMyProfile } from './useMyProfile';

const SAVED = "Couldn't save that. Check your connection and try again.";

/** Saves the account name and the person profile, and returns the profile id. */
export function useSaveOnboardingName() {
  const userId = useUserId();
  const { updateProfile } = useAuth();
  const save = useSaveMyProfile();
  return useMutation({
    mutationFn: async (input: { name: string; handle: string; profileId: string | null }): Promise<string> => {
      if (!userId) throw new Error(SAVED);
      const name = input.name.trim();
      const { firstName, lastName } = splitName(name);
      const { error: authError } = await updateProfile({ firstName, lastName, fullName: name });
      if (authError) throw new Error(SAVED);
      try {
        await save.mutateAsync({ id: input.profileId, draft: { name, handle: input.handle, bio: '', instagram: '', isPublic: true, ...DEFAULT_IDENTITY } });
      } catch (e) {
        const message = e instanceof Error ? e.message : SAVED;
        throw new Error(message);
      }
      const { data, error } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle();
      if (error || !data) throw new Error(SAVED);
      return data.id;
    },
    onError: () => {},
  });
}

function savedError(error: { code?: string; message: string }, duplicate: string): Error {
  if (error.code === '23505') return new Error(duplicate);
  if (error.message.startsWith('That ') || error.message.startsWith('You already have a claim')) return new Error(error.message);
  return new Error(SAVED);
}

/**
 * Lists where they work, or used to. Same write as any other position: their
 * own profile. A closed bar is still a bar profile, so it is allowed.
 * Not bar access: a manager still invites them onto the venue's menus.
 */
export function useSaveWorkplace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: string; barId: string; title: string; isCurrent?: boolean; start?: { year: number; month: number } | null; end?: { year: number; month: number } | null }) => {
      const { error } = await supabase.from('profile_positions').insert({
        person_profile_id: input.personId,
        bar_profile_id: input.barId,
        title: input.title.trim(),
        is_current: input.isCurrent !== false,
        // The job dates (profile_positions.start_*, end_*); a current job has no end.
        ...(input.start ? { start_year: input.start.year, start_month: input.start.month } : null),
        ...(input.end && input.isCurrent === false ? { end_year: input.end.year, end_month: input.end.month } : null),
      });
      if (error) throw savedError(error, "You're already listed there with that role.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-positions'] }),
    onError: () => {},
  });
}

/** A menu they worked on. Same writers as a position, including at a closed bar. */
export function useSaveWorkedMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: string; barId: string; name: string; year: number | null }) => {
      const { error } = await supabase.from('profile_worked_menus').insert({
        person_profile_id: input.personId,
        bar_profile_id: input.barId,
        name: input.name.trim(),
        year: input.year,
      });
      if (error) throw savedError(error, "You've already added that menu.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-worked-menus'] }),
    onError: () => {},
  });
}

/** Takes a menu off their list (their own profile's row; RLS checks). */
export function useRemoveWorkedMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('profile_worked_menus').delete().eq('id', id);
      if (error) throw new Error(SAVED);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-worked-menus'] }),
    onError: () => {},
  });
}

/**
 * A cocktail they made or helped make. A normal shared drink: they are the
 * creator, the credit starts as suggested, and the origin can be a closed bar.
 */
export function useSaveCareerDrink() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: { personId: string; barId: string | null; name: string }): Promise<string> => {
      if (!userId) throw new Error(SAVED);
      const { data, error } = await supabase.from('items').insert({
        name: input.name.trim(),
        item_type: 'cocktail',
        bar_id: null,
        created_by: userId,
        creator_profile_id: input.personId,
        origin_bar_profile_id: input.barId,
        credit_status: 'suggested',
        publish_mode: 'description',
      }).select('id').single();
      if (error) throw savedError(error, "You've already added that cocktail.");
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-originals'] }),
    onError: () => {},
  });
}

/** Takes back a cocktail they added during setup (theirs alone, so RLS lets them). */
export function useRemoveCareerDrink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw new Error(SAVED);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-originals'] }),
    onError: () => {},
  });
}

/** A new venue they run, from onboarding or Settings › Venues. */
export function useCreateOnboardingBar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.rpc('create_new_bar', {
        p_name: name.trim(),
        p_visibility: 10,
        p_generic: 20,
        p_specific: 30,
        p_measurement: 30,
        p_prep: 40,
      });
      if (error) throw new Error(error.message || SAVED);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bars'] }),
    onError: () => {},
  });
}

/** Marks setup finished so the app stops sending them back here. */
export function useFinishOnboarding() {
  const { updateProfile } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await updateProfile({ onboarded: true });
      if (error) throw new Error(SAVED);
      // New people get the first round at their venue (lib/firstRound.ts). A miss only skips the intro.
      await saveNewRound();
    },
    onError: () => {},
  });
}

/** The unit a venue writes its specs in (oz or ml), from its own recipes, for the invited units step. Null when it has none yet. */
export function useVenueSpecUnit(barId: string | null) {
  return useQuery({
    queryKey: ['venue-spec-unit', barId],
    enabled: !!barId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<'oz' | 'ml' | null> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('unit, drink:items!recipe_item_id!inner(bar_id)')
        .eq('drink.bar_id', barId!)
        .in('unit', ['oz', 'ml'])
        .limit(500);
      if (error) throw error;
      return majorityUnit((data ?? []).map((r) => r.unit));
    },
  });
}
