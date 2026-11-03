import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ds';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useBackBarShown } from '@/hooks/useVenueFeatures';

/**
 * The way into the back bar map on phones (from Prep). Wide web has it in the
 * sidebar, as in the brief, so this renders nothing there, nor while the
 * back bar is parked (lib/backBar.ts) or switched off (lib/venueFeatures.ts).
 */
export function BackBarLink() {
  const router = useRouter();
  const wide = useIsWideWeb();
  const shown = useBackBarShown();
  if (wide || !shown) return null;
  return <Button label="Back bar" icon="place.backbar" variant="secondary" onPress={() => router.push('/back-bar' as never)} style={styles.link} />;
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start' },
});
