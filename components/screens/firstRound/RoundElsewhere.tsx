import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Surface, useDs } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';
import { useFirstRound } from '@/hooks/useFirstRound';

import { nextLine, progressLine, RoundBars, useRoundGo } from './RoundParts';

/** Over the wizard's Review while making the Old Fashioned yours: where you are, and Skip. */
export function RoundStrip({ onSkip }: { onSkip: () => void }) {
  const ds = useDs();
  const round = useFirstRound();
  if (!round.active || round.current?.key !== 'house_spec') return null;
  const at = round.doneCount + 1;
  return (
    <Surface raised style={[styles.strip, { borderColor: ds.c.line }]}>
      <RoundBars done={at} total={round.total} width={48} />
      <Body role="status" style={styles.grow}>{`First round, ${at} of ${round.total}. Change any line, then save.`}</Body>
      <Button
        label="Skip"
        variant="ghost"
        size="sm"
        onPress={() => {
          round.done('house_spec');
          onSkip();
        }}
      />
    </Surface>
  );
}

/** At the top of the venue menu while the round is on: where it stands, Keep going and Show me everything. */
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
      <View style={styles.row}>
        <Button
          label="Keep going"
          onPress={() => {
            onClose();
            go(current);
          }}
          style={styles.grow}
        />
        <Button
          label="Show me everything"
          variant="secondary"
          onPress={() => {
            round.showEverything();
            onClose();
          }}
          style={styles.grow}
        />
      </View>
    </Surface>
  );
}

/** Under the places while the round is on: the rest open as you go. */
export function RoundPlacesNote() {
  const round = useFirstRound();
  if (!round.active) return null;
  return <Caption tone="muted" style={styles.note}>My team, Brand, Roles and access and the rest open as you go, or all at once with Show me everything. Settings, Help replays the round.</Caption>;
}

/** In the desktop sidebar while the round is on. */
export function RoundNav() {
  const ds = useDs();
  const round = useFirstRound();
  if (!round.active) return null;
  return (
    <View style={styles.nav}>
      <Surface raised style={[styles.navCard, { borderColor: ds.c.line }]}>
        <Caption tone="muted">{`First round · ${round.doneCount} of ${round.total}`}</Caption>
        <RoundBars done={round.doneCount} total={round.total} width={180} />
        <Caption tone="muted">{round.hidden.length ? 'Menus and Discover open as you go.' : 'Everything’s open.'}</Caption>
      </Surface>
      <Button label="Show me everything" variant="ghost" size="sm" onPress={round.showEverything} style={styles.left} />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm, paddingRight: space.sm },
  block: { gap: space.md, borderWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1, gap: 2 },
  medium: { fontFamily: fontFamilies.bodyMedium },
  note: { marginTop: space.md },
  nav: { marginTop: space.lg, gap: space.xs },
  navCard: { gap: space.sm, padding: space.md, borderWidth: StyleSheet.hairlineWidth },
  left: { alignSelf: 'flex-start' },
});
