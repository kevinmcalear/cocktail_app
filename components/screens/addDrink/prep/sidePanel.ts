import { createContext } from 'react';

/**
 * The web's desktop page has room beside the drink (board Add-inside, Web:
 * "the drink, and the house-made beside it"): a house-made written inside the
 * drink opens there, as a panel, not over the page. The page with the room
 * says where (`el`, the panel's node) and hears when it's in use. Phones and
 * narrow windows have none: the house-made is a page of its own.
 */
export interface SidePanelHost {
  el: HTMLElement | null;
  /** In use or not: the page swaps what it shows there. */
  onUse: (inUse: boolean) => void;
}

export const SidePanelContext = createContext<SidePanelHost | null>(null);

/** The panel's root id: the desktop page holds ⌘↵ while a house-made is open in it. */
export const SIDE_PANEL_ID = 'house-made-panel';
