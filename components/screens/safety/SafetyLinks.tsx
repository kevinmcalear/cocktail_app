import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { useIsModerator } from '@/hooks/useModeration';
import { usePendingClaims } from '@/hooks/useProfiles';

/**
 * Settings › Account rows for safety: Your reports and Blocked people for everyone, and the
 * moderation queues (reports, profile claims) for moderators. Settings passes
 * its own row so these match the rest of the panel.
 */
export function SafetyLinks({ row }: { row: (label: string, onPress: () => void) => ReactNode }) {
  const router = useRouter();
  const isModerator = useIsModerator();
  // Only moderators can read other people's claims (RLS), so this is 0 for everyone else.
  const claimCount = usePendingClaims().data?.length ?? 0;
  return (
    <>
      {row('Your reports', () => router.push('/settings/reports'))}
      {row('Blocked people', () => router.push('/settings/blocked'))}
      {isModerator ? row('Reports', () => router.push('/settings/moderation')) : null}
      {claimCount ? row(`Profile claims (${claimCount} waiting)`, () => router.push('/p/review-claims')) : null}
    </>
  );
}
