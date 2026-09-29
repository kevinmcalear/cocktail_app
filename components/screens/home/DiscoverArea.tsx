import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, Chip } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarCities } from '@/hooks/useDiscover';
import { useNearMe } from '@/hooks/useNearMe';
import { NEAR_ME_KM, type Area } from '@/lib/nearMe';

/** A row of chips that scrolls sideways instead of wrapping. */
export function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <View role="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {children}
      </View>
    </ScrollView>
  );
}

const cityKey = (c: { city: string; country_code: string }) => `${c.city}|${c.country_code}`;

/**
 * "Where": near me, anywhere, or a city with public bars. Near me asks for
 * location only when tapped; if that's refused or fails, the area stays as it
 * was and a line says to pick a city instead.
 */
export function DiscoverArea({ area, onChange }: { area: Area; onChange: (area: Area) => void }) {
  const { data: cities } = useBarCities();
  const { state, locate } = useNearMe();

  const nearMe = async () => {
    const found = await locate();
    if (found.status === 'ready') {
      onChange({ kind: 'point', latitude: found.latitude, longitude: found.longitude, radiusKm: NEAR_ME_KM, source: 'me' });
    }
  };

  const note =
    state.status === 'locating'
      ? 'Finding where you are…'
      : state.status === 'denied'
        ? "Location is off for Cocktail, so pick a city instead. You can turn it on in your device's settings."
        : state.status === 'unavailable'
          ? "Couldn't find where you are. Pick a city instead, or try again."
          : null;

  return (
    <View style={styles.section}>
      <ChipRow label="Where">
        <Chip label="Near me" selected={area.kind === 'point' && area.source === 'me'} onPress={() => void nearMe()} />
        <Chip label="Anywhere" selected={area.kind === 'anywhere'} onPress={() => onChange({ kind: 'anywhere' })} />
        {area.kind === 'point' && area.source === 'map' ? <Chip label="This area" selected onPress={() => {}} /> : null}
        {(cities ?? []).map((c) => (
          <Chip
            key={cityKey(c)}
            label={c.label}
            selected={area.kind === 'city' && cityKey(area) === cityKey(c)}
            onPress={() => onChange({ kind: 'city', city: c.city, country_code: c.country_code, label: c.label })}
          />
        ))}
      </ChipRow>
      {note ? (
        <Caption tone="muted" role="status">
          {note}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  chips: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
