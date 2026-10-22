import { useState, type ComponentRef, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import { Appear } from './Appear';
import { PressableScale } from './PressableScale';
import { Body, Caption } from './Text';
import { useDs } from './theme';

/** Where the button that opens the menu sits in the window. */
export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PopoverItem {
  label: string;
  /** A quieter line under the label ("Every bar, bartender and classic"). */
  detail?: string;
  /** How many, in mono at the end ("Bottles 88"). */
  count?: number;
  /** The one picked: a check before the label. */
  checked?: boolean;
  onPress: () => void;
}

export interface PopoverSection {
  title?: string;
  items: PopoverItem[];
}

const WIDTH = 280;

/**
 * A pull-down menu, hung from the button that opened it with its
 * right edge on the button's, as iOS draws a toolbar menu (lib-filters-proposal,
 * search-starts-here, 22 Oct 2026). It opens downward, or upward from a button
 * in the bottom half (the search field's place). A pick, a tap outside or
 * Escape closes it.
 */
export function PopoverMenu({ anchor, label, sections, onClose }: { anchor: Anchor | null; label: string; sections: PopoverSection[]; onClose: () => void }) {
  const ds = useDs();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  if (!anchor) return null;
  // Its right edge on the button's, kept on screen.
  const left = Math.max(space.sm, Math.min(anchor.x + anchor.width - WIDTH, windowWidth - WIDTH - space.sm));
  const above = anchor.y > windowHeight / 2;
  // As tall as the room on its side of the button; longer menus scroll.
  const room = (above ? anchor.y : windowHeight - anchor.y - anchor.height) - space.sm - space.xl;
  const place = above ? { bottom: windowHeight - anchor.y + space.sm } : { top: anchor.y + anchor.height + space.sm };
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close the menu" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(ds.c.ground, 0.3) }]} onPress={onClose} />
      {/* Unseen until the button's place is known, so it never flashes in the corner. */}
      <Appear kind="fade" duration={140} style={[styles.panel, place, { left, shadowColor: ds.c.ground, maxHeight: room }, anchor.height ? null : styles.unplaced]}>
        <Panel>
          <ScrollView role="menu" aria-label={label} style={{ maxHeight: room }} bounces={false}>
            {sections.map((s, i) => (
              <View key={s.title ?? i} role="group" aria-label={s.title} style={i > 0 ? [styles.section, { borderTopColor: ds.c.lineStrong }] : null}>
                {s.title ? (
                  <Caption tone="muted" style={styles.title}>
                    {s.title}
                  </Caption>
                ) : null}
                {s.items.map((item) => (
                  <Row key={item.label} item={item} onClose={onClose} />
                ))}
              </View>
            ))}
          </ScrollView>
        </Panel>
      </Appear>
    </Modal>
  );
}

/**
 * The menu's surface: solid, raised. Glass can't frost here: the menu sits in
 * a Modal, its own layer, so iOS's glass has nothing behind it and draws
 * clear, and the web's blur keeps its own thin fill.
 */
function Panel({ children }: { children: ReactNode }) {
  const ds = useDs();
  return <View style={[styles.glass, styles.solid, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>{children}</View>;
}

function Row({ item, onClose }: { item: PopoverItem; onClose: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="menuitem"
      aria-checked={!!item.checked}
      // RN has no menuitemradio role, so the label says which one is picked.
      accessibilityLabel={[item.label, item.count, item.checked ? 'picked' : null].filter((w) => w != null).join(', ')}
      onPress={() => {
        onClose();
        item.onPress();
      }}
      style={styles.row}
    >
      <View style={styles.tick}>{item.checked ? <IconSymbol name="checkmark" size={16} color={ds.c.ink} /> : null}</View>
      <View style={styles.flex}>
        <Body>{item.label}</Body>
        {item.detail ? <Caption tone="muted">{item.detail}</Caption> : null}
      </View>
      {item.count == null ? null : (
        <Body color={ds.c.muted} style={styles.count}>
          {item.count}
        </Body>
      )}
    </PressableScale>
  );
}

/** Open and close a PopoverMenu from a button: measure the button, then hang the menu from it. */
export function usePopover() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = (target: ComponentRef<typeof View> | null) => {
    // Open at once, unseen, then place it when the measure comes back. The menu
    // takes the focus, so a keyboard that's up goes down first and the button
    // (a search field's place token) moves with it: measure once it has.
    // ponytail: a fixed wait for the keyboard; listen for keyboardDidHide if it ever lands early.
    const web = Platform.OS === 'web' && typeof document !== 'undefined';
    const typing = web ? document.activeElement instanceof HTMLInputElement : Keyboard.isVisible();
    if (web && typing) (document.activeElement as HTMLElement).blur();
    else Keyboard.dismiss();
    setAnchor({ x: 0, y: 0, width: 0, height: 0 });
    // Only while it's still open: a tap outside during the wait has closed it.
    const measure = () => target?.measureInWindow((x: number, y: number, width: number, height: number) => setAnchor((was) => (was ? { x, y, width, height } : null)));
    if (typing) setTimeout(measure, 320);
    else measure();
  };
  return { anchor, open, close: () => setAnchor(null) };
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', width: WIDTH, shadowOffset: { width: 0, height: 18 }, shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0.5, shadowRadius: 24 },
  glass: { borderRadius: radius.card, paddingVertical: space.xs, overflow: 'hidden' },
  solid: { borderWidth: 1 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.xs, paddingTop: space.xs },
  // Lines up with the labels, past the check's column.
  title: { paddingLeft: space.md + 20 + space.sm, paddingTop: space.xs, paddingBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, paddingLeft: space.md, paddingRight: space.lg, paddingVertical: space.xs },
  tick: { width: 20, alignItems: 'center' },
  flex: { flex: 1 },
  count: { fontFamily: fontFamilies.mono },
  unplaced: { opacity: 0 },
});
