import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { SidePanelHost } from './sidePanel';

/** Into the room beside the drink (sidePanel.ts), in the context it's written in. */
export function IntoSidePanel({ host, children }: { host: SidePanelHost; children: ReactNode }) {
  const { el, onUse } = host;
  useEffect(() => {
    onUse(true);
    return () => onUse(false);
  }, [onUse]);
  return el ? createPortal(children, el) : null;
}
