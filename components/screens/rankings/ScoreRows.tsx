import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayName, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { formatScore } from '@/lib/ranking';

export interface ScoreRowProps {
  position: number;
  /** The drink drawn at the start of the row. */
  itemId: string;
  pictureUrl?: string | null;
  pictureIsSketch?: boolean;
  title: string;
  sub: string;
  score: number;
  /** Yours, or the one just placed: the row sits on the accent's wash. */
  mine?: boolean;
  onPress?: () => void;
}

/**
 * One numbered drink with its score, as the rank result and the rankings
 * page draw it (Prod-rank-A "Where it landed", Sta-rankings): the number,
 * the drink, the name in the display face, a line under it, and the score.
 */
export function ScoreRow({ position, itemId, pictureUrl, pictureIsSketch, title, sub, score, mine, onPress }: ScoreRowProps) {
  const ds = useDs();
  const label = `Number ${position}: ${title}, ${sub}. Score ${formatScore(score)}`;
  const body = (
    <>
      <DsText variant="title" tone="muted" style={[displayName.row, styles.position]}>
        {position}
      </DsText>
      <DrinkImage thumb itemId={itemId} source={pictureUrl ?? undefined} generated={pictureIsSketch} accessibilityLabel="" radius="control" style={styles.drink} sketchDetail="thumb" />
      <View style={styles.flex}>
        <DsText variant="title" numberOfLines={1} style={displayName.row}>
          {title}
        </DsText>
        <Caption tone="muted" numberOfLines={1}>
          {sub}
        </Caption>
      </View>
      <DsText variant="title" style={displayName.row}>
        {formatScore(score)}
      </DsText>
    </>
  );
  const style = [styles.row, mine ? { backgroundColor: withAlpha(ds.accentFill.fill, 0.22) } : null];
  return onPress ? (
    <PressableScale role="link" accessibilityLabel={label} onPress={onPress} style={style}>
      {body}
    </PressableScale>
  ) : (
    <View accessible accessibilityLabel={label} style={style}>
      {body}
    </View>
  );
}

/** A plain row in a raised card: "How scores work", "Ratings rule". With `onPress` it's a link with a chevron. */
export function CardRow({ icon, title, sub, onPress }: { icon: Parameters<typeof IconSymbol>[0]['name']; title: string; sub?: string; onPress?: () => void }) {
  const ds = useDs();
  const body = (
    <>
      <IconSymbol name={icon} size={18} color={ds.c.muted} />
      <View style={styles.flex}>
        <Body>{title}</Body>
        {sub ? <Caption tone="muted">{sub}</Caption> : null}
      </View>
      {onPress ? <IconSymbol name="chevron.right" size={14} color={ds.c.faint} /> : null}
    </>
  );
  return onPress ? (
    <PressableScale role="link" accessibilityLabel={sub ? `${title}. ${sub}` : title} onPress={onPress} style={styles.card}>
      {body}
    </PressableScale>
  ) : (
    <View accessible style={styles.card}>
      {body}
    </View>
  );
}

/** Rows in one raised, rounded card. */
export function CardGroup({ children }: { children: ReactNode }) {
  const ds = useDs();
  return <View style={[styles.group, { backgroundColor: ds.c.raised }]}>{children}</View>;
}

/** A small label over a block ("WHAT STOOD OUT?"), with an optional aside at its end in the accent. */
export function BlockLabel({ children, aside, caps = true }: { children: string; aside?: string; caps?: boolean }) {
  const ds = useDs();
  return (
    <View style={styles.label}>
      <Caption tone="muted" style={caps ? styles.caps : null}>
        {children}
      </Caption>
      {aside ? <Caption color={ds.accentText}>{aside}</Caption> : null}
    </View>
  );
}

const DRINK = 44;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm, paddingHorizontal: space.md, marginHorizontal: -space.md, borderRadius: radius.control, borderCurve: 'continuous' },
  position: { minWidth: space.xl, textAlign: 'center' },
  drink: { width: DRINK, height: DRINK },
  flex: { flex: 1, minWidth: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  group: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  label: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
