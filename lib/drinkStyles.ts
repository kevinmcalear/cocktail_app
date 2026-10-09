/**
 * What kind of drink it is, for Discover's "all the Martinis", "gin drinks"
 * and "Old Fashioned twists": a drink's styles (the classic it's a version
 * of, or its family) and its spirits. Pure; checked by lib/drinkStyles.check.ts.
 *
 * Signals, strongest first: the catalog classic the drink is a version of
 * (riff_of_id), its name ("Mezcal Negroni"), its build (citrus and sugar
 * with no topper is a sour), and its description ("a take on the Gimlet").
 * Spirits come from the ingredient lines when a drink has them, else from
 * its name and description.
 */
import { foldName } from './discover';
import { NOTE_KINDS, noteDimension, noteKind, noteLabel, noteWord } from './flavor';

export interface DrinkFacts {
  name: string;
  description?: string | null;
  /** The catalog classic it's a version of ("Martini"). */
  riffOf?: string | null;
  /** Ingredient names, the named bottle and its generic both ("Roku Gin", "Gin"). */
  ingredients: readonly string[];
}

export interface Kind {
  id: string;
  /** Chip label: "Martinis", "Gin". */
  label: string;
}

interface StyleRule extends Kind {
  /** Catalog classics that make a drink this style. */
  classics: string[];
  /** Matches the drink's own name. */
  name?: RegExp;
  /** A build that makes it this style, from folded ingredient names. */
  build?: (has: (re: RegExp) => boolean) => boolean;
  /** Words in the description that say so on their own ("alcohol-free"). */
  text?: RegExp;
}

const CITRUS = /\b(lemon|lime|grapefruit|yuzu|citrus|sudachi|calamansi|verjus)\b(?! (twist|peel|zest|wheel|wedge|coin|leaf|oil))|\bacid\b/;
const SWEET = /syrup|sugar|honey|agave nectar|orgeat|grenadine|cordial|liqueur|triple sec|cointreau|cura[cç]ao|maraschino|falernum|oleo/;
const LONG = /soda|\btonic\b|ginger beer|ginger ale|\bcola\b|seltzer|sparkling water|lemonade|kombucha/;
const BUBBLES = /champagne|prosecco|cava|cremant|sparkling wine|\bsekt\b|lambrusco|franciacorta|pet[- ]nat/;
const APERITIVO = /aperol|campari|aperitiv|select aperitivo|bitter|vermouth|lillet|cocchi|amaro|suze/;

