import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { NearMe } from '@/hooks/useNearMe';

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

/** Why near me didn't stick, when it didn't. */
export function areaStatus(near: NearMe): string | null {
  if (near.status === 'locating') return 'Finding where you are…';
  if (near.status === 'denied') return "Location is off for Cocktail, so pick a city instead. You can turn it on in your device's settings.";
  if (near.status === 'unavailable') return "Couldn't find where you are. Pick a city instead, or try again.";
  return null;
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  chips: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
