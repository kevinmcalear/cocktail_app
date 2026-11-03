import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Surface, useDs } from '@/components/ds';
import { font, space } from '@/constants/tokens';
import { useFirstRound } from '@/hooks/useFirstRound';

import { nextLine, progressLine, RoundBars, useRoundGo } from './RoundParts';

// Only the phone's place sheet reads these, so they stay out of the sidebar's first load (RoundElsewhere.tsx).

/** At the top of the phone's place sheet while the round is on: where it stands, Keep going and Show me everything. */
export function RoundSheetBlock({ onClose }: { onClose: () => void }) {
  const ds = useDs();
  const round = useFirstRound();
  const go = useRoundGo();
  if (!round.active || !round.current) return null;
  const current = round.current;
  return (
    <Surface raised style={[styles.block, { borderColor: ds.c.line }]}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <Caption tone="muted">{progressLine(round.doneCount, round.total)}</Caption>
          <Body style={styles.medium}>{nextLine(current)}</Body>
        </View>
        <RoundBars done={round.doneCount} total={round.total} />
      </View>
      <View style={styles.stack}>
        <Button
          label="Keep going"
          onPress={() => {
            onClose();
            go(current);
          }}
        />
        <Button
          label="Show me everything"
          variant="ghost"
          onPress={() => {
            round.showEverything();
            onClose();
          }}
        />
      </View>
    </Surface>
  );
}

/** Under the places while the round is on: the rest open as you go. */
export function RoundPlacesNote() {
  const round = useFirstRound();
  if (!round.active) return null;
  return <Caption tone="muted">Team, Theme, Roles and access and the rest open as you go, or all at once with Show me everything. Settings, Help replays the round.</Caption>;
}

const styles = StyleSheet.create({
  block: { gap: space.md, borderWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stack: { gap: space.xs },
  grow: { flex: 1, gap: 2 },
  medium: { ...font.medium },
});
