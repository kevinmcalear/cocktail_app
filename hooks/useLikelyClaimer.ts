import { useMutation } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useMyClaims, useProfilePositions, type Original, type Profile } from '@/hooks/useProfiles';
import { creators } from '@/lib/lineage';
import { namesMatch, readSetupAnswer, viewerNameKeys, worksInBars, type SetupAnswer } from '@/lib/likelyClaimer';
import { supabase } from '@/lib/supabase';

/**
 * Keeps "What brings you here?" in the account's metadata (no migration), so
 * bar pages know who works in bars (Q33). A miss only means the claim prompts
 * stay quieter for them, so it doesn't stop setup.
 */
export function useSaveSetupAnswer() {
  return useMutation({
    mutationFn: async (answer: SetupAnswer) => {
      // Merged into user_metadata beside `onboarded`; AuthContext picks up USER_UPDATED.
      const { error } = await supabase.auth.updateUser({ data: { setup_answer: answer } });
      if (error) throw error;
    },
    onError: () => {},
  });
}

function useViewerNames(): string[] {
  const { user } = useAuth();
  const mine = useMyProfile().data;
  return viewerNameKeys(user?.user_metadata, mine?.displayName);
}

/** An unclaimed person's page is likely theirs: the same name, or they've already asked for it. */
export function useLikelyPerson(profile: Pick<Profile, 'id' | 'display_name'> | null): boolean {
  const names = useViewerNames();
  const { data: claims } = useMyClaims(profile?.id);
  return !!profile && (!!claims?.length || namesMatch(names, [profile.display_name]));
}

/**
 * A bar's page likely has the viewer on it: they said in setup they make
 * drinks at a bar or run one, or their name is on its drinks or its people.
 */
export function useLikelyAtBar(profile: Pick<Profile, 'id' | 'kind'>, originals: readonly Original[]): boolean {
  const { user } = useAuth();
  const names = useViewerNames();
  const people = useProfilePositions(profile).data ?? [];
  if (worksInBars(readSetupAnswer(user?.user_metadata))) return true;
  const credited = [...originals.flatMap((d) => creators(d).map((p) => p.display_name)), ...people.map((p) => p.person.display_name)];
  return namesMatch(names, credited);
}
