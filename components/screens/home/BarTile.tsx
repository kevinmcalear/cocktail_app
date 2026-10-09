import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';

/** Tiles to a row: three on a phone, four where there's room. */
export function useTileCols(): number {
  return useBreakpoint() === 'phone' ? 3 : 4;
}

type Badge = 'check' | 'plus' | 'remove';

interface BarTileProps {
  name: string;
  /** One line under the name: "In 12 drinks", "Made yesterday". */
  meta?: string | null;
  metaTone?: 'muted' | 'accent';
  /** The drawing, filling the square (IngredientDrawing). */
  picture: ReactNode;
  onPress: () => void;
  /** link: opens it; button: does something to it; checkbox: ticks it on or off. */
  role: 'link' | 'button' | 'checkbox';
  checked?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Not on your bar yet: faded paper, waiting to be added. */
  ghost?: boolean;
  /** The corner mark: picked, can be added, or taken off on a tap. */
  badge?: Badge | null;
  /** A long press: My Bar's tiles start taking things off, like a home screen. */
  onLongPress?: () => void;
}

/**
 * One thing on your bar, the same everywhere on My Bar and in Add to your
 * bar: its drawing on the house paper, the name, and a line about it.
 */
export function BarTile({ name, meta, metaTone = 'muted', picture, onPress, role, checked, accessibilityLabel, accessibilityHint, ghost, badge, onLongPress }: BarTileProps) {
  const ds = useDs();
  return (
    <PressableScale
      role={role}
      aria-checked={role === 'checkbox' ? !!checked : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tile}
    >
      <View style={[styles.square, ghost ? [styles.ghost, { borderColor: ds.c.lineStrong }] : null, checked ? { borderColor: ds.accentText } : null]}>
        <View style={[styles.picture, ghost ? styles.faded : null]}>{picture}</View>
        {badge ? <TileBadge badge={badge} /> : null}
      </View>
      <View style={styles.text}>
        <Body numberOfLines={2} tone={ghost ? 'muted' : 'ink'}>
          {name}
        </Body>
        {meta ? (
          <Caption tone={metaTone} numberOfLines={1}>
            {meta}
          </Caption>
        ) : null}
      </View>
    </PressableScale>
  );
}

/**
 * The way to add to a section, as the first tile in its grid: where the next
 * thing will go, dashed so it never reads as something you have.
 */
export function AddTile({ label, onPress }: { label: string; onPress: () => void }) {
  const ds = useDs();
  return <BarTile name={label} picture={<View style={styles.plus}><IconSymbol name="plus" size={28} color={ds.c.ink} /></View>} role="button" accessibilityLabel={label} ghost onPress={onPress} />;
}

function TileBadge({ badge }: { badge: Badge }) {
  const ds = useDs();
  const on = badge === 'check';
  return (
    <View aria-hidden style={[styles.badge, on ? { backgroundColor: ds.accentFill.fill } : { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong, borderWidth: StyleSheet.hairlineWidth }]}>
      <IconSymbol name={on ? 'checkmark' : badge === 'plus' ? 'plus' : 'minus'} size={14} color={on ? ds.accentFill.text : ds.c.ink} />
    </View>
  );
}

/** Tiles in rows of `cols`, the last row left-aligned. */
export function TileGrid({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <View style={styles.grid}>
      {Children.map(children, (child) =>
        child ? <View style={[styles.cell, { width: `${100 / cols}%` }]}>{child}</View> : null
      )}
    </View>
  );
}

const half = space.md / 2;

const styles = StyleSheet.create({
  tile: { gap: space.sm },
  // A ring's room is kept on every tile, so ticking one never moves its neighbours.
  square: { aspectRatio: 1, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  ghost: { borderStyle: 'dashed', borderWidth: 1.5 },
  picture: { flex: 1, borderRadius: radius.card - 2, overflow: 'hidden' },
  faded: { opacity: 0.4 },
  badge: { position: 'absolute', top: space.sm, right: space.sm, width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { gap: 2 },
  plus: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -half, rowGap: space.lg },
  cell: { paddingHorizontal: half },
});
