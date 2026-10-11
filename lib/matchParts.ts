/**
 * Where a search's words fall in a name or a why line, so a row can light
 * them ("Plum *Negroni*"). Accents and case don't matter: "negroni" lights
 * "Négroni". Pure; checked by lib/matchParts.check.ts.
 */
import { foldName } from './discover';

export interface MatchPart {
  text: string;
  hit: boolean;
}

/**
 * `text` cut into plain and matched runs for `query`'s words (each word
 * anywhere, overlapping runs merged). One plain run when nothing matches,
 * the query is empty, or folding changed the text's length (a combining
 * accent), since the runs could no longer be cut in the right places.
 */
export function matchParts(text: string, query: string): MatchPart[] {
  const words = foldName(query).split(' ').filter((w) => w.length > 1);
  // Fold each character on its own: whole-string folding trims and squeezes spaces, which moves indexes.
  const folded = [...text].map((ch) => foldName(ch) || ch).join('');
  if (!words.length || folded.length !== text.length) return [{ text, hit: false }];
  const lit = new Array<boolean>(text.length).fill(false);
  for (const w of words) {
    for (let at = folded.indexOf(w); at >= 0; at = folded.indexOf(w, at + 1)) lit.fill(true, at, at + w.length);
  }
  const parts: MatchPart[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.hit === lit[i]) last.text += text[i];
    else parts.push({ text: text[i], hit: lit[i] });
  }
  return parts;
}
