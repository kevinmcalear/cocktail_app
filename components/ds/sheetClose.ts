import { createContext, use } from 'react';

/** What closes the sheet a control sits in; each Sheet (small, flow, the web's) provides its own. */
export const CloseContext = createContext<(() => void) | null>(null);

/**
 * Inside a Sheet: close it the way the backdrop or a swipe does, animating
 * out before onClose. For the sheet's own X and Cancel buttons.
 */
export function useSheetClose(): () => void {
  const close = use(CloseContext);
  if (!close) throw new Error('useSheetClose is for buttons inside a Sheet');
  return close;
}
