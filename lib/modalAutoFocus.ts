import { Keyboard, Platform } from 'react-native';

/**
 * autoFocus for an input inside a Modal. On Android the Modal's window only takes
 * focus a moment after it's shown, and the keyboard request autoFocus makes before
 * that is dropped: the input focuses but no keyboard opens. So on Android, leave
 * autoFocus off and call focusInModal from the Modal's onShow instead.
 */
export const MODAL_AUTOFOCUS = Platform.OS !== 'android';

type Focusable = { focus(): void; blur(): void };
// ponytail: Tamagui 2.7 types TamaguiElement with React Native 0.88's View
// component rather than its instance, so a Tamagui input's ref is cast to this.
// Drop the cast once Tamagui's types catch up.
export type FocusableRef = { readonly current: Focusable | null };

// ponytail: JS can't see when the Modal's window gains focus, so check for the
// keyboard after a beat and ask again (blur first: focus() is a no-op on a focused
// input). Upgrade path: a native onWindowFocusChanged hook if more sheets need it.
export function focusInModal(input: FocusableRef, tries = 5, waitMs = 150) {
  input.current?.focus();
  setTimeout(() => {
    if (Keyboard.isVisible() || tries <= 1 || !input.current) return;
    input.current.blur();
    focusInModal(input, tries - 1, waitMs);
  }, waitMs);
}
