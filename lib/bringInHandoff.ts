/** Drinks handed from a menu paste to Bring in, as its list text (lib/paste bringInText). Cleared when that screen reads it. */
let staged: string | null = null;

export function stageBringIn(text: string): void {
  staged = text;
}

export function takeBringIn(): string | null {
  const text = staged;
  staged = null;
  return text;
}
