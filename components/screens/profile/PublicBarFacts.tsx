import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { hoursStatus } from '@/lib/barHours';
import { readableAccent } from '@/lib/color';

import { HoursSheet } from '../bar/HoursSheet';

const SHORT_DATE = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' });

/** "Hours from the bar · updated 3 Oct"; an unclaimed bar's were checked by us and may have changed. */
export function hoursSourceLine(claimed: boolean, updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const when = SHORT_DATE.format(new Date(updatedAt));
  return claimed ? `Hours from the bar · updated ${when}` : `Hours checked ${when} · may have changed`;
}

/**
 * Hours and location on a public bar page (ppl-pub-bar-desktop aside, a card;
 * on a phone, loose under the name): "Open now · until 1am" with Hours (this
 * week's hours, in the hours sheet), the address, then Directions (Google
 * Maps in a new tab), Call and Website three across, and where the hours came
 * from. Typed by the venue (b22 manual); nothing from Google. Nothing when the
 * bar has none of it.
 */
export function PublicBarFacts({ profileId }: { profileId: string }) {
  const ds = useDs();
  const wide = useBreakpoint() !== 'phone';
  const hydrated = useIsHydrated();
  const [week, setWeek] = useState(false);
  const { data: facts } = useBarFacts(profileId);
  if (!facts) return null;
  // The clock is read after hydration, so the static page and the first render agree.
  const status = hydrated ? hoursStatus(facts.hours, new Date(), facts.timezone) : null;
  const address = [facts.address_line, facts.locality].filter(Boolean).join(', ');
  const destination = facts.latitude != null && facts.longitude != null ? `${facts.latitude},${facts.longitude}` : [facts.display_name, address, facts.city].filter(Boolean).join(', ');
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  const source = facts.hours ? hoursSourceLine(facts.is_claimed, facts.hours_updated_at) : null;
  if (!status && !address && !facts.phone && !facts.website) return null;
  const glass = [styles.action, { backgroundColor: ds.c.glass, borderColor: ds.c.glassBorder }];

  return (
    <View style={[styles.block, wide && [styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]]} role="region" aria-label="Hours and location">
      {status ? (
        <PressableScale role="button" accessibilityLabel={`${[status.state, status.detail].filter(Boolean).join(', ')}. Show this week’s hours`} onPress={() => setWeek(true)} style={styles.row}>
          <IconSymbol name="clock" size={18} color={ds.c.muted} />
          <Body style={styles.flex} numberOfLines={1}>
            <DsText variant="body" color={status.open ? readableAccent(STATUS.success, ds.c.ground) : ds.c.ink} style={styles.strong}>
              {status.state}
            </DsText>
            {status.detail ? <DsText variant="body" tone="muted">{` · ${status.detail}`}</DsText> : null}
          </Body>
          <Caption tone="muted">Hours</Caption>
          <IconSymbol name="chevron.down" size={16} color={ds.c.muted} />
        </PressableScale>
      ) : null}
      {address ? (
        <View style={styles.row}>
          <IconSymbol name="location" size={18} color={ds.c.muted} />
          <Body style={styles.flex}>{address}</Body>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Directions"
          icon="arrow.triangle.turn.up.right.diamond"
          variant="secondary"
          accessibilityLabel={`Directions to ${facts.display_name}, opens Google Maps in a new tab`}
          onPress={() => void Linking.openURL(directions)}
          style={glass}
        />
        {facts.phone ? (
          <Button label="Call" icon="phone" variant="secondary" accessibilityLabel={`Call ${facts.display_name}`} onPress={() => void Linking.openURL(`tel:${facts.phone!.replace(/[^\d+]/g, '')}`)} style={glass} />
        ) : null}
        {facts.website ? (
          <Button label="Website" icon="globe" variant="secondary" accessibilityLabel={`${facts.display_name} website, opens in a new tab`} onPress={() => void Linking.openURL(facts.website!)} style={glass} />
        ) : null}
      </View>
      {source ? <Caption tone="muted">{source}</Caption> : null}
      {week ? <HoursSheet visible facts={facts} onClose={() => setWeek(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  block: { gap: space.sm + 2 },
  card: { padding: space.lg + 2, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: layout.minTapTarget },
  actions: { flexDirection: 'row', gap: space.sm },
  // Three across, each a third (ppl-pub-bar-desktop draws a three-column grid).
  action: { flex: 1, paddingHorizontal: space.sm },
});
