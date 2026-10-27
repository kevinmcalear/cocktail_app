import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useVenueClaim, useVenuePage } from '@/hooks/useVenueSetup';
import { withAlpha } from '@/lib/color';
import type { RowState } from '@/lib/setupChecklist';

/**
 * One row of "Set up <bar>": a tick once it's done, else its number (in the
 * accent for the one that's next, with Continue), what it is, and a note of
 * what's there. Each step has its own Skip; a skipped row says so.
 */
export function ChecklistRow({ n, title, line, note, state, first, action = 'Continue', onPress }: { n: number; title: string; line: string; note?: string; state: RowState; first?: boolean; action?: string; onPress: () => void }) {
  const ds = useDs();
  const now = state === 'now';
  const sub = [line, state === 'skipped' ? 'Skipped for now' : note].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, first ? null : { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <PressableScale role="button" accessibilityLabel={[`${n}. ${title}`, sub, state === 'done' ? 'Done' : null].filter(Boolean).join(', ')} onPress={onPress} style={styles.main}>
        <View style={[styles.mark, state === 'done' ? { backgroundColor: withAlpha(STATUS.success, 0.18) } : { backgroundColor: now ? ds.accentFill.fill : ds.c.raised }]}>
          {state === 'done' ? <IconSymbol name="checkmark" size={16} color={STATUS.success} /> : <Caption color={now ? ds.accentFill.text : ds.c.muted} style={styles.strong}>{String(n)}</Caption>}
        </View>
        <View style={styles.flex}>
          <Body style={styles.strong}>{title}</Body>
          <Caption tone="muted">{sub}</Caption>
        </View>
        {now ? null : <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />}
      </PressableScale>
      {/* Under the row, in line with its number (owner-setup step 5). */}
      {now ? <Button label={action} dense onPress={onPress} accessibilityLabel={`${action}: ${title.toLowerCase()}`} style={styles.go} /> : null}
    </View>
  );
}

/** "From your drinks": the glasses, ice and tools the bar's drinks name that aren't in its Kit yet (Kit and ice, step 12). */
export function FromDrinksRow({ count, onPress }: { count: number; onPress: () => void }) {
  const ds = useDs();
  const line = `${count} ${count === 1 ? 'thing your drinks name isn’t' : 'things your drinks name aren’t'} in your Kit`;
  return (
    <PressableScale role="link" accessibilityLabel={`From your drinks. ${line}`} onPress={onPress} style={[styles.main, styles.from, { borderBottomColor: ds.c.line }]}>
      <View style={styles.flex}>
        <Body>From your drinks</Body>
        <Caption tone="muted">{line}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/**
 * Where proving it's yours stands, under the checklist: waiting, with the
 * claim being checked, or a way to do it now. Nothing once the page is theirs.
 */
export function ClaimNote({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const claim = useVenueClaim(barId);
  const page = useVenuePage(barId);
  if (!claim.isSuccess || !page.isSuccess || page.data || claim.data?.status === 'approved') return null;
  const waiting = claim.data?.status === 'pending';
  return (
    <View style={[styles.claim, { backgroundColor: ds.c.raised }]}>
      <View style={styles.claimHead}>
        <Body style={[styles.strong, styles.flex]}>Proving it’s yours</Body>
        {waiting ? <Tag label="Waiting" /> : null}
      </View>
      <Caption tone="muted">{waiting ? 'We’re checking it’s yours. Everything here works while you wait.' : 'Your page stays private until we’ve checked it’s yours. Everything here works meanwhile.'}</Caption>
      {waiting ? null : <Button label="Prove it’s yours" variant="secondary" dense onPress={() => router.push(`/venue-setup?bar=${barId}&step=claim` as Href)} style={styles.start} />}
    </View>
  );
}

/** Over How it looks when Your team opens it first (invite-team-last, step 2): why the look comes before the invites. */
export function LookFirstNote() {
  const ds = useDs();
  return (
    <View style={[styles.lookFirst, { backgroundColor: withAlpha(ds.accentFill.fill, 0.14) }]}>
      <Body>Your team’s invite wears this: the logo, colour and font go into every email.</Body>
    </View>
  );
}

/** Wide web, beside the checklist: what the next row is about (owner-setup step 5). */
export function NextCard({ title, line }: { title: string; line: string }) {
  const ds = useDs();
  return (
    <View style={[styles.next, { backgroundColor: ds.c.surface }]}>
      <Caption tone="muted" style={styles.eyebrow}>{`Next: ${title}`.toUpperCase()}</Caption>
      <Body tone="muted">{line}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.xs },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.lg },
  mark: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  flex: { flex: 1, minWidth: 0 },
  from: { borderBottomWidth: StyleSheet.hairlineWidth },
  claim: { gap: space.xs, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  claimHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  start: { alignSelf: 'flex-start', marginTop: space.xs },
  go: { alignSelf: 'flex-start', marginBottom: space.md },
  next: { width: 320, gap: space.sm, padding: space.xl, borderRadius: radius.card, borderCurve: 'continuous' },
  eyebrow: { fontFamily: fontFamilies.bodySemiBold, letterSpacing: 1.2 },
  lookFirst: { padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
});
