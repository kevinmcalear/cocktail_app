import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { withAlpha } from '@/lib/color';

import { useDs } from './theme';

/** Under a glass dock at the bottom (search's field, Library's filters): the list fades into the ground, so the glass reads over busy rows. */
export function DockFade() {
  const ds = useDs();
  return <LinearGradient colors={[withAlpha(ds.c.ground, 0), withAlpha(ds.c.ground, 0.85), ds.c.ground]} locations={[0, 0.5, 1]} style={styles.fade} />;
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
});
