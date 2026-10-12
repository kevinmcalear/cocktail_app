import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, Spec, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space, type } from '@/constants/tokens';
import { useCollection } from '@/hooks/useCollection';
import { useMyRankList, useRankTarget } from '@/hooks/useRankings';
import { dayOf, formatScore, rankedAs } from '@/lib/ranking';
import { useShelfCheck } from '@/hooks/useShelfCheck';
import { shelfNeed } from '@/lib/shelfCheck';
import type { SpecLine } from '@/lib/spec';

interface JourneyStripProps {
  itemId: string;
  name: string;
  saved: boolean;
  onToggleSaved: () => void;
  onRank: () => void;
  onMade: () => void;
  madeTimes: number;
  /** The spec as you see it, checked against your shelf. */
  lines: SpecLine[];
}

const day = (iso: string) => dayOf(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * "You and this drink" (boards drink-phone-home and -classic): Had it (your
 * score and when), To make (saved, and what your shelf still needs) and Made
 * (I made it, the accent at home), with your note from the bar under it.
 */
export function JourneyStrip({ itemId, name, saved, onToggleSaved, onRank, onMade, madeTimes, lines }: JourneyStripProps) {
  const ds = useDs();
  const { data: target } = useRankTarget(itemId);
  const list = target ? rankedAs(target) : null;
  const { data: entries } = useMyRankList(list?.id);
  const best = (entries ?? []).filter((e) => e.item_id === itemId).sort((a, b) => b.score - a.score)[0];
  const note = useCollection().data?.drinks.find((d) => d.itemId === itemId)?.note;
  const shelf = useShelfCheck(itemId, lines).check;
  const need = shelf ? shelfNeed(shelf) : null;
  const tile = [styles.tile, { backgroundColor: ds.c.surface }];

  return (
    <View style={styles.section} accessibilityLabel="You and this drink">
      <View style={styles.row} role="list">
        {best ? (
          <PressableScale role="button" accessibilityLabel={`Had it. Your score ${formatScore(best.score)}${best.had_on ? `, ${day(best.had_on)}` : ''}. Rank it again`} onPress={onRank} style={tile}>
            <Label done text="Had it" />
            <Spec style={styles.big}>{formatScore(best.score)}</Spec>
            <Caption tone="muted">{day(best.had_on ?? best.created_at)}</Caption>
          </PressableScale>
        ) : (
          <PressableScale role="button" accessibilityLabel={`Had it: not yet. Rank a ${name} you've had`} onPress={onRank} style={tile}>
            <Label text="Had it" />
            <DsText>Not yet</DsText>
            <Caption color={ds.accentText}>Rank it ›</Caption>
          </PressableScale>
        )}
        <PressableScale
          role="button"
          aria-pressed={saved}
          accessibilityLabel={`To make: ${saved ? 'saved' : 'not saved'}${need ? `. ${need}` : ''}. ${saved ? 'Remove from' : 'Add to'} To make`}
          onPress={onToggleSaved}
          style={tile}
        >
          <Label done={saved} text="To make" />
          <DsText>{saved ? 'Saved' : 'Save it'}</DsText>
          {need ? <Caption tone="muted">{need}</Caption> : null}
        </PressableScale>
        <PressableScale role="button" accessibilityLabel={madeTimes ? `I made it again. You've made it ${madeTimes} times` : `I made ${name}`} onPress={onMade} style={[styles.tile, styles.made, { backgroundColor: ds.accentFill.fill }]}>
          <Caption color={ds.accentFill.text}>{madeTimes ? `Made ×${madeTimes}` : 'Made'}</Caption>
          <IconSymbol name="plus" size={22} color={ds.accentFill.text} />
          <DsText color={ds.accentFill.text} style={styles.madeLabel}>
            I made it
          </DsText>
        </PressableScale>
      </View>
      {note ? <Caption tone="muted">{`“${note}” Your note from the bar.`}</Caption> : null}
    </View>
  );
}

function Label({ text, done }: { text: string; done?: boolean }) {
  const ds = useDs();
  return (
    <View style={styles.label}>
      {done ? <IconSymbol name="checkmark" size={14} color={ds.accentText} /> : null}
      <Caption tone="muted">{text}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm + 2 },
  row: { flexDirection: 'row', gap: space.xs + 2 },
  tile: { flex: 1, minWidth: 0, paddingVertical: space.md, paddingHorizontal: space.sm + 2, borderRadius: radius.control, borderCurve: 'continuous', gap: space.xs },
  made: { justifyContent: 'space-between' },
  label: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  big: { fontSize: type.headline.fontSize, lineHeight: type.headline.lineHeight },
  madeLabel: { fontFamily: fontFamilies.bodySemiBold },
});
