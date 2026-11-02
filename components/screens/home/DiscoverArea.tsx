import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Caption, TextLink } from '@/components/ds';
import type { NearMe } from '@/hooks/useNearMe';
import { space } from '@/constants/tokens';

/** Why near me didn't stick, when it didn't. `usingLast`: no fresh position, so near me is near the last place. */
export function areaStatus(near: NearMe, usingLast = false): string | null {
  if (near.status === 'locating') return 'Finding where you are…';
  if (near.status === 'unavailable' && usingLast) return "Couldn't get a fresh position, so this is near where you were last.";
  if (near.status === 'unavailable') return "Couldn't find where you are. Pick a city instead, or try again.";
  if (near.status === 'denied') return Platform.OS === 'web' ? 'Location is off for this site. Allow it in your browser’s settings, or pick a city.' : 'Location is off for Cocktail. Turn it on in Settings, or pick a city.';
  return null;
}

/** That line under Discover's head. iOS and Android never ask twice, so a "no" gets the way to Settings. */
export function AreaNote({ note, off }: { note: string | null; off: boolean }) {
  if (!note) return null;
  return (
    <View style={styles.note}>
      <Caption tone="muted">{note}</Caption>
      {off && Platform.OS !== 'web' ? <TextLink label="Open Settings" onPress={() => void Linking.openSettings()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { gap: space.xs, alignItems: 'flex-start' },
});
