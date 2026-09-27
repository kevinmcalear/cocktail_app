import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ds';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

/**
 * The way into the back bar map on phones (from Prep). Wide web has it in the
 * sidebar, as in the brief, so this renders nothing there.
 */
export function BackBarLink() {
  const router = useRouter();
  if (useIsWideWeb()) return null;
  return <Button label="Back bar" icon="map.fill" variant="secondary" onPress={() => router.push('/back-bar' as never)} style={styles.link} />;
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start' },
});
