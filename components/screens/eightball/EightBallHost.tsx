import { useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { listenForShakes } from '@/lib/shake';
import { useEightBallStore } from '@/store/useEightBallStore';

import { EightBall } from './EightBall';

/**
 * The magic eight ball (issue #18), a hidden Easter egg with no button
 * anywhere. Shake the phone on any main tab to open it; shake again while it's
 * open for another drink. Listens only while the app is in front and a tab is
 * showing, so a drink page, sheet route or the background never pick up a
 * shake. Wide web opens it with ⇧⌘8 (⌘8 in the desktop app; WebSideNav) or "Pick for me" in the ⌘K
 * search (SearchPaletteCard), through useEightBallStore. Mounted once, in the
 * root layout, so it opens over any page.
 */
export function EightBallHost() {
  const open = useEightBallStore((s) => s.open);
  const setOpen = useEightBallStore((s) => s.setOpen);
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
  }, [active, onTabs, setOpen]);

  if (!open) return null;
  return (
    <VenueBrandProvider>
      <EightBall onClose={() => setOpen(false)} rollRef={rollRef} />
    </VenueBrandProvider>
  );
}
