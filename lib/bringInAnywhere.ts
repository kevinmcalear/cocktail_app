// What a drop or a paste outside any text box brings in (web and the desktop
// shell): photos and PDFs, or a block of text that could be drinks. Pure; the
// listener is components/nav/BringInAnywhere.

const MAX_FILES = 4;

/** Photos and PDFs: what read-anything takes. */
export const isReadableFile = (mimeType: string) => mimeType.startsWith('image/') || mimeType === 'application/pdf';

/**
 * The files to read (their indexes, at most four), else the text, else
 * nothing. Text has to look like more than a word: two lines, a sentence,
 * or a link (Bring in offers to read it).
 */
export function bringInChoice(files: readonly { type: string }[], text: string | null): { files: number[] } | { text: string } | null {
  const keep = files.flatMap((file, i) => (isReadableFile(file.type) ? [i] : [])).slice(0, MAX_FILES);
  if (keep.length) return { files: keep };
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;
  if (isLink(trimmed)) return { text: trimmed };
  const lines = trimmed.split('\n').filter((line) => line.trim()).length;
  return lines >= 2 || trimmed.length >= 20 ? { text: trimmed } : null;
}

/** A lone web link, which Bring in can fetch and read. */
export const isLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

/** A paste aimed at a text box, or a drop on a drop zone that already took it, is left alone. */
export function isEditable(target: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!target) return false;
  return target.isContentEditable === true || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}