// Order is the chips' order: the drinks people ask for most first.
export const STYLES: readonly StyleRule[] = [
  { id: 'martini', label: 'Martinis', classics: ['Martini', 'Vesper', 'Tuxedo'], name: /(?<!espresso |porn ?star |pornstar |chocolate |appletini )\bmartini\b|\bgibson\b|\bvesper\b/ },
  { id: 'old-fashioned', label: 'Old Fashioneds', classics: ['Old Fashioned', 'Oaxaca Old Fashioned', 'Sazerac'], name: /old[- ]fashioned|sazerac/ },
  { id: 'negroni', label: 'Negronis', classics: ['Negroni', 'White Negroni', 'Boulevardier', 'Sbagliato', 'Americano', 'Milano Torino'], name: /negroni|boulevardier|sbagliato|americano\b/ },
  { id: 'manhattan', label: 'Manhattans', classics: ['Manhattan', 'Rob Roy', 'Brooklyn', 'Red Hook', 'Little Italy', 'Bobby Burns', 'Remember the Maine', 'Martinez', 'Vieux Carré', 'Hanky Panky'], name: /manhattan|rob roy|vieux carr|martinez/ },
  { id: 'margarita', label: 'Margaritas', classics: ['Margarita', "Tommy's Margarita"], name: /margarita/ },
  { id: 'daiquiri', label: 'Daiquiris', classics: ['Daiquiri', 'Hemingway Daiquiri'], name: /daiquiri/ },
  { id: 'mojito', label: 'Mojitos', classics: ['Mojito'], name: /mojito/ },
  { id: 'espresso-martini', label: 'Coffee cocktails', classics: ['Espresso Martini'], name: /espresso|coffee|carajillo/, build: (has) => has(/espresso|coffee|cold brew/) },
  {
    id: 'sour',
    label: 'Sours',
    classics: ['Whiskey Sour', 'Pisco Sour', 'New York Sour', 'Trinidad Sour', 'Clover Club', 'White Lady', 'Gold Rush', "Bee's Knees", 'Penicillin', 'Sidecar', 'Gimlet', 'Pegu Club', 'Aviation', 'Brandy Crusta', 'Lemon Drop', 'Jack Rose', 'Last Word', 'Naked and Famous', 'Paper Plane', 'Division Bell', 'Corpse Reviver #2', 'Bramble', 'Fitzgerald'],
    name: /\bsour\b|gimlet|sidecar|daisy|\bcrusta\b/,
    build: (has) => has(CITRUS) && has(SWEET) && !has(LONG) && !has(BUBBLES) && !has(/cream|milk/),
  },
  {
    id: 'highball',
    label: 'Highballs',
    classics: ['Moscow Mule', 'Paloma', 'Tom Collins', 'El Diablo', 'Ramos Gin Fizz'],
    name: /highball|collins|\bmule\b|\bfizz\b|rickey|\bbuck\b|paloma|& tonic|and tonic|\bg&t\b/,
    build: (has) => has(LONG) && !has(BUBBLES),
  },
  { id: 'spritz', label: 'Spritzes & bubbles', classics: ['Aperol Spritz', 'French 75', 'Bellini'], name: /spritz|french 75|bellini|royale?\b/, build: (has) => has(BUBBLES) || (has(APERITIVO) && has(/soda/)) },
  { id: 'tiki', label: 'Tiki', classics: ['Mai Tai', 'Bitter Mai Tai', 'Jungle Bird', 'Piña Colada', 'Trinidad Sour'], name: /tiki|zombie|mai tai|colada|swizzle|grog|painkiller|hurricane|scorpion/, text: /\btiki\b/ },
  { id: 'julep', label: 'Juleps & smashes', classics: ['Mint Julep', 'Caipirinha', "Ti' Punch"], name: /julep|smash|caipirinha|caipiroska/ },
  { id: 'zero-proof', label: 'Low & no', classics: [], name: /zero[- ]proof|alcohol[- ]free|non[- ]alcoholic|\bna\b/, text: /zero[- ]proof|alcohol[- ]free|non[- ]?alcoholic|spirit[- ]free|low[- ]abv|low[- ]alcohol|no[- ]abv/ },
];

interface SpiritRule extends Kind {
  match: RegExp;
}

