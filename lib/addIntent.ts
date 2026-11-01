import { isLink } from './bringIn';

/**
 * What Add's one field was given: a drink's name ("Smoke Signal"), which opens
 * a draft of that name, or something to read (a link, a pasted spec, "a
 * negroni but with mezcal"), which Bring in reads.
 * ponytail: a word-count guess; if people describe drinks in four words or
 * fewer, the draft page's Did you mean still catches the classic.
 */
export function addIntent(text: string): 'name' | 'read' | null {
  const t = text.trim();
  if (!t) return null;
  if (isLink(t) || t.includes('\n') || /\d/.test(t) || /[,;:]/.test(t)) return 'read';
  const words = t.split(/\s+/);
  if (words.length > 4 || words.some((w) => /^(with|but|and|like|instead|without|less|more|plus)$/i.test(w))) return 'read';
  return 'name';
}

/** "instagram.com/reel/C9x…": a copied link or text, short enough for one line. */
export function clipLine(clip: string, max = 28): string {
  const t = clip.trim().replace(/^https?:\/\/(www\.)?/i, '').replace(/\s+/g, ' ');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
