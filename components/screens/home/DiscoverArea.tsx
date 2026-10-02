import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, Chip, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useBarCities } from '@/hooks/useDiscover';
import type { NearMe } from '@/hooks/useNearMe';
import type { Area } from '@/lib/nearMe';

/** A sideways row of chips. `title` is the heading above it ("By spirit"). */
export function ChipRow({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {title ? (
        <Caption tone="muted">{title}</Caption>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <View role="radiogroup" accessibilityLabel={label} style={styles.chips}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const cityKey = (c: { city: string; country_code: string }) => `${c.city}|${c.country_code}`;

/**
 * "Where": near me and anywhere sit at the left of the city chips. The pin
 * asks for location; if that's refused, the area stays put and a line says
 * to pick a city.
 */
export function DiscoverArea({
  area,
  onChange,
  near,
  preferNear,
  onNearMe,
}: {
  area: Area;
  onChange: (area: Area) => void;
  near: NearMe;
  /** Pin stays on while the first locate is still in flight. */
  preferNear: boolean;
  onNearMe: () => void;
}) {
  const ds = useDs();
  const { data: cities } = useBarCities();
  const pinOn = (area.kind === 'point' && area.source === 'me') || (preferNear && area.kind === 'anywhere');

  const note =
    near.status === 'locating'
      ? 'Finding where you are…'
      : near.status === 'denied'
        ? "Location is off for Cocktail, so pick a city instead. You can turn it on in your device's settings."
        : near.status === 'unavailable'
          ? "Couldn't find where you are. Pick a city instead, or try again."
          : null;

  const citiesRow = cities?.map((c) => (
    <Chip
      key={cityKey(c)}
      quiet
      label={c.label}
      selected={area.kind === 'city' && cityKey(area) === cityKey(c)}
      onPress={() => onChange({ kind: 'city', city: c.city, country_code: c.country_code, label: c.label })}
    />
  ));

  return (
    <View style={styles.section}>
      <View role="radiogroup" accessibilityLabel="Where" style={styles.where}>
        <View style={styles.lead}>
          <PressableScale
            role="radio"
            aria-checked={pinOn}
            accessibilityLabel="Near me"
            onPress={onNearMe}
            style={[styles.pin, { backgroundColor: pinOn ? ds.c.ink : ds.c.raised }]}
          >
            <IconSymbol name="mappin.and.ellipse" size={18} color={pinOn ? ds.c.ground : ds.c.ink} />
          </PressableScale>
          <Chip label="Anywhere" selected={area.kind === 'anywhere' && !pinOn} onPress={() => onChange({ kind: 'anywhere' })} />
          {area.kind === 'point' && area.source === 'map' ? <Chip label="This area" selected onPress={() => {}} /> : null}
        </View>
        {citiesRow?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cities} contentContainerStyle={styles.chips}>
            {citiesRow}
          </ScrollView>
        ) : null}
      </View>
      {note ? (
        <Caption tone="muted" role="status">
          {note}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  group: { gap: space.sm },
  where: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  lead: { flexDirection: 'row', gap: space.sm, alignItems: 'center', flexShrink: 0 },
  cities: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  chips: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  pin: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
