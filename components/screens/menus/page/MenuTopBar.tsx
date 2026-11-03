import { StyleSheet, View } from 'react-native';

import { Caption, DsText, GlassButton, PressableScale, useDs } from '@/components/ds';
import { displayFaces, font, radius, space } from '@/constants/tokens';

export interface MenuBarTools {
  onShare: (() => void) | null;
  /** A glass pencil, when Edit isn't the page's one action (a draft, a home menu). */
  onEdit?: (() => void) | null;
  /** The one prominent action at the top: Edit, or Share on a home menu. */
  pill: { label: string; onPress: () => void } | null;
}

interface MenuTopBarProps extends MenuBarTools {
  onBack: (() => void) | null;
  /** In Back's place on a page with no way back (a friend's shared menu): it goes home. */
  label?: { text: string; onPress: () => void };
  /** Glass over a dark cover photo. */
  onMedia?: boolean;
  /** Scrolled past the top (the collapsed header): the bar gets the page's ground and the menu's name beside Back. */
  collapsed?: { title: string } | null;
  top: number;
}

/**
 * A menu page's top bar: glass Back on the left, Share and Edit on the right
 * (Menu-page). On a phone it stays put while the page scrolls under it
 * (Kevin, 3 Nov: Back on every pushed page, expanded and collapsed, as the
 * item pages do, #1164); scrolled past the hero it takes a backing and the
 * menu's name.
 */
export function MenuTopBar({ onBack, label, onShare, onEdit, pill, onMedia, collapsed, top }: MenuTopBarProps) {
  const ds = useDs();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: top + space.lg }, collapsed ? [styles.backed, { backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }] : null]}>
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
      <View style={styles.end}>
        {onEdit ? <GlassButton icon="pencil" accessibilityLabel="Edit" onPress={onEdit} onMedia={onMedia} /> : null}
        {onShare ? <GlassButton icon="square.and.arrow.up" accessibilityLabel="Share" onPress={onShare} onMedia={onMedia} /> : null}
        {pill ? (
          <PressableScale role="button" accessibilityLabel={pill.label} onPress={pill.onPress} style={[styles.pill, { backgroundColor: ds.c.ink }]}>
            <DsText variant="label" color={ds.c.ground} style={font.semiBold}>
              {pill.label}
            </DsText>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  backed: { paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, minWidth: 0 },
  end: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  pill: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  caps: { letterSpacing: 1.2, ...font.medium },
});
