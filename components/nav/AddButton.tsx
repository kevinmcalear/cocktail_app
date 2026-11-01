import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, ExtendedFab, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius } from '@/constants/tokens';

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
 * A desktop's Add (from 1200): "+ Add", a small pill in the venue's accent, at
 * the top right where a phone has its + (board Prod-desk-today, 2027 canvas).
 * The tablet's rail keeps New in the nav.
 */
export function DeskAddButton() {
  const add = useAdd();
  return (
    <>
      <Button label="Add" icon="plus" size="sm" accessibilityLabel={LABEL} onPress={add.open} />
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
  const add = useAdd();
  return (
    <>
      <ExtendedFab label="Add" icon="plus" accessibilityLabel={LABEL} onPress={add.open} />
      {add.sheet}
    </>
  );
}

const SIZE = 32;
const styles = StyleSheet.create({
  circle: { width: SIZE, height: SIZE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
