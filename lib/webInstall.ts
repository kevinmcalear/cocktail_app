import { Platform } from 'react-native';

/** Chrome's install event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * How this browser adds a web app to the home screen:
 * - installed: already running from the home screen (or the native app)
 * - prompt: Chrome/Edge/Android, which offer an install dialog
 * - ios: Safari and other iOS browsers, through Share > Add to Home Screen
 * - android: Android browsers without Chrome's dialog (yet), through the browser menu
 * - desktop: computers without an install dialog, where we point to a phone
 */
export type InstallMode = 'installed' | 'prompt' | 'ios' | 'android' | 'desktop';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

// Chrome can fire this before the page renders, so listen from load. Only
// the venue page offers its own install button; elsewhere Chrome's own
// install UI is left alone.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!window.location.pathname.startsWith('/v/')) return;
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn());
  });
  // Opening the just-installed app from Chrome's dialog switches display mode.
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => {
    listeners.forEach((fn) => fn());
  });
}

export function isRunningInstalled(): boolean {
  if (Platform.OS !== 'web') return true;
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function installMode(): InstallMode {
  if (isRunningInstalled()) return 'installed';
  if (typeof window === 'undefined') return 'desktop';
  if (deferredPrompt) return 'prompt';
  if (isIOS()) return 'ios';
  if (/Android/.test(navigator.userAgent)) return 'android';
  return 'desktop';
}

/** Re-render when the install prompt becomes available or is used. */
export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Show Chrome's install dialog. Resolves true if the user installed. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  deferredPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  listeners.forEach((fn) => fn());
  return outcome === 'accepted';
}
