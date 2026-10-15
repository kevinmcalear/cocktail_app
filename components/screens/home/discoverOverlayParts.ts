import { useEffect, type ReactNode } from 'react';
import { BackHandler, Platform, StyleSheet } from 'react-native';

import { STRETCH } from '@/components/ds/sheetDrag';
import { radius, space } from '@/constants/tokens';

export interface DiscoverOverlayProps {
  /** Names the dialog. Shown as the heading unless `head` replaces the heading row. */
  label: string;
  onClose: () => void;
  /** Phones: the whole screen (search), else a sheet up from the bottom over a scrim (filters, where). */
  full?: boolean;
  /** Top right of the heading row; Done when not given. */
  action?: ReactNode;
  /** Replaces the heading row (the search field and its Done). */
  head?: ReactNode;
  footer?: ReactNode;
  /** Wide web cards only: a pane beside the results (the ⌘K palette's preview). */
  aside?: ReactNode;
  children: ReactNode;
}

/** Android back and Escape on the web close the overlay. */
export function useOverlayKeys(onClose: () => void) {
  useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => (onClose(), true));
      return () => sub.remove();
    }
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

export const overlayStyles = StyleSheet.create({
  layer: { zIndex: 10 },
  flex: { flex: 1, minWidth: 0 },
  // The card has no height of its own, so its list shrinks to fit rather than filling it.
  shrink: { flexShrink: 1 },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 640,
    maxHeight: '80%',
    marginTop: '8%',
    paddingTop: space.lg,
    borderRadius: radius.sheet,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  // With a pane beside the results the card is wider, and the two share its height.
  wideCard: { maxWidth: 960 },
  body: { flexDirection: 'row', flexShrink: 1, minHeight: 0 },
  aside: { width: 400, paddingHorizontal: space.lg, paddingBottom: space.lg, borderLeftWidth: StyleSheet.hairlineWidth },
  // Phone-width web: the card keeps a margin to the window's edges.
  narrowCard: { width: 'auto', alignSelf: 'stretch', marginHorizontal: space.lg },
  sheet: {
    flex: 1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: 'continuous',
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stretch: { position: 'absolute', left: 0, right: 0, bottom: -STRETCH, height: STRETCH },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill, marginTop: space.md, marginBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gap: { gap: space.lg },
});
