import { StyleSheet, View } from 'react-native';

import { Body, Button, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { HouseNudge } from '@/lib/makeItHouse';

/** "The name says coconut fat-washed. Make the Bacardi that way?": what a line typed, or the drink's name, says about how it's made. */
export function NudgeCard({ nudge, name, onMake, onNotNow }: { nudge: HouseNudge; name?: string; onMake: () => void; onNotNow: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.nudge, { backgroundColor: ds.c.surface }]}>
      <Body>{`${nudge.from === 'typed' ? 'You wrote' : 'The name says'} ${nudge.phrase}. Make the ${name} that way?`}</Body>
      <View style={styles.buttons}>
        <Button label="Make it in-house" onPress={onMake} />
        <Button label="Not now" variant="secondary" onPress={onNotNow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nudge: { gap: space.md, borderRadius: radius.control, padding: space.lg },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
