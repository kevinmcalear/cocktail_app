import { useSegments } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { GlassButton } from '@/components/ds';
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

/** "Pick for me": the eight ball without shaking. */
export function EightBallButton() {
  const open = useContext(OpenEightBall);
  return (
    <GlassButton
      icon="sparkles"
      label="Pick for me"
      accessibilityLabel={canListenForShakes() ? 'Pick a random drink. You can also shake your phone.' : 'Pick a random drink'}
      onPress={open}
    />
  );
}
