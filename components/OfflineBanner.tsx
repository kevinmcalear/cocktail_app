import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, GlassSurface, useDs } from '@/components/ds';
import { Appear } from '@/components/ds/Appear';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, space, STATUS } from '@/constants/tokens';
import { useOnline } from '@/hooks/useOnline';
import { useUnsentWrites } from '@/hooks/useUnsentWrites';
import { readableAccent } from '@/lib/color';
import { waitingWords } from '@/lib/unsentWords';

/** A glass pill at the top while the device is offline: what's on screen is the saved copy, and how many changes wait to send. */
export function OfflineBanner() {
  // The query client's answer: no connection, or wifi with no internet (lib/react-query.ts).
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const ds = useDs();

  const isOffline = !online;
  const waiting = useUnsentWrites().filter((w) => !w.failed).length;

  if (!isOffline) return null;

  return (
    <Appear
      kind="slide"
      duration={400}
      // Centred, so it clears the floating back button on the left.
      style={[styles.layer, { top: Math.max(insets.top, space.sm) }]}
    >
      <GlassSurface>
        <View role="alert" aria-live="polite" style={styles.row}>
          <IconSymbol name="wifi.slash" size={16} color={readableAccent(STATUS.warning, ds.c.ground)} />
          <Caption style={styles.label}>{waiting ? `Offline · ${waitingWords(waiting)}` : 'Offline · showing saved data'}</Caption>
        </View>
      </GlassSurface>
    </Appear>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 9999, pointerEvents: 'none' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.md + 2 },
  label: { ...font.semiBold },
});
