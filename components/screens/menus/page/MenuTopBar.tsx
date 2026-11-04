import { StyleSheet, View } from 'react-native';

import type { StyleProp, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Caption, GlassButton, PressableScale } from '@/components/ds';
import { ItemMoreMenu } from '@/components/screens/drink/ItemMoreMenu';
import { font, space } from '@/constants/tokens';

/** Share and Edit sit in the page's one …, never beside it (Kevin's C12, 3 Nov: "All into the dot menu"). */
export interface MenuBarTools {
  onShare: (() => void) | null;
  onEdit?: (() => void) | null;
  /** A home menu's …: its own sheet, with Edit, Share and the rest. */
  onMore?: (() => void) | null;
}

interface MenuTopBarProps extends MenuBarTools {
  /** The menu's name, for the …'s Edit row. */
  name: string;
  onBack: (() => void) | null;
  /** In Back's place on a page with no way back (a friend's shared menu): it goes home. */
  label?: { text: string; onPress: () => void };
  /** Glass over a dark cover photo. */
  onMedia?: boolean;
  top: number;
  /** Between Back and the …: the pinned bar's collapsed title (MenuPinnedBar). */
  children?: ReactNode;
  /** The pinned bar's side margin and backing. */
  wrap?: StyleProp<ViewStyle>;
}

/**
 * A menu page's top bar: glass Back on the left, the one … (Edit, Share) on the right
 * (Menu-page). On a phone it stays put while the page scrolls under it
 * (Kevin, 3 Nov: Back on every pushed page, expanded and collapsed, as the
 * item pages do, #1164); scrolled past the hero it takes a backing and the
 * menu's name.
 */
export function MenuTopBar({ name, onBack, label, onShare, onEdit, onMore, onMedia, top, children, wrap }: MenuTopBarProps) {
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: top + space.lg }, wrap]}>
      {onBack ? (
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={onBack} onMedia={onMedia} />
      ) : label ? (
        <PressableScale role="link" accessibilityLabel={label.text} onPress={label.onPress}>
          <Caption tone="muted" style={styles.caps}>
            {label.text.toUpperCase()}
          </Caption>
        </PressableScale>
      ) : (
        <View />
      )}
      <View style={styles.title} pointerEvents="none">{children}</View>
      {onMore ? (
        <GlassButton icon="ellipsis" accessibilityLabel="More" onPress={onMore} onMedia={onMedia} />
      ) : (
        <ItemMoreMenu name={name} onEdit={onEdit ?? undefined} editLabel={`Edit ${name}`} onShare={onShare ?? undefined} scheme={onMedia ? 'dark' : undefined} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { flex: 1, minWidth: 0 },
  caps: { letterSpacing: 1.2, ...font.medium },
});
