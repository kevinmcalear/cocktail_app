import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { BrandProvider, useToast } from '@/components/ds';
import { DEFAULT_ACCENT } from '@/constants/tokens';
import type { NotePhoto } from '@/hooks/useSendNote';
import { newDraftId } from '@/lib/drinkWizard';
import { captureAppScreen, listenForScreenshots } from '@/lib/screenshots';

import { NoteSheet, type NoteAbout } from './NoteSheet';

/**
 * Report a problem from a screenshot (board Screenshot report): take a phone
 * screenshot anywhere and a toast asks "Send this to the Cocktail team?".
 * Send opens Report a problem with that screen already attached, sent with
 * the page it came from. Mounted once at the root, signed in. In the
 * Cocktail accent, not the venue's: it's a note to us.
 */
export function ScreenshotReportHost() {
  return (
    <BrandProvider accent={DEFAULT_ACCENT} accentText="ink">
      <Host />
    </BrandProvider>
  );
}

function Host() {
  const toast = useToast();
  // The page as a path (/cocktail/<id>), so we can open the same one.
  const pathname = usePathname();
  const [report, setReport] = useState<{ photo: NotePhoto; about: NoteAbout } | null>(null);
  const [open, setOpen] = useState(false);
  // Read when a screenshot lands, not when the listener was made.
  const latest = useRef({ pathname, open, toast });
  useEffect(() => {
    latest.current = { pathname, open, toast };
  });

  useEffect(() => {
    const stop = listenForScreenshots(() => {
      // A screenshot of the report sheet itself isn't a new report.
      if (latest.current.open) return;
      const screen = latest.current.pathname.slice(0, 120);
      void captureAppScreen().then((uri) => {
        if (!uri) return;
        latest.current.toast.show({
          title: 'Send this to the Cocktail team?',
          detail: 'Your screenshot goes with a note.',
          action: {
            label: 'Send',
            onPress: () => {
              setReport({ photo: { uri, id: newDraftId(), type: 'image/jpeg' }, about: { screen, label: 'your screenshot' } });
              setOpen(true);
            },
          },
        });
      });
    });
    return stop ?? undefined;
  }, []);

  if (!report) return null;
  // Keyed by the screenshot, so each one opens a fresh sheet with its own picture.
  return <NoteSheet key={report.photo.id} visible={open} onClose={() => setOpen(false)} about={report.about} report={{}} photo={report.photo} />;
}
