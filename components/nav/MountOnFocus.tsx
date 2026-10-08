import { useIsFocused } from 'expo-router';
import { useState, type ReactNode } from 'react';

/**
 * Renders a tab's screen only once the tab has been opened, then keeps it, so
 * coming back is instant. Native tabs mount every visible tab at launch
 * (expo-router's NativeTabsView renders all of them), which fetched every
 * tab's lists before anyone looked; web's tabs are lazy already.
 */
export function MountOnFocus({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const [opened, setOpened] = useState(focused);
  // Remember the first focus during render (React's "state from props"), so the screen mounts in the same pass.
  if (focused && !opened) setOpened(true);
  return opened || focused ? children : null;
}
