// Its own file, not lib/searchScope.ts: sign-out clears the recent searches from the root layout
// (lib/clearUserData.ts), so whatever the store imports is on every page's first load.

const RECENT_SEARCHES = 8;

/** Keeps a word you searched: newest first, once, however it was typed. A letter isn't a search yet. */
export function rememberSearch(terms: readonly string[], term: string): string[] {
  const word = term.trim();
  if (word.length < 2) return [...terms];
  return [word, ...terms.filter((t) => t.toLowerCase() !== word.toLowerCase())].slice(0, RECENT_SEARCHES);
}
