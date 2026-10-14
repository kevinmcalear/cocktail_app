import type { GestureResponderEvent } from 'react-native';

/**
 * A mouse or touch press lets go of focus, so the browser's focus ring doesn't
 * stick to a nav row after the click and light up at the next key (Chrome
 * shows it even for Shift, as in a screenshot shortcut). A click's `detail` counts the clicks; Enter or
 * Space on the control gives 0, so keyboard users keep focus and their ring.
 * Web only (PressableScale.web.tsx). Checked by releaseFocus.check.ts.
 */
export function releaseFocusAfterPointer(e: GestureResponderEvent) {
  // A key's press arrives as the bare DOM event, with no nativeEvent.
  const native = (e.nativeEvent ?? e) as unknown as { detail?: number };
  const el = e.currentTarget as unknown as HTMLElement | null;
  if ((native.detail ?? 0) > 0 && typeof document !== 'undefined' && el && document.activeElement === el) el.blur();
}

/**
 * Enter on a `role="link"` row. React Native Web leaves links to the browser's
 * own Enter-to-click, which a div never gets, so the sidebar, the rail and
 * every link row were dead to the keyboard. A real anchor (`<a href>`) still
 * clicks itself, so it's left alone. Checked by releaseFocus.check.ts.
 */
export function isLinkEnter(role: string | undefined, key: string, target: { tagName?: string } | null): boolean {
  return role === 'link' && key === 'Enter' && target?.tagName !== 'A';
}
