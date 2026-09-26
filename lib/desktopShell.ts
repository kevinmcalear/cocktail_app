import { Platform } from 'react-native';

/**
 * Whether the web app is running inside the Tauri desktop shell (desktop/).
 * The shell serves the bundle from tauri://localhost (http://tauri.localhost
 * on Windows), so links meant for other people or for email must use the
 * public site instead of the current origin.
 */
export function isDesktopShell(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
