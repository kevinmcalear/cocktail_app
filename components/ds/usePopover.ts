import { useState, type ComponentRef } from 'react';
import { Keyboard, Platform, type View } from 'react-native';

/** Where the button that opens the menu sits in the window. */
export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Open and close a PopoverMenu from a button: measure the button, then hang the menu from it. */
export function usePopover() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = (target: ComponentRef<typeof View> | null) => {
    // Open at once, unseen, then place it when the measure comes back. The menu
    // takes the focus, so a keyboard that's up goes down first and the button
    // (a search field's place token) moves with it: measure once it has.
    // ponytail: a fixed wait for the keyboard; listen for keyboardDidHide if it ever lands early.
    const web = Platform.OS === 'web' && typeof document !== 'undefined';
    const typing = web ? document.activeElement instanceof HTMLInputElement : Keyboard.isVisible();
    if (web && typing) (document.activeElement as HTMLElement).blur();
    else Keyboard.dismiss();
    setAnchor({ x: 0, y: 0, width: 0, height: 0 });
    // Only while it's still open: a tap outside during the wait has closed it.
    const measure = () => target?.measureInWindow((x: number, y: number, width: number, height: number) => setAnchor((was) => (was ? { x, y, width, height } : null)));
    if (typing) setTimeout(measure, 320);
    else measure();
  };
  return { anchor, open, close: () => setAnchor(null) };
}
