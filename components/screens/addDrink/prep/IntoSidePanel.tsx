import type { ReactNode } from 'react';

import type { SidePanelHost } from './sidePanel';

/** Phones have no room beside the drink (sidePanel.ts): nothing goes there. */
export function IntoSidePanel(_: { host: SidePanelHost; children: ReactNode }) {
  return null;
}
