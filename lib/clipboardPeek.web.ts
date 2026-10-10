/**
 * What's on the clipboard, for Bring in's "On your clipboard" card. Only when
 * the browser already lets this site read it: never a permission prompt just
 * for opening the sheet.
 */
export async function peekClipboard(): Promise<string | null> {
  try {
    const permissions = navigator.permissions as { query: (d: { name: string }) => Promise<{ state: string }> } | undefined;
    const state = permissions ? (await permissions.query({ name: 'clipboard-read' })).state : 'prompt';
    if (state !== 'granted' || !navigator.clipboard?.readText) return null;
    const text = (await navigator.clipboard.readText()).trim();
    return text ? text.slice(0, 20_000) : null;
  } catch {
    return null;
  }
}

/** Native only (iOS reads on tap); on the web the card already has the text. */
export const UNREAD_CLIP = '\u0000unread';

export async function readClipboard(): Promise<string | null> {
  return peekClipboard();
}
