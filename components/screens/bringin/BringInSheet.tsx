import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet, sheetIsDialog } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBringIn } from '@/store/useBringIn';

import { BringInChooser } from './BringInChooser';

/** Bring in as a sheet over whatever you were on (a dialog on the web). Any screen opens it with useBringIn().openSheet. */
export function BringInSheet() {
  const insets = useSafeAreaInsets();
  const open = useBringIn((s) => s.sheet);
  const close = useBringIn((s) => s.closeSheet);
  return (
    <Sheet visible={open} onClose={close} accessibilityLabel="Bring in" keyboard>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        {open ? <BringInChooser /> : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // A dialog on the web has the scrim's margin around it already.
  body: { paddingHorizontal: sheetIsDialog ? space.lg : space.xl - 4, paddingTop: sheetIsDialog ? space.xl : space.md },
});
