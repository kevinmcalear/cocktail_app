import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, layout, palateHues, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { formatScore } from '@/lib/ranking';

/**
 * The pieces "Had a drink? Rank it" and its sheet share (Loop-rank board):
 * the label, the field that opens the sheet, a drink row and the green note.
 */

/** "Had a drink? Rank it": sentence case, 15 pt semibold (not a section's small capitals). */
export function RankLabel({ children }: { children: string }) {
  return (
    <DsText variant="label" role="heading" style={font.semiBold}>
      {children}
    </DsText>
  );
}

/** "What did you have?" with search leading and the camera trailing: tap opens the Rank it sheet, the camera snaps a menu. */
export function RankField({ onPress, onCamera }: { onPress: () => void; onCamera: (() => void) | null }) {
  const ds = useDs();
  return (
    <View style={[styles.field, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
      <PressableScale role="button" accessibilityLabel="What did you have? Find a drink to rank" onPress={onPress} style={styles.fieldPress}>
        <IconSymbol name="magnifyingglass" size={18} color={ds.c.muted} />
        <DsText variant="body" tone="muted" numberOfLines={1} style={styles.flex}>
          What did you have?
        </DsText>
      </PressableScale>
      {onCamera ? (
        <PressableScale role="button" accessibilityLabel="Snap the menu" onPress={onCamera} style={styles.camera}>
          <IconSymbol name="camera" size={20} color={ds.c.muted} />
        </PressableScale>
      ) : null}
    </View>
  );
}

interface RankRowProps {
  /** The drink whose picture leads the row (its photo, else its drawing); or `lead` for something else (a bar's mark). */
  itemId?: string;
  imageUrl?: string | null;
  lead?: ReactNode;
  name: string;
  sub?: string | null;
  /** Your score at the end (the display face), in place of the chevron. */
  score?: number | null;
  first?: boolean;
  onPress?: () => void;
}

/** A drink row as the board draws them: its drawing, the name in the display face, a line under it, then a chevron or your score. */
export function RankRow({ itemId, imageUrl, lead, name, sub, score, first = true, onPress }: RankRowProps) {
  const ds = useDs();
  const scored = score !== undefined && score !== null;
  const label = [name, sub, scored ? `your score ${formatScore(score)}` : null].filter(Boolean).join('. ');
  const body = (
    <>
      <View style={[styles.pic, lead ? styles.picLead : null]}>{lead ?? <DrinkImage thumb sketchDetail="thumb" source={imageUrl} glass={null} itemId={itemId} accessibilityLabel={name} radius="control" />}</View>
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name}
        </DsText>
        {sub ? (
          <Caption tone="muted" numberOfLines={1}>
            {sub}
          </Caption>
        ) : null}
      </View>
      {scored ? (
        <DsText variant="headline" style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {formatScore(score)}
        </DsText>
      ) : onPress ? (
        <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
      ) : null}
    </>
  );
  const style = [styles.row, { borderTopColor: first ? 'transparent' : ds.c.line }];
  return onPress ? (
    <PressableScale role="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {body}
    </PressableScale>
  ) : (
    <View accessible aria-label={label} style={style}>
      {body}
    </View>
  );
}

/** "Ranked. Had another?": a soft green note with a tick. Tap ranks another. */
export function RankedNote({ onPress }: { onPress: () => void }) {
  const ds = useDs();
  const green = palateHues[ds.scheme].green;
  return (
    <PressableScale role="button" accessibilityLabel="Ranked. Had another? Rank another drink" onPress={onPress} style={[styles.note, { backgroundColor: withAlpha(green, ds.scheme === 'dark' ? 0.2 : 0.14) }]}>
      <IconSymbol name="checkmark.circle.fill" size={20} color={green} />
      <DsText variant="body" color={green} style={styles.flex}>
        Ranked. Had another?
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTapTarget + space.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  fieldPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch', paddingLeft: space.lg, paddingRight: space.sm },
  camera: { width: layout.minTapTarget, height: layout.minTapTarget, marginRight: space.xs, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  pic: { width: 56, height: 56, justifyContent: 'center' },
  picLead: { alignItems: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
});
