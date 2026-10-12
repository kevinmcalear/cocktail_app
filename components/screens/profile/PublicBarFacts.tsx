import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { hoursLine, weekRows } from '@/lib/barHours';

const SHORT_DATE = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' });

/** "Hours from the bar · updated 3 Oct"; an unclaimed bar's were checked by us and may have changed. */
export function hoursSourceLine(claimed: boolean, updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const when = SHORT_DATE.format(new Date(updatedAt));
  return claimed ? `Hours from the bar · updated ${when}` : `Hours checked ${when} · may have changed`;
}

/**
 * Hours and location on a public bar page (ppl-pub-bar-desktop aside): the
 * open-now line with Hours (the week, opened in place), the address, and
 * Directions (Google Maps in a new tab), Call and Website. Typed by the
 * venue (b22 manual); nothing from Google. Nothing when the bar has none.
 * ponytail: swap for #506's BarFactsBlock and HoursSheet once that branch carries them.
 */
export function PublicBarFacts({ profileId }: { profileId: string }) {
  const ds = useDs();
  const hydrated = useIsHydrated();
  const [week, setWeek] = useState(false);
  const { data: facts } = useBarFacts(profileId);
  if (!facts) return null;
  // The clock is read after hydration, so the static page and the first render agree.
  const now = hydrated ? new Date() : null;
  const line = now ? hoursLine(facts.hours, now, facts.timezone) : null;
  const address = [facts.address_line, facts.locality].filter(Boolean).join(', ');
  const destination = facts.latitude != null && facts.longitude != null ? `${facts.latitude},${facts.longitude}` : [facts.display_name, address, facts.city].filter(Boolean).join(', ');
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  const source = facts.hours ? hoursSourceLine(facts.is_claimed, facts.hours_updated_at) : null;
  if (!line && !address && !facts.phone && !facts.website) return null;

  return (
    <View style={styles.block} role="region" aria-label="Hours and location">
      {line ? (
        <PressableScale role="button" accessibilityLabel={`${line}. ${week ? 'Hide' : 'Show'} this week’s hours`} onPress={() => setWeek((w) => !w)} style={styles.row}>
          <IconSymbol name="clock" size={18} color={ds.c.muted} />
          <Body style={styles.flex}>{line}</Body>
          <Caption color={ds.accentText}>Hours</Caption>
        </PressableScale>
      ) : null}
      {week && facts.hours && now ? (
        <View style={styles.week}>
          {weekRows(facts.hours, now, facts.timezone).map((r) => (
            <View key={r.day} style={styles.weekRow}>
              <Caption tone={r.today ? 'ink' : 'muted'} style={styles.flex}>
                {r.day}
              </Caption>
              <Caption tone={r.closed ? 'muted' : 'ink'}>{r.text}</Caption>
            </View>
          ))}
        </View>
      ) : null}
      {address ? (
        <View style={styles.row}>
          <IconSymbol name="location" size={18} color={ds.c.muted} />
          <Body tone="muted" style={styles.flex}>
            {address}
          </Body>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Directions"
          icon="arrow.triangle.turn.up.right.diamond"
          variant="secondary"
          accessibilityLabel={`Directions to ${facts.display_name}, opens Google Maps in a new tab`}
          onPress={() => void Linking.openURL(directions)}
        />
        {facts.phone ? (
          <Button label="Call" icon="phone" variant="secondary" accessibilityLabel={`Call ${facts.display_name}`} onPress={() => void Linking.openURL(`tel:${facts.phone!.replace(/[^\d+]/g, '')}`)} />
        ) : null}
        {facts.website ? (
          <Button label="Website" icon="globe" variant="secondary" accessibilityLabel={`${facts.display_name} website, opens in a new tab`} onPress={() => void Linking.openURL(facts.website!)} />
        ) : null}
      </View>
      {source ? <Caption tone="muted">{source}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  block: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  week: { gap: space.xs, paddingLeft: space.xl + 2 },
  weekRow: { flexDirection: 'row', gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
