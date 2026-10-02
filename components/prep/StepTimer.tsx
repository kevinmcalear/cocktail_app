import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { PressableScale, Spec, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { countdown, timerLabel } from '@/lib/scale';

/**
 * A step's countdown ("steep 10 min"). Tap to start, tap again to reset. It
 * counts from the wall clock, so it stays right if the app is backgrounded.
 */
export function StepTimer({ seconds }: { seconds: number }) {
  const ds = useDs();
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [endsAt]);

  const left = endsAt === null ? null : Math.ceil((endsAt - now) / 1000);
  const done = left !== null && left <= 0;
  useEffect(() => {
    if (done && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [done]);

  const label = left === null ? timerLabel(seconds) : done ? 'Done' : countdown(left);
  return (
    <PressableScale
      accessibilityLabel={left === null ? `Start a ${timerLabel(seconds)} timer` : done ? 'Timer done. Reset' : `${countdown(left)} left. Reset`}
      onPress={() => {
        setNow(Date.now());
        setEndsAt(endsAt === null ? Date.now() + seconds * 1000 : null);
      }}
      style={[styles.timer, { backgroundColor: done ? ds.c.ink : ds.c.raised, borderColor: left === null ? ds.c.lineStrong : ds.c.ink }]}
    >
      <Spec color={done ? ds.c.ground : ds.c.ink}>{label}</Spec>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  timer: { minHeight: layout.minTapTarget, minWidth: 80, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});
