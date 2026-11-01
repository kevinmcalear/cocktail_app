import { useLocalSearchParams } from 'expo-router';

import { useMyProfile } from '@/hooks/useMyProfile';
import { useMyMadeDrinks } from '@/hooks/useProfiles';
import { useMyHadDrinks } from '@/hooks/useRankings';
import type { ShareSection } from '@/lib/profiles';

import { YouPage } from './YouPage';
import { YouTabs } from './YouTabs';

/**
 * Your drinks, from You's Kept: every drink you've had with your score, how
 * each bar did, your originals, and who sees each one. `?tab=originals` opens
 * on Originals (You's Credits).
 */
export function YourDrinksScreen() {
  const { tab } = useLocalSearchParams<{ tab?: ShareSection }>();
  const { data: profile } = useMyProfile();
  const had = useMyHadDrinks();
  const made = useMyMadeDrinks(profile?.id);
  return (
    <YouPage title="Your drinks" wide>
      <YouTabs initial={tab} profile={profile ?? null} drinks={had.data ?? []} made={made.data ?? []} loading={had.isLoading || made.isLoading} failed={!!had.error} />
    </YouPage>
  );
}
