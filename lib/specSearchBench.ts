/**
 * A synthetic venue and a typing run over it, for search's timings: in Node
 * by lib/specSearch.check.ts, and under Hermes on a phone or simulator by
 * the /dev/search-bench screen. Real classic and ingredient names, accents
 * included; 3 to 6 lines a drink.
 */
import { toSearchItem } from '@/lib/searchCards';
import { groupCatalog } from '@/lib/searchScope';
import { buildSearchIndex, rankHits, searchNames, searchNear } from '@/lib/specSearch';
import type { DatabaseItem } from '@/types/types';

const CLASSICS = [
  'Negroni', 'Boulevardier', 'Vieux Carré', 'Daiquiri', 'Old Fashioned', 'Manhattan', 'Martini', 'Dirty Martini', 'Gimlet',
  'Margarita', 'Paloma', 'Sazerac', 'Last Word', 'Paper Plane', 'Penicillin', 'Mai Tai', "Ti' Punch", 'Piña Colada',
  'Pisco Sour', 'Whiskey Sour', 'Clover Club', 'Aviation', 'Corpse Reviver No. 2', 'Jungle Bird', 'Espresso Martini',
  'Mojito', 'Caipirinha', 'Tom Collins', 'French 75', 'Bee’s Knees', 'Hanky Panky', 'Martinez', 'Americano', 'Spritz',
  'Bramble', 'Southside', 'Gin Fizz', 'Ramos Gin Fizz', 'Cosmopolitan', 'Mint Julep', 'Sidecar', 'Brandy Alexander',
  'Gold Rush', 'Naked and Famous', 'Oaxaca Old Fashioned', 'Café Brûlot', 'Zombie', 'Hurricane', 'Dark ’n’ Stormy',
  'Moscow Mule', 'Bloody Mary', 'Rob Roy', 'Toronto', 'Trinidad Sour', 'Garibaldi', 'Jack Rose', 'El Presidente',
];
const WORDS = ['Smoke', 'Velvet', 'Midnight', 'Garden', 'Copper', 'Little', 'House', 'Bitter', 'Golden', 'Saint', 'Wild', 'Night', 'Salt', 'Fig', 'Rose', 'Ember', 'Tide', 'Orchard', 'Cellar', 'Harbour'];
const INGREDIENTS = [
  'London Dry Gin', 'Campari', 'Sweet Vermouth', 'Dry Vermouth', 'Rye Whiskey', 'Bourbon', 'Cognac', 'Bénédictine',
  'Peychaud’s Bitters', 'Angostura Bitters', 'Lime Juice', 'Lemon Juice', 'Simple Syrup', 'Demerara Syrup', 'Orgeat',
  'Green Chartreuse', 'Yellow Chartreuse', 'Maraschino Liqueur', 'Aperol', 'Amaro Nonino', 'Mezcal', 'Blanco Tequila',
  'Reposado Tequila', 'Cointreau', 'Pisco', 'Egg White', 'Honey Syrup', 'Ginger Syrup', 'Islay Scotch', 'Blended Scotch',
  'Jamaican Rum', 'Agricole Rhum', 'Aged Rum', 'Pineapple Juice', 'Grapefruit Juice', 'Soda Water', 'Prosecco',
  'Crème de Violette', 'Crème de Cacao', 'Coffee Liqueur', 'Espresso', 'Absinthe', 'Fernet-Branca', 'Saline',
  'Carpano Antica Formula', 'Cocchi Americano', 'Lillet Blanc', 'Raspberry Syrup', 'Mint', 'Cucumber',
];
const METHODS = ['Shaken', 'Stirred', 'Built', 'Thrown', 'Blended', 'Swizzled'];
const GLASSES = ['Coupe', 'Nick and Nora', 'Rocks', 'Highball', 'Collins', 'Tiki Mug'];

/** `n` drinks (classics, then made-up house names) plus a house-made for every tenth, each with lines, a method and a glass. */
export function benchCorpus(n: number): DatabaseItem[] {
  const items: DatabaseItem[] = [];
  for (let i = 0; i < n; i++) {
    const name = i < CLASSICS.length ? CLASSICS[i] : `${WORDS[i % WORDS.length]} ${WORDS[(i * 7) % WORDS.length]} ${CLASSICS[i % CLASSICS.length]}`;
    const lines = 3 + (i % 4);
    items.push({
      id: `d${i}`,
      name,
      item_type: 'cocktail',
      recipes: Array.from({ length: lines }, (_, j) => ({ ingredient: { name: INGREDIENTS[(i * 3 + j * 11) % INGREDIENTS.length] } })),
      item_methods: [{ method: { name: METHODS[i % METHODS.length] } }],
      glassware: { id: 'g', name: GLASSES[i % GLASSES.length] },
    } as unknown as DatabaseItem);
    if (i % 10 === 0) {
      items.push({ id: `h${i}`, name: `House ${INGREDIENTS[i % INGREDIENTS.length]}`, item_type: 'ingredient', ingredient_role: 'prep', brand_maker: i % 20 === 0 ? 'Carpano' : null } as unknown as DatabaseItem);
    }
  }
  return items;
}

/** What a bartender types, letter by letter. */
export const TYPED = ['n', 'neg', 'negroni', 'carre', 'vieux carre', 'campari', 'sweet ver', 'old fash', 'stirred', 'coupe', 'house', 'pina', 'mezcal', 'gin', 'rye', 'espresso', 'smoke', 'last word', 'carpano', 'jungle'];

const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs: number[]) => xs.sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];

export interface BenchResult {
  docs: number;
  buildMs: number;
  /** Tiers 1 and 2 plus ranking, per typed letter. */
  keystroke: { p50: number; p95: number; max: number; letters: number };
  /** Tier 3 (near misses), per settled query of three letters or more. */
  near: { p50: number; p95: number; max: number };
  /** The plain match over the same rows as search cards (groupCatalog: home mode, and every venue before the book), per typed letter. */
  plain: { p50: number; p95: number; max: number } | null;
}

/** Builds the index for `n` drinks, then types every query in TYPED letter by letter, `rounds` times. */
export function runSearchBench(n: number, now: () => number, rounds = 3): BenchResult {
  const items = benchCorpus(n);
  const b0 = now();
  const index = buildSearchIndex('bench', items);
  const buildMs = now() - b0;
  const cards = items.flatMap((item) => toSearchItem(item) ?? []);
  const keys: number[] = [];
  const near: number[] = [];
  const plain: number[] = [];
  for (let r = 0; r < rounds; r++) {
    for (const typed of TYPED) {
      for (let i = 1; i <= typed.length; i++) {
        const q = typed.slice(0, i);
        const t0 = now();
        rankHits(searchNames(index, q));
        keys.push(now() - t0);
        // One round, the venue only: its A to Z sort is slow under Hermes on Android, and three rounds of 3,000 hold the screen for minutes.
        if (r === 0 && n <= 1000) {
          const p0 = now();
          groupCatalog(cards, q);
          plain.push(now() - p0);
        }
      }
      const found = new Set(searchNames(index, typed).map((h) => h.item.id!));
      const t1 = now();
      searchNear(index, typed, found);
      near.push(now() - t1);
    }
  }
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return {
    docs: items.length,
    buildMs: round(buildMs),
    keystroke: { p50: round(median(keys)), p95: round(p95(keys)), max: round(Math.max(...keys)), letters: keys.length },
    near: { p50: round(median(near)), p95: round(p95(near)), max: round(Math.max(...near)) },
    plain: plain.length ? { p50: round(median(plain)), p95: round(p95(plain)), max: round(Math.max(...plain)) } : null,
  };
}
