import { Keyboard, Platform, type GestureResponderEvent } from 'react-native';

/** How far (pt) a finger moves before a drag means "put the keyboard away". */
export const KEYBOARD_PULL = 12;

/** A drag that began at `from` has gone far enough down the page (`to` past it) to mean "put the keyboard away". */
export function pulledPast(from: number | null, to: number) {
  return from != null && to - from >= KEYBOARD_PULL;
}

// ponytail: one finger at a time, so one start for every list; a second finger's start replaces the first.
let touchFrom: number | null = null;

// The web hands over the DOM's TouchEvent, which only has a page position on each touch.
const fingerY = (e: GestureResponderEvent) => e.nativeEvent.touches[0]?.pageY ?? e.nativeEvent.pageY;

/** A drag on a view that isn't a list (a search head over its results) puts the keyboard away too. */
export const touchDismissesKeyboard = {
  onTouchStart: (e: GestureResponderEvent) => {
    touchFrom = fingerY(e);
  },
  // Either way: a list too short to scroll never starts a drag, and a long one is being scrolled.
  onTouchMove: (e: GestureResponderEvent) => {
    const y = fingerY(e);
    if (touchFrom == null || Math.abs(y - touchFrom) < KEYBOARD_PULL) return;
    touchFrom = null;
    Keyboard.dismiss();
  },
};

/**
 * Spread on a ScrollView or FlatList that sits under a text field: a drag
 * puts the keyboard away and a tap on a row still lands.
 * - iOS: interactive, as Messages and Mail do. The keyboard follows the
 *   finger down off the screen and comes back if it's pushed up again
 *   (UIScrollView.KeyboardDismissMode.interactive).
 * - Android: React Native has no interactive mode (`interactive` means
 *   `none`), so the keyboard goes as a drag begins (`on-drag`). A list too
 *   short to scroll never starts a drag, so a touch that moves does the same.
 * - The web: touch drags only. react-native-web's `on-drag` blurs on every
 *   scroll event, the wheel's and the one a shrinking list makes as you type.
 */
export const dragDismissesKeyboard = Platform.select({
  ios: { keyboardDismissMode: 'interactive', keyboardShouldPersistTaps: 'handled' } as const,
  android: { keyboardDismissMode: 'on-drag', keyboardShouldPersistTaps: 'handled', ...touchDismissesKeyboard } as const,
  default: { keyboardShouldPersistTaps: 'handled', ...touchDismissesKeyboard } as const,
});
