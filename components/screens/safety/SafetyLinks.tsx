import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';

import type { IconName } from '@/components/ds';
import { useMakerPhotosWaiting } from '@/hooks/useMakerPhotos';
import { useIsModerator, useReportQueue } from '@/hooks/useModeration';
import { usePendingClaims } from '@/hooks/useProfiles';
import { useHiddenBars } from '@/hooks/useHiddenBars';
import { useMyBlocks } from '@/hooks/useSafety';

export interface LinkRowProps {
  label: string;
  detail?: string;
  icon: IconName;
  onPress: () => void;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Settings › Privacy and support rows for staying safe: Your reports,
 * Blocked people and Hidden bars for everyone, and the moderation queues (reports, profile
 * claims, bottle photos) for moderators, each with what's waiting. Settings passes its own
 * row so these match the rest of the panel.
 */
export function SafetyLinks({ row }: { row: (props: LinkRowProps) => ReactNode }) {
  const router = useRouter();
  const isModerator = useIsModerator();
  const blocked = useMyBlocks().data?.length ?? 0;
  const hidden = useHiddenBars().data?.length ?? 0;
  const open = useReportQueue(true, isModerator).data?.length ?? 0;
  // Only moderators can read other people's claims (RLS), so this is 0 for everyone else.
  const claimCount = usePendingClaims().data?.length ?? 0;
  // Likewise: only moderators get waiting bottle photos back.
  const photoCount = useMakerPhotosWaiting().data?.length ?? 0;
  const go = (path: string) => () => router.push(path as Href);
  return (
    <>
      {row({ label: 'Your reports', detail: 'What you reported and what happened', icon: 'flag', onPress: go('/settings/reports') })}
      {row({ label: 'Blocked people', detail: blocked ? plural(blocked, 'person', 'people') : 'Nobody', icon: 'nosign', onPress: go('/settings/blocked') })}
      {row({ label: 'Hidden bars', detail: hidden ? `${plural(hidden, 'bar')} kept off Discover` : 'None', icon: 'eye.slash', onPress: go('/settings/hidden-bars') })}
      {isModerator
        ? row({ label: 'Reports', detail: `Moderators only · ${open} open`, icon: 'lock.shield.fill', onPress: go('/settings/moderation') })
        : null}
      {claimCount
        ? row({ label: 'Profile claims', detail: `Moderators only · ${claimCount} waiting`, icon: 'person.crop.circle', onPress: go('/p/review-claims') })
        : null}
      {photoCount
        ? row({ label: 'Bottle photos', detail: `Moderators only · ${photoCount} waiting`, icon: 'photo', onPress: go('/p/review-photos') })
        : null}
    </>
  );
}
