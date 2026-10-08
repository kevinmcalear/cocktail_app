/**
 * The cocktail family tree browser: every catalog classic and historic style,
 * grouped by family and laid out parent first. Pure, so ordering, folding and
 * search are checked without a database (lib/drinkTree.check.ts). The data
 * comes from hooks/useDrinkTree.ts.
 */

export const FAMILIES = [
  { key: 'oldfashioned', name: 'Old Fashioned', blurb: 'Spirit, sugar, bitters. Slings, toddies and juleps.' },
  { key: 'martini', name: 'Martini & Manhattan', blurb: 'Spirit and aromatized wine, stirred.' },
  { key: 'negroni', name: 'Negroni & aperitivo', blurb: 'Vermouth and bitter, from Milan and Turin.' },
  { key: 'sour', name: 'Sour & Daiquiri', blurb: 'Spirit, citrus and sugar.' },
  { key: 'sidecar', name: 'Sidecar & Daisy', blurb: 'Spirit, citrus and a liqueur. Crustas and equal parts.' },
  { key: 'highball', name: 'Highball & sparkling', blurb: 'Collins, fizz, buck, spritz and champagne.' },
  { key: 'tiki', name: 'Punch, swizzle & tiki', blurb: 'Rum punch, the Caribbean and Don the Beachcomber.' },
  { key: 'flip', name: 'Flip, cream & duos', blurb: 'Egg, cream, coffee, and a spirit with a liqueur.' },
] as const;

export type FamilyKey = (typeof FAMILIES)[number]['key'];

export interface TreeNode {
  /** "s:<id>" for a style, "d:<id>" for a drink. */
  key: string;
  id: string;
  kind: 'style' | 'drink';
  name: string;
  year: number | null;
  approx: boolean;
  /** A family key, or "trunk" for Punch. */
  family: string;
  parentKey: string | null;
  note: string | null;
  creator: string | null;
  /** Profile ids, for links to /p/<id>. */
  creatorId: string | null;
  bar: string | null;
  barId: string | null;
  barClosed: boolean;
  /** Bars' versions linked to it. */
  versions: number;
}

export interface TreeRow {
  node: TreeNode;
  depth: number;
  hasKids: boolean;
  /** Its parent lives in another family (the Fizz comes from the Sour). */
  from: TreeNode | null;
}

const byYear = (a: TreeNode, b: TreeNode) => (a.year ?? 9999) - (b.year ?? 9999) || a.name.localeCompare(b.name);

/** Children by parent key, oldest first. */
export function childrenOf(nodes: readonly TreeNode[]): Map<string, TreeNode[]> {
  const kids = new Map<string, TreeNode[]>();
  for (const n of nodes) if (n.parentKey) kids.set(n.parentKey, [...(kids.get(n.parentKey) ?? []), n]);
  for (const list of kids.values()) list.sort(byYear);
  return kids;
}

/**
 * One family as rows, parent first. Roots are the family's nodes whose parent
 * is missing or in another family. Folded nodes keep their row but hide
 * everything under them.
 */
export function familyRows(nodes: readonly TreeNode[], family: string, folded: ReadonlySet<string> = new Set()): TreeRow[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const kids = childrenOf(nodes);
  const inFamily = nodes.filter((n) => n.family === family);
  const roots = inFamily.filter((n) => !n.parentKey || byKey.get(n.parentKey)?.family !== family).sort(byYear);
  const rows: TreeRow[] = [];
  const seen = new Set<string>();
  const walk = (n: TreeNode, depth: number) => {
    if (seen.has(n.key)) return;
    seen.add(n.key);
    const mine = (kids.get(n.key) ?? []).filter((k) => k.family === family);
    const parent = n.parentKey ? (byKey.get(n.parentKey) ?? null) : null;
    rows.push({ node: n, depth, hasKids: mine.length > 0, from: parent && parent.family !== family ? parent : null });
    if (!folded.has(n.key)) mine.forEach((k) => walk(k, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  return rows;
}

/** Keys from the root down to this node, so a focused drink can be unfolded. */
export function pathTo(nodes: readonly TreeNode[], key: string): string[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const path: string[] = [];
  let next = byKey.get(key);
  while (next && !path.includes(next.key)) {
    path.unshift(next.key);
    next = next.parentKey ? byKey.get(next.parentKey) : undefined;
  }
  return path;
}

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Drinks and styles whose name, maker or bar contains the query; names first. */
export function searchTree(nodes: readonly TreeNode[], query: string, limit = 8): TreeNode[] {
  const q = fold(query.trim());
  if (!q) return [];
  const score = (n: TreeNode) => (fold(n.name).startsWith(q) ? 0 : fold(n.name).includes(q) ? 1 : fold(`${n.creator ?? ''} ${n.bar ?? ''}`).includes(q) ? 2 : -1);
  return nodes
    .map((n) => ({ n, s: score(n) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || byYear(a.n, b.n))
    .slice(0, limit)
    .map((x) => x.n);
}

/** "c. 1880 · Jerry Thomas · Pegu Club (closed) · 13 bar versions". */
export function rowMeta(n: TreeNode): string {
  return [
    n.year ? `${n.approx ? 'c. ' : ''}${n.year}` : null,
    n.creator,
    n.bar ? `${n.bar}${n.barClosed ? ' (closed)' : ''}` : null,
    n.versions ? `${n.versions} bar version${n.versions === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The family a focused drink or style opens on, or the first family. */
export function familyFor(nodes: readonly TreeNode[], focus: string | null | undefined): FamilyKey {
  const hit = focus ? nodes.find((n) => n.id === focus || n.key === focus) : undefined;
  return (FAMILIES.find((f) => f.key === hit?.family)?.key ?? FAMILIES[0].key) as FamilyKey;
}
