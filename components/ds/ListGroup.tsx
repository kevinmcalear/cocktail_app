import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import type { IconName } from './Button';
import { PressableScale } from './PressableScale';
import { Pulse } from './Pulse';
import { TextLink } from './ReviewRow';
import { Body, Caption, DsText } from './Text';
import { useDs } from './theme';

// Imported from this file, not the ds index: public pages load that index, and none of them draw these.

/** A section's small label, with an aside on the right: "All 46" and "A to Z", "Your bars" and "All". */
export function SectionLabel({ title, aside, onAside }: { title: string; aside?: string | null; onAside?: () => void }) {
  return (
    <View style={styles.label}>
      <Caption tone="muted" role="heading" style={styles.caps}>
        {title}
      </Caption>
      {aside ? onAside ? <TextLink label={aside} onPress={onAside} /> : <Caption tone="muted">{aside}</Caption> : null}
    </View>
  );
}

/** Rows on one card, a hairline between them (Prod-phone's group). */
export function ListGroup({ children }: { children: ReactNode }) {
  const ds = useDs();
  return (
    <View role="list" style={[styles.group, { backgroundColor: ds.c.surface }]}>
      {children}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  detail?: string | null;
  /** Right of the words: "12", "Use today". */
  value?: string | null;
  /** The amber of something that needs doing. */
  warn?: boolean;
  icon?: IconName;
  /** In place of the icon: a day's colour, a bar's mark. */
  lead?: ReactNode;
  /** A small button at the end of the row: Log batch, Export. */
  end?: ReactNode;
  onPress?: () => void;
  first?: boolean;
}

/** One row of a ListGroup. It opens something, so it ends in a chevron, unless it has its own button. */
export function ListRow({ title, detail, value, warn, icon, lead, end, onPress, first }: ListRowProps) {
  const ds = useDs();
  const line = { borderTopColor: first ? 'transparent' : ds.c.line };
  const words = (
    <>
      {lead ?? (icon ? <IconSymbol name={icon} size={20} color={ds.c.ink} /> : null)}
      <View style={styles.words}>
        <Body numberOfLines={1}>{title}</Body>
        {detail ? (
          <Caption tone="muted" numberOfLines={2}>
            {detail}
          </Caption>
        ) : null}
      </View>
      {value ? <Body color={warn ? ds.accentText : ds.c.muted}>{value}</Body> : null}
      {end}
      {onPress && !end ? <IconSymbol name="chevron.right" size={16} color={ds.c.faint} /> : null}
    </>
  );
  return onPress && !end ? (
    <View role="listitem">
      <PressableScale role="link" accessibilityLabel={[title, detail, value].filter(Boolean).join('. ')} onPress={onPress} style={[styles.row, line]}>
        {words}
      </PressableScale>
    </View>
  ) : (
    <View role="listitem" style={[styles.row, line]}>
      {words}
    </View>
  );
}

/** A plain note on a soft fill: an icon and a sentence (Prod-phone's note). */
export function ListNote({ icon, text }: { icon: IconName; text: string }) {
  const ds = useDs();
  return (
    <View style={[styles.note, { backgroundColor: withAlpha(ds.c.ink, 0.07) }]}>
      <IconSymbol name={icon} size={20} color={ds.c.ink} />
      <Caption style={styles.words}>{text}</Caption>
    </View>
  );
}

/** "Saved on this phone · offline" under a page's title (Sta-you, Sta-drinks). */
export function SavedChip({ text = 'Saved on this phone · offline' }: { text?: string }) {
  const ds = useDs();
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(ds.c.ink, 0.07) }]}>
      <IconSymbol name="phone" size={15} color={ds.c.ink} />
      <Caption>{text}</Caption>
    </View>
  );
}

/** The rows a list will have, outlined in pencil while it loads. */
export function OutlineRows({ count, round, pic = 52 }: { count: number; round?: boolean; pic?: number }) {
  const ds = useDs();
  const edge = { borderColor: ds.c.lineStrong };
  return (
    <View role="status" accessibilityLabel="Loading">
      <Pulse style={styles.outlines}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={styles.outline}>
            <View style={[styles.outlinePic, edge, { width: pic, height: pic, borderRadius: round ? pic / 2 : radius.control }]} />
            <View style={styles.words}>
              <View style={[styles.bar, edge, { width: `${55 - (i % 3) * 8}%` }]} />
              <View style={[styles.bar, styles.barThin, edge, { width: `${78 - (i % 2) * 16}%` }]} />
            </View>
          </View>
        ))}
      </Pulse>
    </View>
  );
}

/** A drink or a bar's name on a row, in the display face. */
export function RowName({ children }: { children: string }) {
  const ds = useDs();
  return (
    <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
      {children}
    </DsText>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  group: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm + 2, paddingHorizontal: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  words: { flex: 1, minWidth: 0 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md + 2, paddingHorizontal: space.lg, borderRadius: space.lg + 2 },
  chip: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: space.xs + 2, paddingVertical: space.sm, paddingHorizontal: space.md + 2, borderRadius: radius.pill },
  outlines: { gap: space.lg + 6 },
  outline: { flexDirection: 'row', alignItems: 'center', gap: space.md + 2 },
  outlinePic: { borderWidth: 1 },
  bar: { height: 14, borderRadius: radius.pill, borderWidth: 1 },
  barThin: { height: 10, marginTop: space.sm + 2 },
});
