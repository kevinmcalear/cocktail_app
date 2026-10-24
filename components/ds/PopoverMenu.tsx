import { useEffect, useState, type ComponentRef, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import { Appear } from './Appear';
import { GlassSurface } from './Glass';
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
  /** A picture before the label: a venue's mark in the venue menu's Switch. */
  leading?: ReactNode;
  onPress: () => void;
}

export interface PopoverSection {
  title?: string;
  items: PopoverItem[];
}

const WIDTH = 280;

/**
 * A pull-down menu in glass, hung from the button that opened it with its
 * right edge on the button's, as iOS draws a toolbar menu (lib-filters-proposal,
 * search-starts-here, 22 Oct 2026). It opens downward, or upward from a button
 * in the bottom half (the search field's place). A pick, a tap outside or
 * Escape closes it.
 */
export function PopoverMenu({ anchor, label, sections, onClose, footer }: { anchor: Anchor | null; label: string; sections: PopoverSection[]; onClose: () => void; footer?: ReactNode }) {
  const ds = useDs();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Web: Escape closes only the menu, not the card or palette it hangs over (they close on keydown, ahead of the Modal's keyup).
  const open = !!anchor;
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);
  if (!anchor) return null;
  // Its right edge on the button's, kept on screen.
  const left = Math.max(space.sm, Math.min(anchor.x + anchor.width - WIDTH, windowWidth - WIDTH - space.sm));
  const above = anchor.y > windowHeight / 2;
  // As tall as the room on its side of the button; longer menus scroll.
  const room = (above ? anchor.y : windowHeight - anchor.y - anchor.height) - space.sm - space.xl;
  const place = above ? { bottom: windowHeight - anchor.y + space.sm } : { top: anchor.y + anchor.height + space.sm };
  const panel = (
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
        {/* A line under the rows, such as the palette's "tab moves to the next place". */}
        {footer ? <View style={[styles.section, styles.footer, { borderTopColor: ds.c.lineStrong }]}>{footer}</View> : null}
      </ScrollView>
    </Panel>
  );
  const frame = [styles.panel, place, { left, shadowColor: ds.c.ground, maxHeight: room }];
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close the menu" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(ds.c.ground, 0.3) }]} onPress={onClose} />
      {/* Drawn once the button's place is known, so it never flashes in the corner. Glass sees
          nothing through a parent that fades (iOS's draws clear, the web's blur stops there), so
          only Android's solid panel fades in. */}
      {!anchor.height ? null : Platform.OS === 'android' ? (
        <Appear kind="fade" duration={140} style={frame}>
          {panel}
        </Appear>
      ) : (
        <View style={frame}>{panel}</View>
      )}
    </Modal>
  );
}

/**
 * The menu's surface: glass where it can be. iOS's real glass; on the web a
 * tinted panel with the browser's backdrop blur (expo-blur's web view keeps
 * its own thin fill, too faint for rows); a solid raised panel on Android,
 * as all of the app's glass is there.
 */
function Panel({ children }: { children: ReactNode }) {
  const ds = useDs();
  if (Platform.OS === 'ios') return <GlassSurface style={styles.glass}>{children}</GlassSurface>;
  const web = Platform.OS === 'web' ? [{ backgroundColor: withAlpha(ds.c.raised, 0.86) }, WEB_BLUR] : { backgroundColor: ds.c.raised };
  return <View style={[styles.glass, styles.solid, { borderColor: ds.c.lineStrong }, web]}>{children}</View>;
}

// ponytail: React Native's types don't list backdropFilter; react-native-web passes it to CSS.
const WEB_BLUR = { backdropFilter: 'blur(24px) saturate(1.6)' } as Record<never, never>;

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
      {item.leading}
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
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs },
  // Lines up with the labels, past the check's column.
  title: { paddingLeft: space.md + 20 + space.sm, paddingTop: space.xs, paddingBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, paddingLeft: space.md, paddingRight: space.lg, paddingVertical: space.xs },
  tick: { width: 20, alignItems: 'center' },
  flex: { flex: 1 },
  count: { fontFamily: fontFamilies.mono },
});
