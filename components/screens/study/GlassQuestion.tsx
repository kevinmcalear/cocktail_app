import * as Haptics from 'expo-haptics';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { STATUS } from '@/constants/palette';
import { readableAccent } from '@/lib/color';
import type { GlassOption } from '@/lib/study';

interface GlassQuestionProps {
  options: GlassOption[];
  correctId: string;
  picked: string | null;
  onPick: (id: string) => void;
}

/**
 * "Which glass?" with the hand-drawn glassware. The answer is said in words
 * and marked with an icon, never shown by colour alone.
 */
export function GlassQuestion({ options, correctId, picked, onPick }: GlassQuestionProps) {
  const ds = useDs();
  const good = readableAccent(STATUS.success, ds.c.ground);
  const answered = picked !== null;
  const correct = options.find((o) => o.id === correctId);
  return (
    <View style={styles.wrap}>
      <Body>Which glass does it go in?</Body>
      <View role="radiogroup" accessibilityLabel="Glass" style={styles.options}>
        {options.map((o) => {
          const isRight = o.id === correctId;
          const isPicked = o.id === picked;
          const borderColor = answered && isRight ? good : isPicked ? ds.c.lineStrong : 'transparent';
          return (
            <PressableScale
              key={o.id}
              role="radio"
              aria-selected={isPicked}
              aria-disabled={answered}
              disabled={answered}
              haptic={false}
              accessibilityLabel={answered && isRight ? `${o.name}, the right glass` : o.name}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(isRight ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
                }
                onPick(o.id);
              }}
              style={[styles.option, { backgroundColor: ds.c.raised, borderColor }]}
            >
              <CustomIcon name={o.icon} size={40} color={ds.c.ink} />
              <Caption align="center">{o.name}</Caption>
              {answered && isRight ? <IconSymbol name="checkmark" size={16} color={good} /> : null}
            </PressableScale>
          );
        })}
      </View>
      {answered && correct ? (
        <Body accessibilityLiveRegion="polite" color={picked === correctId ? good : ds.c.ink}>
          {picked === correctId ? `Right: a ${correct.name}.` : `Not quite. It’s a ${correct.name}.`}
        </Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  options: { flexDirection: 'row', gap: space.sm },
  option: { flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.md, borderRadius: radius.card, borderWidth: 2 },
});
