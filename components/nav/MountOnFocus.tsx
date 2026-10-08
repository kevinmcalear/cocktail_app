import { useIsFocused } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Freeze } from 'react-freeze';

/**
 * Renders a tab's screen only once the tab has been opened, then keeps it, so
 * coming back is instant. Native tabs mount every visible tab at launch
 * (expo-router's NativeTabsView renders all of them), which fetched every
 * tab's lists before anyone looked; web's tabs are lazy already.
 *
 * A tab you've left is frozen (react-freeze, as react-native-screens'
 * freezeOnBlur does; NativeTabs has no such option): it keeps its views and
 * scroll position but skips re-renders from context and store changes until
 * you come back, when it catches up in one render. It freezes a tick after
 * the blur, like react-native-screens' DelayedFreeze, so the blur renders first.
 * ponytail: its queries still refetch on app focus; pass `subscribed` from
 * useIsFocused in the heavy tab hooks to stop that too.
 */
export function MountOnFocus({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const [opened, setOpened] = useState(focused);
  const [frozen, setFrozen] = useState(false);
  // Remember the first focus during render (React's "state from props"), so the screen mounts in the same pass.
  if (focused && !opened) setOpened(true);
  useEffect(() => {
    const t = setTimeout(() => setFrozen(!focused), 0);
    return () => clearTimeout(t);
  }, [focused]);
  if (!opened && !focused) return null;
  return <Freeze freeze={!focused && frozen}>{children}</Freeze>;
}
