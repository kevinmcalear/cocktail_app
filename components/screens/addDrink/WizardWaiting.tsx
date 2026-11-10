import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';

/** A create page while it learns where it's made (hooks/useBringInPlace useCreateBar): its ground and a spinner, a moment on a cold link. */
export function WizardWaiting() {
  const ds = useDs();
  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <ActivityIndicator color={ds.c.muted} aria-label="Opening" />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
