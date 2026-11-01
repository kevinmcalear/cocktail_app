import { Suspense, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space, STATUS } from '@/constants/tokens';
import { mix, withAlpha } from '@/lib/color';

import type { FabFrame } from './AddFabMenu';
import type { Frame } from './AddSheet';
import { AddFabMenu, AddSheet, CreateSheet } from './addLayers';

const LABEL = 'Add: name a drink, paste a link, describe it, or snap a menu, bottle or recipe';

/**
 * Add over the page you're on, and from its last row the New sheet (a
 * bottle, beer, wine, a house-made or a menu). `onClose` once both have gone.
 */
export function AddSheets({ onClose, listen, from }: { onClose: () => void; listen?: boolean; from?: Frame | null }) {
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
  return <Suspense fallback={null}>{open === 'add' ? <AddSheet visible onClose={onClose} onMore={more} listen={listen} from={open === 'add' ? from : null} /> : <CreateSheet visible onClose={onClose} />}</Suspense>;
}

/** Add's sheets, opened by a button. Android's FAB opens its FAB menu first (AddFab). */
function useAdd() {
  const [open, setOpen] = useState<{ say: boolean; from: Frame | null } | null>(null);
  return {
    open: (say = false, from: Frame | null = null) => setOpen({ say, from }),
    sheet: open ? <AddSheets onClose={() => setOpen(null)} listen={open.say} from={open.from} /> : null,
  };
}

/** The + at the top right of a tab's first page on iOS and phone-width web: a filled circle in the venue's accent. */
export function AddButton() {
  const ds = useDs();
  const add = useAdd();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [pressed, setPressed] = useState(false);
  // Add grows out of the + (Prod-motion-sheet): where the + is, then open.
  const open = () => {
    const el = ref.current;
    if (!el) return add.open();
    el.measureInWindow((x: number, y: number, width: number, height: number) => add.open(false, { x, y, width, height }));
  };
  return (
    <>
      <View ref={ref}>
        {/* Prod-motion-sheet step 1: an amber ring while it's pressed. */}
        {pressed ? <View style={[styles.ring, { backgroundColor: withAlpha(STATUS.warning, ds.scheme === 'dark' ? 0.16 : 0.3) }]} /> : null}
        <PressableScale
          role="button"
          accessibilityLabel={LABEL}
          onPress={open}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          hitSlop={(layout.minTapTarget - SIZE) / 2}
          style={[styles.circle, { backgroundColor: ds.accentFill.fill }]}
        >
          <IconSymbol name="plus" size={18} color={ds.accentFill.text} />
        </PressableScale>
      </View>
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
      <Button label="Add" icon="plus" size="sm" accessibilityLabel={LABEL} onPress={() => add.open()} />
      {add.sheet}
    </>
  );
}

/**
 * Android's Add: a plain Material 3 FAB, just the +, at the bottom right of a
 * tab's first page, over the bottom bar (Kevin's pick, android-add-fab; board
 * Prod-and). It opens the FAB menu (AddFabMenu), whose Type a drink opens the Add sheet.
 */
export function AddFab() {
  const ds = useDs();
  const add = useAdd();
  const window = useWindowDimensions();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [menu, setMenu] = useState<FabFrame | null>(null);
  // The menu's tonal colour, solid over the page: our palette in Material's roles.
  const tonal = mix(ds.accentFill.fill, ds.c.ground, ds.scheme === 'dark' ? 0.68 : 0.72);
  const openMenu = () =>
    ref.current?.measureInWindow((x: number, y: number, w: number, h: number) => setMenu({ right: window.width - x - w, bottom: window.height - y - h }));
  return (
    <>
      <View ref={ref} style={styles.fabSpot}>
        <PressableScale role="button" aria-expanded={!!menu} accessibilityLabel={LABEL} onPress={openMenu} style={[styles.fab, { backgroundColor: tonal }]}>
          <IconSymbol name="plus" size={24} color={ds.c.ink} />
        </PressableScale>
      </View>
      {menu ? (
        <Suspense fallback={null}>
          <AddFabMenu
            frame={menu}
            onClose={() => setMenu(null)}
            onType={() => {
              setMenu(null);
              add.open();
            }}
            onSay={() => {
              setMenu(null);
              add.open(true);
            }}
          />
        </Suspense>
      ) : null}
      {add.sheet}
    </>
  );
}

const SIZE = 32;
const RING = 6;
const styles = StyleSheet.create({
  circle: { width: SIZE, height: SIZE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: -RING, right: -RING, bottom: -RING, left: -RING, borderRadius: radius.pill },
  // Material 3's FAB: 56 square, corners of 16, 16 in from the edges, a level-3 shadow.
  fabSpot: { position: 'absolute', right: space.lg, bottom: space.lg },
  fab: { width: 56, height: 56, borderRadius: radius.control + 4, alignItems: 'center', justifyContent: 'center', elevation: 3 },
});