// Base spirits and bitter aperitivi, as people shop for them.
export const SPIRITS: readonly SpiritRule[] = [
  { id: 'gin', label: 'Gin', match: /\bgin\b|genever|jenever|london dry|old tom|tanqueray|hendrick|beefeater|plymouth|monkey 47|\broku\b|sipsmith/ },
  { id: 'whiskey', label: 'Whiskey', match: /whisk(e)?y|bourbon|\brye\b|scotch|single malt|islay|laphroaig|ardbeg|lagavulin|talisker|hibiki|yamazaki|nikka|toki\b|jameson|highland park|macallan|buffalo trace|wild turkey|rittenhouse|woodford|makers mark|maker's mark/ },
  { id: 'agave', label: 'Tequila & mezcal', match: /tequila|mezcal|sotol|raicilla|bacanora|agave spirit|\b(blanco|reposado|a[nñ]ejo)\b(?! rum)|espad[ií]n|tobal[aá]/ },
  { id: 'rum', label: 'Rum', match: /\brum\b|\brhum\b|\bron\b|cacha[cç]a|agricole|clairin|arrack|grogue/ },
  { id: 'brandy', label: 'Brandy & cognac', match: /brandy|cognac|armagnac|calvados|pisco|grappa|applejack|eau[- ]de[- ]vie|singani|hennessy|r[eé]my martin|martell|courvoisier/ },
  { id: 'vodka', label: 'Vodka', match: /vodka|grey goose|belvedere|ketel one|absolut|eristoff/ },
  { id: 'sake', label: 'Sake & shochu', match: /\bsake\b|shochu|soju|baijiu|awamori|umeshu|junmai|ginjo/ },
  { id: 'aperitivo', label: 'Amaro & aperitivo', match: /campari|aperol|amaro|fernet|cynar|suze|aperitiv|gentian|vermouth|chartreuse|montenegro|averna|braulio|nonino/ },
];

const fold = (s: string | null | undefined) => foldName(s ?? '');
const folded = (classics: string[]) => new Set(classics.map(fold));
const CLASSICS_BY_STYLE = new Map(STYLES.map((s) => [s.id, folded(s.classics)]));

/** "twist on the Gimlet", "Negroni variation", "Martini-style": the description naming a classic it riffs on. */
function riffsOn(text: string, word: string): boolean {
  const w = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(twist|take|riff|spin|play|variation|version|variant|reworking|reimagining|interpretation|homage)s? on (a |an |the |the classic |a classic )?${w}\\b|\\b${w}[- ](variation|riff|twist|variant|style)|\\b(house|dirty|wet|dry|reverse|smoked|frozen|clarified|milk[- ]punch) ${w}\\b`
  ).test(text);
}

/** A drink's styles (ids from STYLES), strongest signal first, no repeats. */
export function stylesOf(drink: DrinkFacts): string[] {
  const name = fold(drink.name);
  const text = fold(drink.description);
  const riff = fold(drink.riffOf);
  const ings = drink.ingredients.map(fold).join(' | ');
  const has = (re: RegExp) => re.test(ings);
  const found: string[] = [];
  for (const s of STYLES) {
    const byRiff = !!riff && CLASSICS_BY_STYLE.get(s.id)!.has(riff);
    const byName = !!s.name && s.name.test(name);
    const byText = (!!s.text && s.text.test(text)) || s.classics.some((c) => riffsOn(text, fold(c)));
    const byBuild = !!s.build && drink.ingredients.length > 0 && s.build(has);
    if (byRiff || byName || byText || byBuild) found.push(s.id);
  }
  return found;
}

/** A drink's spirits (ids from SPIRITS): from its ingredient lines when it has them, else its name and description. */
export function spiritsOf(drink: DrinkFacts): string[] {
  const lines = drink.ingredients.map(fold).join(' | ');
  const fromLines = SPIRITS.filter((s) => s.match.test(lines)).map((s) => s.id);
  if (fromLines.length) return fromLines;
  const words = `${fold(drink.name)} | ${fold(drink.description)}`;
  return SPIRITS.filter((s) => s.match.test(words)).map((s) => s.id);
}

export const KINDS: readonly Kind[] = [...STYLES, ...SPIRITS];
const KIND_BY_ID = new Map(KINDS.map((k) => [k.id, k]));

export function kindLabel(id: string): string {
  return KIND_BY_ID.get(id)?.label ?? noteLabel(id) ?? id;
}

const NOTES: readonly Kind[] = NOTE_KINDS.map((d) => ({ id: noteKind(d), label: noteWord(d) }));

/**
 * Styles and spirits with a label word, or a classic's name, starting with
 * the search: "gin" finds Gin, "marg" Margaritas, "boulevardier" Negronis.
 * Notes also answer to their stored name, so "spicy" still finds Heat.
 */
export function findKinds(search: string): Kind[] {
  const q = fold(search);
  if (q.length < 2) return [];
  const wordStarts = (s: string) => fold(s).split(/[\s&]+/).some((w) => w.startsWith(q));
  const classicStarts = (id: string) => STYLES.find((s) => s.id === id)?.classics.some((c) => fold(c).startsWith(q)) ?? false;
  const noteStarts = (id: string) => !!noteDimension(id)?.startsWith(q);
  return [...KINDS, ...NOTES].filter((k) => wordStarts(k.label) || classicStarts(k.id) || noteStarts(k.id));
}
