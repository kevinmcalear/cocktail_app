import { useIsFocused } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { Freeze } from 'react-freeze';

import { useUnderSeeThrough } from './useUnderSeeThrough';

/**
 * Renders a tab's screen only once the tab has been opened, then keeps it, so
 * coming back is instant. Native tabs mount every visible tab at launch
 * (expo-router's NativeTabsView renders all of them), which fetched every
 * tab's lists before anyone looked; web's tabs are lazy already.
 *
 * On web, a tab you've left is frozen (react-freeze, as react-native-screens'
 * freezeOnBlur does): it keeps its views and scroll position but skips
 * re-renders from context and store changes until you come back, when it
 * catches up in one render. It freezes a tick after the blur, like
 * react-native-screens' DelayedFreeze, so the blur renders first.
 * Under a create wizard's dialog on a wide window (useUnderSeeThrough) the
 * page still shows, so it neither freezes nor waits for a focus to mount: a
 * link straight to /add-beer opens over the tab.
 * ponytail: not on iOS and Android. NativeTabs (no freeze option) switches
 * tabs natively before JS hears of it, and a frozen tab is display: none until
 * React unfreezes it, so you'd come back to a blank tab for a moment. Its
 * queries still refetch on app focus too; pass `subscribed` from useIsFocused
 * in the heavy tab hooks to stop that on every platform.
 */
export function MountOnFocus({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  // ponytail: every tab opened before stays unfrozen under the dialog, not only the one showing (the tabs hide the rest). Ask the tabs' own state if that ever costs.
  const under = useUnderSeeThrough();
  const shown = focused || under;
  const [opened, setOpened] = useState(shown);
  const [frozen, setFrozen] = useState(false);
  // Remember the first showing during render (React's "state from props"), so the screen mounts in the same pass.
  if (shown && !opened) setOpened(true);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const t = setTimeout(() => setFrozen(!shown), 0);
    return () => clearTimeout(t);
  }, [shown]);
  if (!opened && !shown) return null;
  return <Freeze freeze={!shown && frozen}>{children}</Freeze>;
}
