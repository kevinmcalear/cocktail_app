import { toast } from 'burnt';
import { Toaster } from 'burnt/web';
import { useEffect } from 'react';

import { toasterReady } from '@/lib/systemToast.web';

/**
 * burnt's Toaster, loaded lazily by WebToaster.web.tsx. Its effect runs after
 * sonner's own (a parent's effects follow its children's), so sonner is
 * listening when the toasts that waited are handed to it.
 */
export function ListeningToaster() {
  useEffect(() => toasterReady(toast), []);
  return <Toaster />;
}
