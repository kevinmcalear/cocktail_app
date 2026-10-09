import { useSegments } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { PressableScale, useDs } from '@/components/ds';
import { eightBall, layout } from '@/constants/tokens';
import { canListenForShakes, listenForShakes } from '@/lib/shake';

import { EightBall } from './EightBall';

const OpenEightBall = createContext<() => void>(() => {});

/**
 * Shake the phone on any main tab to open the magic eight ball (issue #18);
 * shake again while it's open for another drink. Listens only while the app
 * is in front and a tab is showing, so a drink page, sheet route or the
 * background never pick up a shake. Screens add EightBallButton for web and
 * for anyone who can't or won't shake.
 */
export function EightBallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const onTabs = useSegments()[0] === '(tabs)';
  const rollRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!active || !onTabs) return;
    const stop = listenForShakes(() => (rollRef.current ? rollRef.current() : setOpen(true)));
    return stop ?? undefined;
  }, [active, onTabs]);

  return (
    <OpenEightBall.Provider value={() => setOpen(true)}>
      {children}
      {open ? <EightBall onClose={() => setOpen(false)} rollRef={rollRef} /> : null}
    </OpenEightBall.Provider>
  );
}

/** A little eight ball: the black ball, its white circle and the 8. Decorative; the button names it. */
function EightBallGlyph() {
  const ds = useDs();
  return (
    // The muted rim keeps a black ball visible on a dark ground.
    <Svg width={32} height={32} viewBox="0 0 24 24" aria-hidden>
      <Circle cx={12} cy={12} r={11.2} fill={eightBall.body} stroke={ds.c.muted} strokeOpacity={0.6} strokeWidth={0.8} />
      <Circle cx={7.6} cy={7} r={2.6} fill={eightBall.shine} />
      <Circle cx={12} cy={10.4} r={5.4} fill={ds.c.paper} />
      <Circle cx={12} cy={8.7} r={1.45} fill="none" stroke={eightBall.body} strokeWidth={1.2} />
      <Circle cx={12} cy={11.9} r={1.8} fill="none" stroke={eightBall.body} strokeWidth={1.2} />
    </Svg>
  );
}

/** The eight ball without shaking: the bare ball, no glass circle, at the avatar's size. */
export function EightBallButton() {
  const open = useContext(OpenEightBall);
  return (
    <PressableScale
      role="button"
      onPress={open}
      accessibilityLabel={canListenForShakes() ? 'Pick a random drink. You can also shake your phone.' : 'Pick a random drink'}
      style={styles.target}
    >
      <EightBallGlyph />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  target: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'flex-end', justifyContent: 'center' },
});
