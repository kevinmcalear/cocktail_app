import { useRef } from 'react';

import { confirmDiscardChanges } from '@/lib/dialogs';

/**
 * A sheet's own close (Sheet, Sheet.web) for a sheet with unsaved changes:
 * asks "Discard changes?" first and closes only on Discard. One question at a
 * time, so a second Escape or back while it's up doesn't stack another.
 */
export function useDiscardGuard(dirty: boolean | undefined): (close: () => void) => void {
  const asking = useRef(false);
  return (close) => {
    if (!dirty) return close();
    if (asking.current) return;
    asking.current = true;
    void confirmDiscardChanges(true).then((discard) => {
      asking.current = false;
      if (discard) close();
    });
  };
}
