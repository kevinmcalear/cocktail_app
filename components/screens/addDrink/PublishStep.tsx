import { StyleSheet, View } from 'react-native';

import { Body, Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useBarPublishing } from '@/hooks/usePublishing';
import type { StepProps } from '@/lib/drinkWizard';

import { PublishChoice } from '../publishing/PublishChoice';

/**
 * Who outside the venue can see it. A venue's drink follows the venue's
 * default unless you choose; a drink at home starts private. Only choices the
 * database will accept are offered, and the rest say what opens them.
 */
export function PublishStep({ draft, set, barId }: StepProps & { barId: string | null }) {
  return <View style={styles.stack}>{barId ? <VenuePublish draft={draft} set={set} barId={barId} /> : <HomePublish draft={draft} set={set} />}</View>;
}

function VenuePublish({ draft, set, barId }: StepProps & { barId: string }) {
  const { data: caps, isPending } = useCapabilities(barId);
  const canPublish = !!caps?.includes('publish');
  const venue = useBarPublishing(barId);
  if (isPending) return <Caption tone="muted">Checking what you can publish…</Caption>;
  if (!canPublish) {
    return <Body tone="muted">It starts private to the venue. Someone who can publish here can open it up later.</Body>;
  }
  if (!venue.data) return <Caption tone="muted">{venue.error ? 'Couldn’t load the venue’s settings. It will follow them.' : 'Loading the venue’s settings…'}</Caption>;
  if (!venue.data.profile) {
    return <Body tone="muted">It stays private for now: the venue needs a public profile before its drinks can be seen outside it.</Body>;
  }
  return (
    <PublishChoice
      label="Who can see this drink"
      value={draft.publish}
      inherited={{ mode: venue.data.barDefault, source: 'bar' }}
      onChange={(publish) => set({ publish })}
    />
  );
}

function HomePublish({ draft, set }: StepProps) {
  const me = useMyProfile().data ?? null;
  if (!me?.isPublic || me.isModerated) {
    return <Body tone="muted">Private: only you can see it. Make your profile public on the You tab to share your drinks.</Body>;
  }
  return <PublishChoice label="Who can see this drink" value={draft.publish ?? 'private'} onChange={(publish) => set({ publish })} />;
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
});
