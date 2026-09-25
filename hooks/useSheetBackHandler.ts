import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Android back (and the predictive back gesture) should close an open bottom
 * sheet rather than leave the screen underneath. Pass the returned callback to
 * the sheet's `onChange`; `dismiss` is called on back while the sheet is open.
 */
export function useSheetBackHandler(dismiss: () => void) {
  const [open, setOpen] = useState(false);
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    if (!open || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissRef.current();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  return useCallback((index: number) => setOpen(index >= 0), []);
}
