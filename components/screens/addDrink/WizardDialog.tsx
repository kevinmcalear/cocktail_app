import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { Sheet } from '@/components/ds';

/**
 * The web on a wide window (Add-beer, Web 1 of 7; Add-bottle, Web; Add-entry,
 * Web): an add wizard in a 600 dialog in the middle of the window, over the
 * page it was opened from with the sidebar dimmed. A ds Sheet, so it sits
 * over the whole window; its route is see-through (app/_layout.tsx) and the
 * tab under it keeps showing (MountOnFocus). Escape, the backdrop and a drag
 * close it as its X does, through the wizard (Leave it for now, Discard changes).
 */
export function WizardDialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <Sheet visible accessibilityLabel={label} onClose={onClose} askClose={onClose} ground style={styles.dialog}>
      {children}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  dialog: { maxWidth: 600, height: '100%', maxHeight: 860 },
});
