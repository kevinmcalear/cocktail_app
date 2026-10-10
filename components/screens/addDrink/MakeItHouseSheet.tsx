import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { TechniqueSheet } from '@/components/techniques/TechniqueSheet';
import { radius, space } from '@/constants/tokens';
import type { HouseNudge } from '@/lib/makeItHouse';
import type { Technique } from '@/lib/techniques';

interface MakeItHouseSheetProps {
  /** The line being made house ("Bacardí Carta Blanca"); null when closed. */
  bottle: string | null;
  /** Its ways, best fit first (houseWays). */
  ways: readonly Technique[];
  /** What the drink's name says, when it's about this line. */
  nudge?: HouseNudge | null;
  onPick: (t: Technique, adjunct: string | null) => void;
  onClose: () => void;
}

/**
 * "What did you do to it?" for a bottle already in the drink: a fat wash, an
 * infusion, a milk wash. The drink's name can answer first ("coconut
 * fat-washed"). Picking one opens the prep builder with the bottle as its base.
 */
export function MakeItHouseSheet({ bottle, ways, nudge, onPick, onClose }: MakeItHouseSheetProps) {
  const ds = useDs();
  return (
    <TechniqueSheet visible={!!bottle} onClose={onClose} eyebrow={`Make it house · ${bottle ?? ''}`} title="What did you do to it?">
      <Body tone="muted">The bottle stays the base. The recipe, steps and keep time fill in.</Body>
      {nudge ? (
        <PressableScale
          role="button"
          accessibilityLabel={`From the drink’s name: ${nudge.phrase}`}
          onPress={() => onPick(nudge.technique, nudge.adjunct)}
          style={[styles.nudge, { borderColor: ds.accentFill.fill, backgroundColor: ds.c.surface }]}
        >
          <Caption tone="accent">FROM THE DRINK’S NAME</Caption>
          <Body>{nudge.phrase[0].toUpperCase() + nudge.phrase.slice(1)}</Body>
        </PressableScale>
      ) : null}
      <View role="list">
        {ways.map((t) => (
          <PressableScale key={t.id} role="button" accessibilityLabel={`${t.name}, ${t.time}`} onPress={() => onPick(t, null)} style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <View style={styles.flex}>
              <Body>{t.name}</Body>
              <Caption tone="muted" numberOfLines={1}>
                {t.summary}
              </Caption>
            </View>
            <Caption tone="muted">{t.time}</Caption>
          </PressableScale>
        ))}
      </View>
    </TechniqueSheet>
  );
}

const styles = StyleSheet.create({
  nudge: { gap: space.xs, borderWidth: 2, borderRadius: radius.control, padding: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm },
  flex: { flex: 1, gap: 2 },
});
