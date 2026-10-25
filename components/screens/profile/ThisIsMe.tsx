import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Headline, Tag, useDs, useGutter } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useMyClaims, type Profile } from '@/hooks/useProfiles';

import { useMadeBy } from './MadeBy';
import { PersonClaimSheet } from './PersonClaimSheet';

/**
 * "This is me" / "Not me" on an unclaimed person's page (find-yourself step
 * 3): a card beside the page on a wide screen ("Are you Ash?"), pinned to the
 * bottom on a phone. This is me opens the claim sheet; Not me puts it away.
 * Once a claim is sent it says so instead. Opened from "Claim it on your
 * phone" (/p/<handle>?claim=1), the sheet is already open.
 */
export function ThisIsMe({ profile, pinned = false }: { profile: Profile; pinned?: boolean }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const made = useMadeBy(profile);
  const { data: claims } = useMyClaims(profile.id);
  const [open, setOpen] = useState(useLocalSearchParams<{ claim?: string }>().claim === '1');
  const [notMe, setNotMe] = useState(false);
  const first = profile.display_name.split(' ')[0];
  const bar = made.positions.find((p) => p.is_current)?.bar.display_name ?? made.groups.find((g) => g.barName)?.barName ?? null;
  const latest = claims?.[0];
  if (notMe) return null;
  const sent = latest?.status === 'pending';
  const sheet = <PersonClaimSheet profile={profile} bar={bar} stats={made.stats} visible={open && !sent} onClose={() => setOpen(false)} />;
  const buttons = sent ? (
    <View style={styles.sent} role="status">
      <Tag label="Claim sent" />
      <Caption tone="muted">A person checks it, usually within a day.</Caption>
    </View>
  ) : (
    <>
      <Button label="This is me" size="lg" onPress={() => setOpen(true)} />
      <Button label="Not me" variant="ghost" onPress={() => setNotMe(true)} />
    </>
  );
  if (pinned) {
    return (
      <View style={[styles.pinned, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.md, backgroundColor: ds.c.ground, borderTopColor: ds.c.line }]}>
        {buttons}
        {sheet}
      </View>
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
      <Headline role="heading">{`Are you ${first}?`}</Headline>
      <Body tone="muted">
        {latest?.status === 'rejected' ? (latest.decline_reason ?? 'Your last claim wasn’t approved. You can try again with more detail.') : 'Claim the page and these drinks are yours.'}
      </Body>
      {buttons}
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  pinned: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: space.xs, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  sent: { gap: space.xs, alignItems: 'flex-start' },
});
