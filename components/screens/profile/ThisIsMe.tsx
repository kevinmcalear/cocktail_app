import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
  const { data: claims, isLoading } = useMyClaims(profile.id);
  const router = useRouter();
  const [open, setOpen] = useState(useLocalSearchParams<{ claim?: string }>().claim === '1');
  // The link opens it once: Back, a reload or a resize doesn't open it again.
  useEffect(() => {
    if (open) router.setParams({ claim: undefined });
  }, [open, router]);
  const [notMe, setNotMe] = useState(false);
  const first = profile.display_name.split(' ')[0];
  const jobs = [...made.positions].sort((a, b) => Number(b.is_current) - Number(a.is_current) || (b.start_year ?? 0) - (a.start_year ?? 0));
  // "<bar> confirms you" from a bar on the page that's claimed (it has a venue), current first.
  const confirming = jobs.find((p) => p.bar.bar_id);
  const bar = (confirming ?? jobs[0])?.bar.display_name ?? made.groups.find((g) => g.barName)?.barName ?? null;
  const confirmBar = confirming?.bar.id ?? null;
  const latest = claims?.[0];
  if (notMe) return null;
  const sent = latest?.status === 'pending';
  const asked = latest?.evidence?.confirm_bar ? (jobs.find((p) => p.bar.id === latest.evidence?.confirm_bar)?.bar.display_name ?? 'The bar') : null;
  const sheet = <PersonClaimSheet profile={profile} bar={bar} confirmBar={confirmBar} stats={made.stats} visible={open && !isLoading && !sent} onClose={() => setOpen(false)} />;
  const buttons = sent ? (
    <View style={styles.sent} role="status">
      <Tag label="Claim sent" />
      <Caption tone="muted">{asked ? `${asked}’s Admin confirms it on their Team screen.` : 'A person checks it, usually within a day.'}</Caption>
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
