import { useState, type ComponentRef } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Body, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';

export interface RowMenuItem {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** It opens more choices in place (a chevron says so). */
  more?: boolean;
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
 * A builder row's ... menu as the canvas draws it (venue-menus-builder-desktop):
 * a small floating panel under the button, its right edge on the button's,
 * that closes on a pick, a tap outside or Escape.
 */
export function RowMenu({ anchor, label, items, onClose }: { anchor: Anchor | null; label: string; items: RowMenuItem[]; onClose: () => void }) {
  const ds = useDs();
  const { width: windowWidth } = useWindowDimensions();
  if (!anchor) return null;
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
          <PressableScale key={it.label} role="menuitem" accessibilityLabel={it.label} onPress={it.onPress} style={styles.item}>
            <IconSymbol name={it.icon} size={16} color={ds.c.muted} />
            <Body style={styles.flex}>
              {it.label}
            </Body>
            {it.more ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
          </PressableScale>
        ))}
      </View>
    </Modal>
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
  flex: { flex: 1 },
  unplaced: { opacity: 0 },
});
