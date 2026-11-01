import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';

import { AddFabMenu, type FabFrame } from './AddFabMenu';
import { AddSheet } from './AddSheet';
import { CreateSheet } from './CreateSheet';

const LABEL = 'Add: name a drink, paste a link, describe it, or snap a menu, bottle or recipe';

/**
 * Add over the page you're on, and from its last row the New sheet (a
 * bottle, beer, wine, a house-made or a menu). `onClose` once both have gone.
 */
export function AddSheets({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<'add' | 'more'>('add');
  const [shown, setShown] = useState(true);
  // The second sheet waits for the first to have gone.
  const more = () => {
    setShown(false);
    setTimeout(() => {
      setOpen('more');
      setShown(true);
    }, 350);
  };
  if (!shown) return null;
  return open === 'add' ? <AddSheet visible onClose={onClose} onMore={more} /> : <CreateSheet visible onClose={onClose} />;
}

/** Add's sheets, opened by a button. Android's FAB opens its FAB menu first (AddFab). */
function useAdd() {
  const [open, setOpen] = useState(false);
  return { open: () => setOpen(true), sheet: open ? <AddSheets onClose={() => setOpen(false)} /> : null };
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
 * first page, over the bottom bar (approved 31 Oct 2026). It opens the FAB
 * menu (AddFabMenu), whose Type a drink opens the Add sheet.
 */
export function AddFab() {
  const ds = useDs();
  const add = useAdd();
  const window = useWindowDimensions();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [menu, setMenu] = useState<FabFrame | null>(null);
  const openMenu = () =>
    ref.current?.measureInWindow((x: number, y: number, w: number, h: number) => setMenu({ right: window.width - x - w, bottom: window.height - y - h }));
  return (
    <>
      <View ref={ref} style={styles.fabSpot}>
        <PressableScale role="button" aria-expanded={!!menu} accessibilityLabel={LABEL} onPress={openMenu} style={[styles.fab, { backgroundColor: ds.accentFill.fill }]}>
          <IconSymbol name="plus" size={20} color={ds.accentFill.text} />
          <DsText color={ds.accentFill.text} style={styles.fabLabel}>
            Add
          </DsText>
        </PressableScale>
      </View>
      {menu ? (
        <AddFabMenu
          frame={menu}
          onClose={() => setMenu(null)}
          onType={() => {
            setMenu(null);
            add.open();
          }}
        />
      ) : null}
      {add.sheet}
    </>
  );
}

const SIZE = 32;
const styles = StyleSheet.create({
  circle: { width: SIZE, height: SIZE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  // Material 3's extended FAB: 56 tall, 16 in from the edges, a level-3 shadow.
  fabSpot: { position: 'absolute', right: space.lg, bottom: space.lg },
  fab: { height: 56, paddingHorizontal: space.lg, borderRadius: radius.control + 4, flexDirection: 'row', alignItems: 'center', gap: space.sm, elevation: 3 },
  fabLabel: { ...font.semiBold },
});
