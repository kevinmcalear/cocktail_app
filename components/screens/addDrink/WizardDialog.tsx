import { useEffect, useEffectEvent, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';

/** The web on a wide window (Add-beer, Web 1 of 7; Add-bottle, Web): an add wizard in a 600 dialog in the middle, over a scrim. Escape and the scrim close it as its X does. */
// ponytail: a route, not a ds Sheet, because Sheet's close asks "Discard changes?" and this asks Leave it for now (Kevin, 8 Nov); move it onto Sheet if Sheet learns to hand its close to its content.
export function WizardDialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ds = useDs();
  const escape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => escape(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
  return (
    <View style={[styles.scrim, { backgroundColor: ds.c.scrim }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" tabIndex={-1} />
      <View role="dialog" aria-modal aria-label={label} style={[styles.dialog, { backgroundColor: ds.c.ground, borderColor: ds.c.line }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dialog: { width: '100%', maxWidth: 600, height: '100%', maxHeight: 860, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
