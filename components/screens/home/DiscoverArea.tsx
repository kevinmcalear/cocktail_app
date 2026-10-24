import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ds';
import type { NearMe } from '@/hooks/useNearMe';
import type { LocationAccess } from '@/lib/deviceLocation';

/** Why near me didn't stick, when it didn't. `usingLast`: no fresh position, so near me is near the last place. */
export function areaStatus(near: NearMe, usingLast = false): string | null {
  if (near.status === 'locating') return 'Finding where you are…';
  if (near.status === 'unavailable' && usingLast) return "Couldn't get a fresh position, so this is near where you were last.";
  if (near.status === 'denied' && Platform.OS === 'web') {
    return "Location is off for this site, so pick a city instead. To turn it on, allow location in your browser's settings for this site (Safari on iPhone: the aA button, then Website Settings, then Location), then tap Near me.";
  }
  if (near.status === 'denied') return 'Location is off for Cocktail, so pick a city instead, or allow location to see where you are.';
  if (near.status === 'unavailable') return "Couldn't find where you are. Pick a city instead, or try again.";
  return null;
}

/**
 * Under a "location is off" note: asks again while the device still can, else
 * opens Cocktail's page in Settings (iOS and Android never ask twice). On the
 * web a blocked site can only be changed in the browser, as the note says.
 */
export function AllowLocation({ near, access, onAsk }: { near: NearMe; access: LocationAccess | null; onAsk: () => void }) {
  if (near.status !== 'denied') return null;
  const settings = access === 'blocked';
  if (settings && Platform.OS === 'web') return null;
  return (
    <View style={styles.allow}>
      <Button label="Allow location" icon="location" variant="secondary" onPress={settings ? () => void Linking.openSettings() : onAsk} />
    </View>
  );
}

const styles = StyleSheet.create({
  allow: { alignItems: 'flex-start' },
});
