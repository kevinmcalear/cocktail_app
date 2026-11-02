import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { StepTimer } from '@/components/prep/StepTimer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';
import type { Step } from '@/lib/techniques';
import { stepParts } from '@/lib/techniques/learn';

/**
 * A technique's steps as Kept-learn draws them: a number, the step's first
 * sentence as its name and the rest under it. Tap the number when it's done
 * (it turns to a tick); a step with a timer keeps it on the right.
 */
export function TechniqueSteps({ steps }: { steps: Step[] }) {
  const ds = useDs();
  const [done, setDone] = useState<number[]>([]);
  return (
    <View role="list">
      {steps.map((s, i) => {
        const on = done.includes(i);
        const { name, rest } = stepParts(s.text);
        return (
          <View key={s.text} role="listitem" style={styles.step}>
            <PressableScale
              role="checkbox"
              aria-checked={on}
              accessibilityLabel={`Step ${i + 1} done: ${name}`}
              onPress={() => setDone((d) => (on ? d.filter((x) => x !== i) : [...d, i]))}
              style={styles.tap}
            >
              <View style={[styles.num, { backgroundColor: on ? ds.c.ink : ds.c.raised }]}>
                {on ? <IconSymbol name="checkmark" size={16} color={ds.c.ground} /> : <Caption style={styles.figure}>{String(i + 1)}</Caption>}
              </View>
            </PressableScale>
            <View style={styles.text}>
              <Body tone={on ? 'muted' : 'ink'} style={[styles.name, on && styles.struck]}>
                {name}
              </Body>
              {rest ? <Caption tone="muted">{rest}</Caption> : null}
            </View>
            {s.timer ? <StepTimer seconds={s.timer} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.xs },
  tap: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center', marginLeft: -space.sm },
  num: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  figure: { ...font.figuresMedium },
  text: { flex: 1, minWidth: 0, gap: 2, paddingTop: space.sm },
  name: { ...font.medium },
  struck: { textDecorationLine: 'line-through' },
});
