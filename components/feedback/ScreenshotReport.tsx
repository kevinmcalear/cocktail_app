import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { BrandProvider, GlassButton, useToast } from '@/components/ds';
import { DEFAULT_ACCENT, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import type { NotePhoto } from '@/hooks/useSendNote';
import { newDraftId } from '@/lib/drinkWizard';
import { captureAppScreen, listenForScreenshots, NOT_IN_SCREENSHOT } from '@/lib/screenshots';
import { useToastStore } from '@/store/useToastStore';

import { NoteSheet, type NoteAbout } from './NoteSheet';

/** About how long the toast's spring takes to slide it away. */
const TOAST_GONE_MS = 350;

/**
 * Report a problem from a screenshot (board Screenshot report): take a phone
 * screenshot anywhere and a toast asks "Send this to the Cocktail team?".
 * Send opens Report a problem with that screen already attached, sent with
 * the page it came from. The web can't see a screenshot, so on the wide web
 * a Feedback button in the corner takes the picture instead and opens the
 * same sheet straight away. Mounted once at the root, signed in. In the
 * Cocktail accent, not the venue's: it's a note to us.
 */
export function ScreenshotReportHost() {
  return (
    <BrandProvider accent={DEFAULT_ACCENT}>
      <Host />
    </BrandProvider>
  );
}

function Host() {
  const toast = useToast();
  const wideWeb = useIsWideWeb();
  const [taking, setTaking] = useState(false);
  // The page as a path (/cocktail/<id>), so we can open the same one.
  const pathname = usePathname();
  const [report, setReport] = useState<{ id: string; photo?: NotePhoto; about: NoteAbout } | null>(null);
  const [open, setOpen] = useState(false);
  // Read when a screenshot lands, not when the listener was made.
  const latest = useRef({ pathname, open, toast });
  useEffect(() => {
    latest.current = { pathname, open, toast };
  });

  // A null uri (a picture that couldn't be drawn) still opens the sheet, without one.
  const openReport = (uri: string | null, screen: string, label: string) => {
    const id = newDraftId();
    setReport({ id, photo: uri ? { uri, id, type: 'image/jpeg' } : undefined, about: { screen: screen.slice(0, 120), label } });
    setOpen(true);
  };

  useEffect(() => {
    const stop = listenForScreenshots(() => {
      // A screenshot of the report sheet itself isn't a new report.
      if (latest.current.open) return;
      const screen = latest.current.pathname;
      // A toast showing (the last screenshot's) shouldn't be in this picture: take it down and let it slide away first.
      const toastUp = !!useToastStore.getState().toast;
      if (toastUp) latest.current.toast.hide();
      void new Promise((resolve) => setTimeout(resolve, toastUp ? TOAST_GONE_MS : 0)).then(captureAppScreen).then((uri) => {
        if (!uri) return;
        latest.current.toast.show({
          title: 'Send this to the Cocktail team?',
          detail: 'Your screenshot goes with a note.',
          action: {
            label: 'Send',
            onPress: () => openReport(uri, screen, 'your screenshot'),
          },
        });
      });
    });
    return stop ?? undefined;
  }, []);

  // The button is left out of its own picture (NOT_IN_SCREENSHOT).
  const takeAndOpen = async () => {
    if (taking) return;
    setTaking(true);
    const uri = await captureAppScreen();
    setTaking(false);
    openReport(uri, pathname, 'this page');
  };

  return (
    <>
      {Platform.OS === 'web' && wideWeb && !open ? (
        <View nativeID={NOT_IN_SCREENSHOT} style={styles.corner}>
          <GlassButton label={taking ? 'One moment…' : 'Feedback'} icon="bubble.left" accessibilityLabel="Send feedback with a picture of this page" onPress={() => void takeAndOpen()} />
        </View>
      ) : null}
      {/* Keyed by the screenshot, so each one opens a fresh sheet with its own picture. */}
      {report ? <NoteSheet key={report.id} visible={open} onClose={() => setOpen(false)} about={report.about} report={{}} photo={report.photo} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', right: space.xl, bottom: space.xl },
});
