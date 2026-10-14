import { getLocales } from 'expo-localization';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LineGlyph } from '@/components/ui/lineGlyphs';
import { STATUS } from '@/constants/palette';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { hoursStatus } from '@/lib/barHours';
import { readableAccent } from '@/lib/color';
import { awayFrom } from '@/lib/directions';
import { usesMiles } from '@/lib/nearMe';
import { instagramUrl, normalizeInstagram } from '@/lib/profiles';
import { useLastPlace } from '@/store/useLastPlace';

import { directionsTarget } from '../bar/BarFactLines';
import { useDirections } from '../bar/Directions';
import { HoursSheet } from '../bar/HoursSheet';

const SHORT_DATE = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' });

/** "Hours from the bar · updated 3 Oct"; an unclaimed bar's were checked by us and may have changed. */
export function hoursSourceLine(claimed: boolean, updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const when = SHORT_DATE.format(new Date(updatedAt));
  return claimed ? `Hours from the bar · updated ${when}` : `Hours checked ${when} · may have changed`;
}

/**
 * Hours and location on a bar's page (ppl-pub-bar-desktop aside, a card; on a
 * phone, loose under the name, ppl-bar-top): "Open now · until 1am" with Hours
 * (this week's hours, in the hours sheet), the address and how far, its
 * Instagram under the address, then Directions (Google Maps in a new tab on
 * the web, your maps app on a phone), Call and Website three across, and where
 * the hours came from. Typed by the venue (b22 manual); nothing from Google.
 * Nothing when the bar has none of it.
 */
export function PublicBarFacts({ profileId, instagram }: { profileId: string; instagram?: string | null }) {
  const ds = useDs();
  const wide = useBreakpoint() !== 'phone';
  const hydrated = useIsHydrated();
  const [week, setWeek] = useState(false);
  const { data: facts } = useBarFacts(profileId);
  // ponytail: the last near-me place, snapped to about 1 km, so the distance is rough; a live position needs the location prompt on this page.
  const from = useLastPlace((s) => s.place);
  const directions = useDirections(directionsTarget(facts, from));
  const handle = instagram ? normalizeInstagram(instagram) : '';
  if (!facts && !handle) return null;
  const insta = handle ? (
    <PressableScale role="link" accessibilityLabel={`@${handle} on Instagram`} accessibilityHint="Opens Instagram" onPress={() => void Linking.openURL(instagramUrl(handle))} style={styles.row}>
      <LineGlyph name="instagram" size={18} color={ds.c.muted} />
      <DsText variant="body" color={ds.accentText} style={[styles.flex, styles.text]} numberOfLines={1}>
        {`@${handle}`}
      </DsText>
    </PressableScale>
  ) : null;
  const card = [styles.block, wide && [styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]];
  if (!facts)
    return (
      <View style={card} role="region" aria-label="Instagram">
        {insta}
      </View>
    );
  // The clock is read after hydration, so the static page and the first render agree.
  const status = hydrated ? hoursStatus(facts.hours, new Date(), facts.timezone) : null;
  const address = [facts.address_line, facts.locality].filter(Boolean).join(', ');
  const destination = facts.latitude != null && facts.longitude != null ? `${facts.latitude},${facts.longitude}` : [facts.display_name, address, facts.city].filter(Boolean).join(', ');
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  const away = awayFrom(from, facts, usesMiles(getLocales()[0]));
  const hasPoint = facts.latitude != null && facts.longitude != null;
  const source = facts.hours ? hoursSourceLine(facts.is_claimed, facts.hours_updated_at) : null;
  if (!status && !address && !facts.phone && !facts.website && !insta) return null;
  const glass = [styles.action, { backgroundColor: ds.c.glass, borderColor: ds.c.glassBorder }];

  return (
    <View style={card} role="region" aria-label="Hours and location">
      {status ? (
        <PressableScale role="button" accessibilityLabel={`${[status.state, status.detail].filter(Boolean).join(', ')}. Show this week’s hours`} onPress={() => setWeek(true)} style={styles.row}>
          <IconSymbol name="clock" size={18} color={ds.c.muted} />
          <Body style={[styles.flex, styles.text]} numberOfLines={1}>
            <DsText variant="body" color={status.open ? readableAccent(STATUS.success, ds.c.ground) : ds.c.ink} style={[styles.text, styles.strong]}>
              {status.state}
            </DsText>
            {status.detail ? <DsText variant="body" tone="muted" style={styles.text}>{` · ${status.detail}`}</DsText> : null}
          </Body>
          <Caption tone="muted">Hours</Caption>
          <IconSymbol name="chevron.down" size={16} color={ds.c.muted} />
        </PressableScale>
      ) : null}
      {address ? (
        <View style={styles.row}>
          <IconSymbol name="location" size={18} color={ds.c.muted} />
          <Body style={[styles.flex, styles.text]}>
            {address}
            {away ? <DsText variant="body" tone="muted" style={styles.text}>{` · ${away}`}</DsText> : null}
          </Body>
        </View>
      ) : null}
      {insta}
      <View style={styles.actions}>
        <Button
          label="Directions"
          icon="arrow.triangle.turn.up.right.diamond"
          variant="secondary"
          dense
          accessibilityLabel={`Directions to ${facts.display_name}, ${hasPoint && Platform.OS !== 'web' ? 'opens your maps app' : 'opens Google Maps in a new tab'}`}
          onPress={() => (hasPoint ? directions.open() : void Linking.openURL(mapsUrl))}
          style={glass}
        />
        {facts.phone ? (
          <Button label="Call" icon="phone" variant="secondary" dense accessibilityLabel={`Call ${facts.display_name}`} onPress={() => void Linking.openURL(`tel:${facts.phone!.replace(/[^\d+]/g, '')}`)} style={glass} />
        ) : null}
        {facts.website ? (
          <Button label="Website" icon="globe" variant="secondary" dense accessibilityLabel={`${facts.display_name} website, opens in a new tab`} onPress={() => void Linking.openURL(facts.website!)} style={glass} />
        ) : null}
        {/* A third each, as drawn, even when the bar has no phone or website. */}
        {Array.from({ length: 2 - (facts.phone ? 1 : 0) - (facts.website ? 1 : 0) }, (_, i) => (
          <View key={i} style={styles.action} />
        ))}
      </View>
      {source ? <Caption tone="muted">{source}</Caption> : null}
      {directions.sheet}
      {week ? <HoursSheet visible facts={facts} onClose={() => setWeek(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  // 15 on 22, as drawn.
  text: { fontSize: type.label.fontSize, lineHeight: 22 },
  block: { gap: space.sm + 2 },
  card: { padding: space.lg + 2, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: layout.minTapTarget },
  actions: { flexDirection: 'row', gap: space.sm },
  // Three across, each a third (ppl-pub-bar-desktop draws a three-column grid).
  action: { flex: 1, paddingHorizontal: space.sm },
});
