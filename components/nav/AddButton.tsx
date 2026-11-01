import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';

import { CreateSheet } from './CreateSheet';

const LABEL = 'Add: a drink, a bottle, something you make, beer, wine, a menu, or bring something in';

/** Add opens the New sheet over the page you're on (it stands in for the Add sheet the Add lane draws). */
function useAdd() {
  const [open, setOpen] = useState(false);
  const sheet = open ? <CreateSheet visible onClose={() => setOpen(false)} /> : null;
  return { open: () => setOpen(true), sheet };
}

/** The + at the top right of a tab's first page on iOS and phone-width web: a filled circle in the venue's accent. */
export function AddButton() {
  const ds = useDs();
  const add = useAdd();
  return (
    <>
      <PressableScale role="button" accessibilityLabel={LABEL} onPress={add.open} hitSlop={(layout.minTapTarget - SIZE) / 2} style={[styles.circle, { backgroundColor: ds.accentFill.fill }]}>
        <IconSymbol name="plus" size={18} color={ds.accentFill.text} />
      </PressableScale>
      {add.sheet}
    </>
  );
}

/**
 * Android's Add: a Material 3 extended FAB at the bottom right of a tab's
 * first page, over the bottom bar (approved 31 Oct 2026). It opens the New
 * sheet until the Add lane draws its FAB menu.
 */
export function AddFab() {
  const ds = useDs();
  const add = useAdd();
  return (
    <>
      <PressableScale role="button" accessibilityLabel={LABEL} onPress={add.open} style={[styles.fab, { backgroundColor: ds.accentFill.fill }]}>
        <IconSymbol name="plus" size={20} color={ds.accentFill.text} />
        <DsText color={ds.accentFill.text} style={styles.fabLabel}>
          Add
        </DsText>
      </PressableScale>
      {add.sheet}
    </>
  );
}

const SIZE = 32;
const styles = StyleSheet.create({
  circle: { width: SIZE, height: SIZE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  // Material 3's extended FAB: 56 tall, 16 in from the edges, a level-3 shadow.
  fab: { position: 'absolute', right: space.lg, bottom: space.lg, height: 56, paddingHorizontal: space.lg, borderRadius: radius.control + 4, flexDirection: 'row', alignItems: 'center', gap: space.sm, elevation: 3 },
  fabLabel: { ...font.semiBold },
});
