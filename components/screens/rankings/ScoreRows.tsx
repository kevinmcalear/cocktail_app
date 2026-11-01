import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, PressableScale, useDs } from '@/components/ds';
// A bar's ringed monogram, or its logo (disc-list).
import { BarMark } from '@/components/screens/home/BarMark';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayName, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { formatScore } from '@/lib/ranking';

export interface ScoreRowProps {
  position: number;
  /** The drink drawn at the start of the row. */
  itemId?: string;
  pictureUrl?: string | null;
  pictureIsSketch?: boolean;
  /** A bar's row instead: its logo (initials when null) and page, for its colours. */
  logo?: string | null;
  barId?: string;
  title: string;
  sub: string;
  score: number;
  /** Under the score: "214 ranks", "average". */
  scoreDetail?: string;
  /** Yours, or the one just placed: the row sits on the accent's wash. */
  mine?: boolean;
  onPress?: () => void;
  /** Discover: resting the pointer or keyboard focus on the row shows this bar on the map. */
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  /** Beside the row, outside its link: the bar's heart. */
  end?: ReactNode;
}

/**
 * One numbered row with its score, the one row every ranked list draws
 * (Prod-rank-A "Where it landed", Sta-rankings, Loop-ladder, Kept-score): the
 * number, the drink or the bar, the name in the display face, a line under
 * it, and the score.
 */
export function ScoreRow({ position, itemId, pictureUrl, pictureIsSketch, logo, barId, title, sub, score, scoreDetail, mine, onPress, onHoverIn, onHoverOut, end }: ScoreRowProps) {
  const ds = useDs();
  const label = `Number ${position}: ${title}, ${sub}. Score ${formatScore(score)}${scoreDetail ? `, ${scoreDetail}` : ''}`;
  const lead = itemId ? (
    <DrinkImage thumb itemId={itemId} source={pictureUrl ?? undefined} generated={pictureIsSketch} accessibilityLabel="" radius="control" style={styles.drink} sketchDetail="thumb" />
  ) : logo !== undefined ? (
    <BarMark logoUrl={logo} name={title} profileId={barId} size={DRINK} />
  ) : null;
  const body = (
    <>
      <DsText variant="title" tone="muted" style={[displayName.row, styles.position]}>
        {position}
      </DsText>
      {lead}
      <View style={styles.flex}>
        <DsText variant="title" numberOfLines={1} style={displayName.row}>
          {title}
        </DsText>
        <Caption tone="muted" numberOfLines={1}>
          {sub}
        </Caption>
      </View>
      <View style={styles.score}>
        <DsText variant="title" style={displayName.row}>
          {formatScore(score)}
        </DsText>
        {scoreDetail ? <Caption tone="muted">{scoreDetail}</Caption> : null}
      </View>
    </>
  );
  const style = [styles.row, mine ? { backgroundColor: withAlpha(ds.accentFill.fill, 0.22) } : null, end ? styles.flex : null];
  const row = onPress ? (
    <PressableScale role="link" accessibilityLabel={label} onPress={onPress} onHoverIn={onHoverIn} onHoverOut={onHoverOut} onFocus={onHoverIn} onBlur={onHoverOut} style={style}>
      {body}
    </PressableScale>
  ) : (
    <View accessible accessibilityLabel={label} style={style}>
      {body}
    </View>
  );
  return end ? (
    <View style={styles.withEnd}>
      {row}
      {end}
    </View>
  ) : (
    row
  );
}

/** A plain row in a raised card: "How scores work", "Ratings rule". With `onPress` it's a link with a chevron. */
export function CardRow({ icon, title, sub, value, onPress }: { icon?: Parameters<typeof IconSymbol>[0]['name']; title: string; sub?: string; /** At the row's end: "Count in full", "8.9". */ value?: string; onPress?: () => void }) {
  const ds = useDs();
  const body = (
    <>
      {icon ? <IconSymbol name={icon} size={18} color={ds.c.muted} /> : null}
      <View style={styles.flex}>
        <Body>{title}</Body>
        {sub ? <Caption tone="muted">{sub}</Caption> : null}
      </View>
      {value ? <Body tone="muted">{value}</Body> : null}
      {onPress ? <IconSymbol name="chevron.right" size={14} color={ds.c.faint} /> : null}
    </>
  );
  return onPress ? (
    <PressableScale role="link" accessibilityLabel={[title, sub, value].filter(Boolean).join('. ')} onPress={onPress} style={styles.card}>
      {body}
    </PressableScale>
  ) : (
    <View accessible accessibilityLabel={[title, sub, value].filter(Boolean).join('. ')} style={styles.card}>
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
  score: { alignItems: 'flex-end' },
  withEnd: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  drink: { width: DRINK, height: DRINK },
  flex: { flex: 1, minWidth: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  group: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  label: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
