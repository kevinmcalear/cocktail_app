import { Platform } from 'react-native';

// On the web aria-selected only means something on tab, option and row, so a toggle
// button needs aria-pressed and the active nav item aria-current. React Native has
// neither and VoiceOver/TalkBack read `selected` for both, so native keeps
// aria-selected. react-native-web maps all three. Typed loosely because RN's prop
// types don't list aria-pressed or aria-current.
type AriaProps = Record<string, boolean | string | undefined>;

/** A toggle button's on/off state: aria-pressed on web, selected on native. */
export function pressedProps(pressed: boolean): AriaProps {
  return Platform.OS === 'web' ? { 'aria-pressed': pressed } : { 'aria-selected': pressed };
}

/**
 * The current item in a set, like the active nav link: aria-current on web, selected
 * on native. `kind` is "page" for route links, "true" for any other current item.
 */
export function currentProps(current: boolean, kind: 'page' | 'true' = 'page'): AriaProps {
  return Platform.OS === 'web' ? { 'aria-current': current ? kind : undefined } : { 'aria-selected': current };
}
