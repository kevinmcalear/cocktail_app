/** Names handed from a menu paste to Bring in. One pending list, cleared when that screen reads it. */
let staged: string[] | null = null;

export function stageBringIn(names: string[]): void {
  staged = names;
}

export function takeBringIn(): string[] | null {
  const names = staged;
  staged = null;
  return names;
}
