import { getLocales } from 'expo-localization';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { fontFamilies, layout, space } from '@/constants/tokens';
import type { BarFacts } from '@/hooks/useBarFacts';
import { hoursStatus } from '@/lib/barHours';
import { readableAccent } from '@/lib/color';
import { addressLine, awayFrom, walkTime } from '@/lib/directions';
import { usesMiles } from '@/lib/nearMe';

import { DirectionsButton, type DirectionsTarget } from './Directions';
import { HoursSheet } from './HoursSheet';

type Point = { latitude: number; longitude: number } | null | undefined;

/** Where Directions goes, from a bar's facts; null without coordinates. */
export function directionsTarget(facts: BarFacts | null | undefined, from: Point): DirectionsTarget | null {
  if (!facts || facts.latitude == null || facts.longitude == null) return null;
  const away = awayFrom(from, facts, usesMiles(getLocales()[0]));
  return {
    name: facts.display_name,
    latitude: facts.latitude,
    longitude: facts.longitude,
    address: addressLine(facts),
    away: [away, walkTime(from, facts)].filter(Boolean).join(' · ') || null,
  };
}

/** "Cocktail bar · Fitzroy": the bar's type before where it is, when it has one. */
export function barPlace(type: string | null | undefined, place: string | null | undefined): string {
  return [type, place].filter(Boolean).join(' · ');
}

function Line({ icon, children }: { icon: 'clock' | 'mappin.and.ellipse'; children: React.ReactNode }) {
  const ds = useDs();
  return (
    <View style={styles.line}>
      <IconSymbol name={icon} size={16} color={ds.c.muted} />
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

/**
 * "Open now · until 1am" with a clock, in the bar's own time. With `sheet`,
 * the row opens this week's hours ("Hours", disc-search-bar). Nothing when
 * the bar hasn't given its hours.
 */
export function HoursLine({ facts, sheet = false }: { facts: BarFacts | null | undefined; sheet?: boolean }) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const status = facts?.hours ? hoursStatus(facts.hours, new Date(), facts.timezone) : null;
  if (!facts || !status) return null;
  const words = (
    <DsText variant="caption" numberOfLines={1}>
      <DsText variant="caption" color={status.open ? readableAccent(STATUS.success, ds.c.ground) : ds.c.ink} style={styles.strong}>
        {status.state}
      </DsText>
      {status.detail ? <DsText variant="caption" tone="muted">{` · ${status.detail}`}</DsText> : null}
    </DsText>
  );
  if (!sheet) return <Line icon="clock">{words}</Line>;
  return (
    <>
      <Pressable
        role="button"
        accessibilityLabel={`${[status.state, status.detail].filter(Boolean).join(', ')}. Show this week's hours`}
        onPress={() => setOpen(true)}
        style={styles.tap}
      >
        <Line icon="clock">{words}</Line>
        <Caption>Hours</Caption>
        <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
      </Pressable>
      <HoursSheet visible={open} facts={facts} onClose={() => setOpen(false)} />
    </>
  );
}

/** "42 Gertrude St, Fitzroy · 400 m" with a pin; nothing without an address. */
export function AddressLine({ facts, from }: { facts: BarFacts | null | undefined; from?: Point }) {
  const address = facts ? addressLine(facts) : null;
  if (!facts || !address) return null;
  const away = awayFrom(from, facts, usesMiles(getLocales()[0]));
  return (
    <Line icon="mappin.and.ellipse">
      <Caption tone="muted" numberOfLines={1}>
        {[address, away].filter(Boolean).join(' · ')}
      </Caption>
    </Line>
  );
}

/** Directions, Call and Website (b32: for every bar that has them). */
export function BarContact({ facts, from }: { facts: BarFacts | null | undefined; from?: Point }) {
  if (!facts) return null;
  const target = directionsTarget(facts, from);
  const name = facts.display_name;
  if (!target && !facts.phone && !facts.website) return null;
  return (
    <View style={styles.actions}>
      <DirectionsButton target={target} />
      {facts.phone ? (
        <Button label="Call" icon="phone" variant="secondary" accessibilityLabel={`Call ${name}`} onPress={() => void Linking.openURL(`tel:${facts.phone!.replace(/[^\d+]/g, '')}`)} />
      ) : null}
      {facts.website ? (
        <Button label="Website" icon="globe" variant="secondary" accessibilityLabel={`${name} website, opens in a new tab`} onPress={() => void Linking.openURL(facts.website!)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  tap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
