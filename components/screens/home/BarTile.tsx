import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

/** Tiles to a row: three on a phone, four where there's room. */
export function useTileCols(): number {
  return useBreakpoint() === 'phone' ? 3 : 4;
}

type Badge = 'check' | 'plus' | 'remove';

interface BarTileProps {
  name: string;
  /** One line under the name: "In 12 drinks", "Made yesterday". */
  meta?: string | null;
  /** Muted; ink when it matters (a prep's use-by close, kit that opens projects); accent only for a tick. */
  metaTone?: 'muted' | 'accent' | 'ink';
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
  /** The Add tile: dashed like a suggestion, but its label reads in ink. */
  add?: boolean;
}

/**
 * One thing on your bar, the same everywhere on My Bar and in Add to your
 * bar: its drawing on the house paper, the name, and a line about it.
 */
export function BarTile({ name, meta, metaTone = 'muted', picture, onPress, role, checked, accessibilityLabel, accessibilityHint, ghost, badge, onLongPress, add }: BarTileProps) {
  const ds = useDs();
  // A desktop fits five tiles to a row, so names take the smaller line (a long word never breaks mid-way).
  const dense = useBreakpoint() === 'desktop';
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
        {badge ? <TileBadge badge={badge} onPaper={!ghost} /> : null}
      </View>
      <View style={styles.text}>
        <DsText variant={dense ? 'caption' : 'body'} numberOfLines={2} tone={ghost && !add ? 'muted' : 'ink'} style={styles.name}>
          {name}
        </DsText>
        {meta ? (
          <Caption tone={metaTone} numberOfLines={2}>
            {meta}
          </Caption>
        ) : null}
      </View>
    </PressableScale>
  );
}

/**
 * The way to add to a section, as the first tile in its grid: where the next
 * thing will go, dashed so it never reads as something you have. `sub`: what
 * goes there ("Search or snap", "Acids, enzymes").
 */
export function AddTile({ label, sub, onPress }: { label: string; sub?: string; onPress: () => void }) {
  const ds = useDs();
  return <BarTile name={label} meta={sub} picture={<View style={styles.plus}><IconSymbol name="plus" size={26} color={ds.c.muted} /></View>} role="button" accessibilityLabel={sub ? `${label}: ${sub}` : label} ghost add onPress={onPress} />;
}

/** The corner mark. A plus is an outline (in the drawing's ink on paper, muted on a dashed suggestion); a check is filled. */
function TileBadge({ badge, onPaper }: { badge: Badge; onPaper: boolean }) {
  const ds = useDs();
  const on = badge === 'check';
  const line = badge === 'plus' ? (onPaper ? ds.c.sketchInk : ds.c.muted) : ds.c.ink;
  return (
    <View
      aria-hidden
      style={[
        styles.badge,
        on
          ? { backgroundColor: ds.accentFill.fill }
          : badge === 'plus'
            ? { borderColor: onPaper ? withAlpha(ds.c.sketchInk, 0.4) : ds.c.muted, borderWidth: 1.5 }
            : { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong, borderWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <IconSymbol name={on ? 'checkmark' : badge === 'plus' ? 'plus' : 'minus'} size={on ? 14 : 12} color={on ? ds.accentFill.text : line} />
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
  square: { aspectRatio: 1, borderRadius: radius.control, borderCurve: 'continuous', borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  ghost: { borderStyle: 'dashed', borderWidth: 1.5 },
  picture: { flex: 1, borderRadius: radius.control - 2, overflow: 'hidden' },
  faded: { opacity: 0.3 },
  badge: { position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { gap: 1 },
  name: { fontFamily: fontFamilies.bodyMedium },
  plus: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -half, rowGap: space.lg },
  cell: { paddingHorizontal: half },
});
