// Web can't tell when someone takes a screenshot, so there's nothing to listen
// for: the Feedback button (components/feedback/ScreenshotReport.tsx) asks for
// the picture instead. It's drawn from the page itself (modern-screenshot, as
// Unclouded's feedback box does), so there's no screen sharing to allow. A
// file of its own, so react-native-view-shot (whose web build needs
// html2canvas-pro) never reaches the web bundle. Same exports as screenshots.ts.

/** An element with this id is left out of the picture, such as the Feedback button itself. */
export const NOT_IN_SCREENSHOT = 'not-in-screenshot';

/** No wider than this, which keeps the upload small. */
const MAX_WIDTH = 2400;
// Long enough for a slow image or font, short enough that a stuck one doesn't leave the person waiting.
const CAPTURE_MS = 15_000;
// Drawn in place of an image that's off screen: one clear pixel, so nothing is downloaded.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function listenForScreenshots(_onScreenshot: () => void): (() => void) | null {
  return null;
}

/** Whether a box (from getBoundingClientRect) shows any part of itself in a window this size. */
export function onScreen(box: { top: number; right: number; bottom: number; left: number }, width: number, height: number): boolean {
  return box.bottom > 0 && box.right > 0 && box.top < height && box.left < width && box.right > box.left && box.bottom > box.top;
}

// A long list of drink pictures shouldn't all be fetched for a picture that only shows a few.
function offScreenImages(): Set<string> {
  const seen = new Set<string>();
  const off = new Set<string>();
  for (const img of Array.from(document.images)) {
    const url = img.currentSrc || img.src;
    if (!url) continue;
    (onScreen(img.getBoundingClientRect(), window.innerWidth, window.innerHeight) ? seen : off).add(url);
  }
  seen.forEach((url) => off.delete(url));
  return off;
}

/**
 * The page as it looks now, scrolled where it is, as a JPEG blob: URL, or
 * null when it can't be drawn (a tab left open across a release asks for a
 * file that's gone, or the page took too long).
 */
export async function captureAppScreen(): Promise<string | null> {
  const page = document.body;
  let timer = 0;
  try {
    // Loaded the first time it's needed, not with every page.
    const { domToBlob } = await import('modern-screenshot');
    const skip = offScreenImages();
    const blob = await Promise.race([
      domToBlob(page, {
        type: 'image/jpeg',
        quality: 0.85,
        scale: Math.min(window.devicePixelRatio || 1, MAX_WIDTH / Math.max(1, page.clientWidth)),
        backgroundColor: getComputedStyle(page).backgroundColor,
        filter: (node) => !(node instanceof Element && node.id === NOT_IN_SCREENSHOT),
        fetchFn: async (url) => (skip.has(url) ? BLANK : false),
        // The app scrolls inside its panels, not the window: draw each where it's scrolled to.
        features: { restoreScrollPosition: true },
      }),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error('timed out')), CAPTURE_MS);
      }),
    ]);
    return URL.createObjectURL(blob);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
