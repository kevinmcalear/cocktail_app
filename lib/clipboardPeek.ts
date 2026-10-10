/**
 * What's on the clipboard, for Bring in's "On your clipboard" card, without
 * asking: null when it can't be read quietly.
 *
 * ponytail: native needs expo-clipboard, a native module this build doesn't
 * have yet; until then the card shows on the web only.
 */
export async function peekClipboard(): Promise<string | null> {
  return null;
}
