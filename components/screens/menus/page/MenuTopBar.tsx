import { StyleSheet, View } from 'react-native';

import { Caption, DsText, GlassButton, PressableScale, useDs } from '@/components/ds';
import { ItemMoreMenu } from '@/components/screens/drink/ItemMoreMenu';
import { displayFaces, font, space } from '@/constants/tokens';

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
  /** Scrolled past the top (the collapsed header): the bar gets the page's ground and the menu's name beside Back. */
  collapsed?: { title: string } | null;
  top: number;
  /** Pinned over a page: the page's side margin, so the backing runs to the screen's edges. */
  gutter?: number;
}

/**
 * A menu page's top bar: glass Back on the left, the one … (Edit, Share) on the right
 * (Menu-page). On a phone it stays put while the page scrolls under it
 * (Kevin, 3 Nov: Back on every pushed page, expanded and collapsed, as the
 * item pages do, #1164); scrolled past the hero it takes a backing and the
 * menu's name.
 */
export function MenuTopBar({ name, onBack, label, onShare, onEdit, onMore, onMedia, collapsed, top, gutter = 0 }: MenuTopBarProps) {
  const ds = useDs();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: top + space.lg, paddingHorizontal: gutter }, collapsed ? [styles.backed, { backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }] : null]}>
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
      <View style={styles.title} pointerEvents="none">
        {collapsed ? (
          <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
            {collapsed.title}
          </DsText>
        ) : null}
      </View>
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
  backed: { paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, minWidth: 0 },
  caps: { letterSpacing: 1.2, ...font.medium },
});
