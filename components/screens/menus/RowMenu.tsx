import { useState, type ComponentRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Body, PressableScale, useDs, type IconName } from '@/components/ds';
import { STATUS } from '@/constants/palette';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { readableAccent } from '@/lib/color';

import { MenuSheet } from './MenuSheet';

export interface RowMenuItem {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** It opens more choices in place (a chevron says so). */
  more?: boolean;
  /** Can't be taken back without the toast's Undo, like Delete drink: drawn in red. */
  danger?: boolean;
}

/** Where the ... button sits in the window, to hang the menu under it. */
export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const WIDTH = 300;

/**
 * A builder row's ... menu. On the web, as the canvas draws it
 * (venue-menus-builder-desktop): a small floating panel under the button, its
 * right edge on the button's, that closes on a pick, a click outside or Escape.
 * On phones, the same choices in a sheet (MenuSheet), as the app's other phone menus are.
 */
export function RowMenu({ anchor, label, items, onClose }: { anchor: Anchor | null; label: string; items: RowMenuItem[]; onClose: () => void }) {
  if (Platform.OS !== 'web') return <RowMenuSheet open={!!anchor} label={label} items={items} onClose={onClose} />;
  return anchor ? <RowMenuPopover anchor={anchor} label={label} items={items} onClose={onClose} /> : null;
}

function RowMenuPopover({ anchor, label, items, onClose }: { anchor: Anchor; label: string; items: RowMenuItem[]; onClose: () => void }) {
  const ds = useDs();
  const { width: windowWidth } = useWindowDimensions();
  const right = Math.max(space.sm, windowWidth - (anchor.x + anchor.width));
  const left = Math.max(space.sm, windowWidth - right - WIDTH);
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close the menu" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View
        role="menu"
        aria-label={label}
        style={[
          styles.panel,
          { top: anchor.y + anchor.height + space.xs, left, backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong, shadowColor: ds.c.ground },
          // Unseen until the button's place is known, so it never flashes in the corner.
          anchor.height ? null : styles.unplaced,
        ]}
      >
        {items.map((it) => (
          <Item key={it.label} item={it} />
        ))}
      </View>
    </Modal>
  );
}

function RowMenuSheet({ open, label, items, onClose }: { open: boolean; label: string; items: RowMenuItem[]; onClose: () => void }) {
  // Mounted from its first open on, so it can slide away when closed; a row never opened carries no sheet.
  const [used, setUsed] = useState(false);
  if (open && !used) setUsed(true);
  if (!used) return null;
  return (
    <MenuSheet visible={open} onClose={onClose} title={label} plain>
      <View role="menu" aria-label={label}>
        {items.map((it) => (
          <Item key={it.label} item={it} inSheet />
        ))}
      </View>
    </MenuSheet>
  );
}

function Item({ item, inSheet }: { item: RowMenuItem; inSheet?: boolean }) {
  const ds = useDs();
  const tint = item.danger ? readableAccent(STATUS.danger, ds.c.raised) : undefined;
  return (
    <PressableScale role="menuitem" accessibilityLabel={item.label} onPress={item.onPress} style={[styles.item, inSheet && [styles.sheetItem, { borderBottomColor: ds.c.line }]]}>
      <IconSymbol name={item.icon} size={inSheet ? 20 : 16} color={tint ?? ds.c.muted} />
      <Body color={tint} style={styles.flex}>
        {item.label}
      </Body>
      {item.more ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
    </PressableScale>
  );
}

/** Open and close a RowMenu from a button: measure the button, then hang the menu under it. */
export function useRowMenu() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = (target: ComponentRef<typeof View> | null) => {
    // Open at once, then hang it under the button when the measure comes back.
    setAnchor({ x: 0, y: 0, width: 0, height: 0 });
    target?.measureInWindow((x: number, y: number, width: number, height: number) => setAnchor({ x, y, width, height }));
  };
  return { anchor, open, close: () => setAnchor(null) };
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    width: WIDTH,
    padding: space.xs + 2,
    borderRadius: radius.control + 4,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingHorizontal: space.md + 2, borderRadius: radius.control - 2 },
  // In a sheet: full-width rows with a hairline between, as the app's other phone menus (CreateSheet).
  sheetItem: { minHeight: 56, paddingHorizontal: 0, borderRadius: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  unplaced: { opacity: 0 },
});
