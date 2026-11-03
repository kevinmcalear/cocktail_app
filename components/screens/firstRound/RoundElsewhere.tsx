import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Surface, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useFirstRound } from '@/hooks/useFirstRound';

import { RoundBars } from './RoundParts';

/** In the wizard while adding the first cocktail (over Review from a classic, over the name from scratch): where you are, and Skip. */
export function RoundStrip({ scratch, onSkip }: { scratch?: boolean; onSkip: () => void }) {
  const ds = useDs();
  const round = useFirstRound();
  if (!round.active || round.current?.key !== 'house_spec') return null;
  const at = round.doneCount + 1;
  return (
    <Surface raised style={[styles.strip, { borderColor: ds.c.line }]}>
      <RoundBars done={at} total={round.total} width={48} />
      <Body role="status" style={styles.grow}>{`First round, ${at} of ${round.total}. ${scratch ? 'Name it, add its lines, save.' : 'Change any line, then save.'}`}</Body>
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
  grow: { flex: 1, gap: 2 },
  nav: { marginTop: space.lg, gap: space.xs },
  navCard: { gap: space.sm, padding: space.md, borderWidth: StyleSheet.hairlineWidth },
  left: { alignSelf: 'flex-start' },
});
