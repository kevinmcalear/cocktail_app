import type { MyProfile } from '@/hooks/useMyProfile';
import { useMyMadeDrinks, useProfileAwards, useProfilePicks } from '@/hooks/useProfiles';
import { useMyHadDrinks, useMyHadPicks } from '@/hooks/useRankings';
import { tallyBars } from '@/lib/hadDrinks';
import { pickedShown, SHARE_MODES, type ShareMode } from '@/lib/profiles';

export interface ShownCount {
  shown: number;
  total: number;
}

export type CountedSection = 'had' | 'bars' | 'originals' | 'awards';

const count = (mode: ShareMode, picks: (boolean | null | undefined)[]): ShownCount => ({ shown: picks.filter((p) => pickedShown(mode, p)).length, total: picks.length });

/**
 * How many of your drinks, bars, originals and awards show now ("4 of 7"),
 * for the profile hub and What people see. An award shows once it's
 * confirmed; one waiting counts in the total.
 */
export function useSharingCounts(profile: MyProfile | null): Record<CountedSection, ShownCount> | null {
  const drinks = useMyHadDrinks().data ?? [];
  const hadPicks = useMyHadPicks().data ?? {};
  const barPicks = useProfilePicks(profile?.id, 'bars').data ?? {};
  const madePicks = useProfilePicks(profile?.id, 'originals').data ?? {};
  const made = useMyMadeDrinks(profile?.id).data ?? [];
  const awards = (useProfileAwards(profile?.id).data ?? []).filter((a) => a.status !== 'declined');
  if (!profile) return null;
  return {
    had: count(profile.sharing.had, drinks.map((d) => hadPicks[d.id]?.onProfile)),
    bars: count(profile.sharing.bars, tallyBars(drinks).flatMap((b) => (b.venue ? [barPicks[b.venue.id]] : []))),
    originals: count(profile.sharing.originals, made.map((d) => madePicks[d.id])),
    awards: {
      shown: awards.filter((a) => a.status === 'confirmed' && pickedShown(profile.awardsMode, a.on_profile)).length,
      total: awards.length,
    },
  };
}

/** "Picked, 4 of 7", or just "All" / "None". */
export function modeCount(mode: ShareMode, c: ShownCount | undefined): string {
  const label = SHARE_MODES.find((m) => m.value === mode)?.label ?? 'All';
  return mode === 'picked' && c ? `${label}, ${c.shown} of ${c.total}` : label;
}
