import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Spec, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { countdown, timerLabel } from '@/lib/scale';

import { IDLE, secondsLeft, toggleClock, type Clock } from './stepTimerClock';

/** Ticks while running and buzzes once at zero, while the app is open. */
function useClock(seconds: number) {
  const [clock, setClock] = useState<Clock>(IDLE);
  const [now, setNow] = useState(() => Date.now());
  const running = clock.state === 'running';
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [running]);
  const left = secondsLeft(clock, seconds, now);
  const done = running && left <= 0;
  useEffect(() => {
    if (done && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [done]);
  const toggle = () => {
    const t = Date.now();
    setNow(t);
    setClock((c) => toggleClock(c, seconds, t));
  };
  return { clock, left, done, toggle, reset: () => setClock(IDLE) };
}

/**
 * A step's countdown pill ("steep 10 min"). Tap to start, tap again to reset.
 * It counts from the wall clock, so it stays right if the app is backgrounded.
 */
export function StepTimer({ seconds }: { seconds: number }) {
  const ds = useDs();
  const { clock, left, done, toggle, reset } = useClock(seconds);
  const idle = clock.state === 'idle';
  const label = idle ? timerLabel(seconds) : done ? 'Done' : countdown(left);
  return (
    <PressableScale
      accessibilityLabel={idle ? `Start a ${timerLabel(seconds)} timer` : done ? 'Timer done. Reset' : `${countdown(left)} left. Reset`}
      onPress={idle ? toggle : reset}
      style={[styles.timer, { backgroundColor: done ? ds.c.ink : ds.c.raised, borderColor: idle ? ds.c.lineStrong : ds.c.ink }]}
    >
      <Spec color={done ? ds.c.ground : ds.c.ink}>{label}</Spec>
    </PressableScale>
  );
}

/**
 * Make mode's big clock: Start, Pause, Resume and Reset. It keeps time on the
 * wall clock, so it is right when you come back to the app.
 * ponytail: buzzing with the app closed needs expo-notifications (a native
 * dependency and a new build); until then it buzzes only while the app is open.
 */
export function BigTimer({ seconds, label }: { seconds: number; label: string }) {
  const ds = useDs();
  const { clock, left, done, toggle, reset } = useClock(seconds);
  const running = clock.state === 'running' && !done;
  const cta = done ? 'Start again' : running ? 'Pause' : clock.state === 'paused' ? 'Resume' : 'Start';
  return (
    <View role="timer" aria-label={label} style={[styles.big, { backgroundColor: ds.c.surface }]}>
      <View style={styles.flex}>
        <Spec style={styles.clock}>{done ? 'Done' : countdown(left)}</Spec>
        <Caption tone="muted">{"Keeps time if you leave the app. It buzzes at zero while it's open."}</Caption>
        {clock.state === 'paused' ? <Body tone="muted">Paused</Body> : null}
      </View>
      <View style={styles.buttons}>
        <Button label={cta} variant={running ? 'secondary' : 'primary'} size="lg" onPress={toggle} />
        {clock.state !== 'idle' ? <Button label="Reset" variant="secondary" onPress={reset} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timer: { minHeight: layout.minTapTarget, minWidth: 80, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  big: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  flex: { flex: 1, minWidth: 180, gap: space.xs },
  // The board's big mono clock: the display size in the spec face.
  clock: { ...type.display, fontFamily: fontFamilies.monoMedium },
  buttons: { gap: space.sm, alignItems: 'stretch' },
});
