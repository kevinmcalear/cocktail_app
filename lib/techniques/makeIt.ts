/**
 * "Make it in house": a name typed into a spec that isn't on the shelf
 * ("Clarified grapefruit", "Brown butter bourbon") and the techniques that
 * would make it. Choosing one gives the new ingredient a prep card: its
 * action tag, how long it takes, and the steps with the amounts for a batch.
 */
import { guessKind } from '../prepKinds';
import type { PREP_ACTIONS } from '../scale';
import { formatDose, scaleParts, techniqueById, TECHNIQUES } from './index';
import type { BaseKind, Technique, TechniqueGroup } from './types';

type PrepAction = (typeof PREP_ACTIONS)[number];

const SPIRIT = 'rum|rhum|gin|vodka|whiske?y|bourbon|rye|scotch|tequila|mezcal|brandy|cognac|pisco|cachaça|cachaca|aquavit|vermouth|sherry|campari|aperol|amaro|spirit';

/**
 * Words in a name → the techniques that make it, most likely first. `mod`
 * marks words that change something ("smoked", "clarified"): they lead over
 * what's being changed ("syrup"), so a smoked syrup is smoked first.
 */
const RULES: { test: RegExp; ids?: string[]; group?: TechniqueGroup; mod?: true }[] = [
  { test: /(coconut|soy|soya|oat|almond|rice|pea|plant)[- ]milk[- ]?(wash|punch)|vegan[- ]wash|dairy[- ]free (milk )?punch/, ids: ['vegan-wash', 'milk-wash'], mod: true },
  { test: /(milk|yogh?urt|whey|cream|buttermilk|ricotta|cheese)[- ]?wash|milk punch/, ids: ['milk-wash', 'vegan-wash'], mod: true },
  { test: /clarif/, ids: ['agar-quick', 'centrifuge', 'gelatin-freeze-thaw', 'agar-freeze-thaw', 'milk-wash'], mod: true },
  { test: /freeze[- ]?thaw/, ids: ['agar-freeze-thaw', 'gelatin-freeze-thaw'], mod: true },
  { test: /tomato water|consomm/, ids: ['gelatin-freeze-thaw', 'agar-freeze-thaw'] },
  { test: /\bspun\b|spinzall|centrifug|pectinex/, ids: ['centrifuge'], mod: true },
  { test: /(fat|butter|bacon|oil|ghee|duck|lard)[- ]?wash|brown butter/, ids: ['fat-wash'], mod: true },
  { test: new RegExp(`\\b(bacon|butter|ghee|duck fat|lard|schmaltz)\\b.*\\b(${SPIRIT})\\b`), ids: ['fat-wash'], mod: true },
  // "Coconut-washed rum", "pistachio washed gin": a wash with no milk word is a fat wash.
  { test: /\bwash(ed)?\b/, ids: ['fat-wash'], mod: true },
  { test: /\bair\b/, ids: ['lecithin-air'] },
  { test: /foam|espuma/, group: 'foam' },
  { test: /sour syrup/, ids: ['sour-syrup'] },
  { test: /tincture|bitters/, ids: ['tincture'] },
  { test: /sous[- ]?vide/, ids: ['sous-vide-infusion'], mod: true },
  { test: /\b(nitro|nitrous|isi|rapid)\b/, ids: ['nitrous-infusion'], mod: true },
  { test: /macerat|cold[- ]?brew/, ids: ['cold-infusion'], mod: true },
  { test: /infus|steeped/, ids: ['cold-infusion', 'nitrous-infusion', 'sous-vide-infusion', 'vacuum-infusion'], mod: true },
  { test: /compress/, ids: ['vacuum-infusion'], mod: true },
  { test: /smok/, ids: ['smoke'], mod: true },
  { test: /carbonated|sparkling|fizzy/, ids: ['force-carbonate'], mod: true },
  { test: /rotovap|rotary|redistil|hydrosol|distill/, ids: ['rotovap'], mod: true },
  { test: /cryo|concentrat/, ids: ['freeze-concentrate'], mod: true },
  { test: /acid[- ]?adjust|acid solution/, ids: ['acid-adjust'], mod: true },
  { test: /lacto|ferment/, ids: ['lacto-ferment'], mod: true },
  { test: /pickle|cocktail onion|gibson onion|\bbrine\b/, ids: ['quick-pickle'], mod: true },
  { test: /dried|dehydrated/, ids: ['dehydrated-citrus'], mod: true },
  { test: /suspended|fluid gel|floating/, ids: ['suspension'] },
  { test: /\boil\b/, ids: ['infused-oil'] },
  { test: /oleo/, ids: ['oleo-saccharum'] },
  { test: /cordial/, ids: ['cordial'] },
  { test: /shrub|drinking vinegar/, ids: ['shrub'] },
  { test: /orgeat|almond syrup/, ids: ['orgeat'] },
  { test: /grenadine|pomegranate syrup/, ids: ['grenadine'] },
  { test: /gomme|gum syrup/, ids: ['gomme'] },
  { test: /saline|salt solution/, ids: ['saline'] },
  { test: /body syrup|xanthan syrup|mouthfeel/, ids: ['body-syrup'] },
  { test: /(honey|agave) syrup/, ids: ['honey-syrup'] },
  { test: /syrup/, ids: ['syrup-by-weight', 'blender-syrup'] },
  { test: /tepache/, ids: ['tepache'] },
  { test: /kombucha|scoby/, ids: ['kombucha'] },
  { test: /powder/, ids: ['fat-powder'] },
  { test: /sphere|caviar|pearls/, ids: ['reverse-spheres'] },
];

/** Other names that are just an ingredient, so they don't make a technique on their own. */
const NOT_ALIASES = new Set(['olive oil', 'gum arabic', 'tapioca maltodextrin', 'soy lecithin']);
/** Every technique's other names of two words or more ("bacon bourbon", "herb oil"), as whole phrases. */
const ALIASES = TECHNIQUES.flatMap((t) => (t.also ?? []).filter((a) => a.includes(' ') && !NOT_ALIASES.has(a)).map((a) => ({ t, re: new RegExp(`\\b${a}\\b`) })));

/**
 * Bought, not made: a name that only looks like a prep. Brands of bitters
 * and syrups, bottled sparkling things, brines and salts off the shelf.
 * ponytail: a word list; a catalog flag (product vs prep) is the upgrade.
 */
const BOUGHT = new RegExp([
  'sparkling (wine|water|sake|cider)', 'soda water', 'club soda', 'tonic', 'champagne', 'prosecco', '\\bcava\\b',
  'angostura', 'peychaud', "regan'?s", 'fee brothers', 'bitter truth', "scrappy'?s", 'bittermens', 'dashfire', "bob'?s bitters", 'hella bitters',
  'maple syrup', 'monin', 'giffard', 'torani', 'fabbri', 'small hand foods', 'liber (&|and) co', 'orgeat works', 'latitude 29', 'bg reynolds',
  'golden syrup', 'corn syrup', 'cane syrup', 'date syrup', 'rice syrup', 'chocolate syrup',
  "rose'?s", 'olive brine', 'caper brine', 'smoked (sea )?salt', 'smoked paprika', 'liquid smoke',
  '^(extra virgin )?(olive|sesame|coconut|vegetable|sunflower|canola|grapeseed|neutral|avocado|rapeseed|peanut) oil$', 'essential oil',
].join('|'));

/** A name of something bought, never a house prep: Angostura bitters, Monin syrup, Sparkling wine. */
export function isBoughtName(name: string): boolean {
  return BOUGHT.test(name.trim().toLowerCase().replace(/[’`]/g, "'"));
}

/** What a name says it starts from: a spirit, a juice, or nothing we can tell. */
/** What a name is, for what a technique can change: a spirit ("white rum") or a juice; null when it doesn't say. */
export function startsFrom(n: string): BaseKind | null {
  n = n.toLowerCase();
  if (new RegExp(`\\b(${SPIRIT})\\b`).test(n)) return 'spirit';
  if (/juice|\b(lime|lemon|grapefruit|orange|yuzu|pineapple|apple|pear|tomato|watermelon|cucumber|strawberr|raspberr|mango|peach|cherr|citrus)/.test(n)) return 'juice';
  return null;
}
/** The bases a technique can start from, for a line of each kind. */
export const FITS: Partial<Record<BaseKind, BaseKind[]>> = { spirit: ['spirit', 'wine'], juice: ['juice', 'produce'] };

/**
 * The techniques that would make a typed name, without repeats; none for an
 * ordinary name, a bought one, or a method (a dry shake is never an
 * ingredient). Words that change something lead, then what fits the base:
 * a clarified rum is milk washed before it's agar clarified.
 */
export function waysToMake(name: string): Technique[] {
  const n = name.trim().toLowerCase().replace(/[’`]/g, "'");
  if (!n || isBoughtName(n)) return [];
  const found: { t: Technique; mod: boolean }[] = [];
  const add = (t: Technique | undefined, mod: boolean) => {
    if (t && !t.method && !found.some((f) => f.t === t)) found.push({ t, mod });
  };
  for (const r of RULES) {
    if (!r.test.test(n)) continue;
    const list = r.group ? TECHNIQUES.filter((t) => t.group === r.group) : (r.ids ?? []).map((id) => techniqueById(id));
    for (const t of list) add(t, !!r.mod);
  }
  // Every technique's other names reach it too ("bacon bourbon", "herb oil"), whole phrases of two words or more.
  for (const { t, re } of ALIASES) if (re.test(n)) add(t, false);
  const kind = startsFrom(n);
  const fit = (t: Technique) => (!kind || !t.starts ? 0 : FITS[kind]?.includes(t.starts) ? 0 : t.starts === 'liquid' ? 1 : 2);
  return found
    .map((f, i) => ({ ...f, i }))
    .sort((a, b) => Number(b.mod) - Number(a.mod) || fit(a.t) - fit(b.t) || a.i - b.i)
    .map((f) => f.t);
}

/**
 * Should a typed name offer "Make in house"? Its kind (a shrub) or a
 * technique says it's made, and it isn't a bought bottle.
 */
export function looksMadeInHouse(name: string): boolean {
  if (isBoughtName(name)) return false;
  return !!guessKind(name) || waysToMake(name).length > 0;
}

const BY_ID: Record<string, PrepAction> = {
  centrifuge: 'Centrifuge', 'milk-wash': 'Milk wash', 'vegan-wash': 'Milk wash', 'fat-wash': 'Fat wash',
  'sous-vide-infusion': 'Sous vide', 'dehydrated-citrus': 'Dehydrate', 'quick-pickle': 'Mix', 'blender-syrup': 'Blend',
  smoke: 'Smoke', tincture: 'Tincture', 'infused-oil': 'Oil',
};
const BY_GROUP: Record<TechniqueGroup, PrepAction> = {
  foam: 'Foam', clarify: 'Clarify', wash: 'Fat wash', infuse: 'Infuse', syrup: 'Syrup', texture: 'Mix',
  carbonate: 'Carbonate', cold: 'Freeze', preserve: 'Ferment', distil: 'Distil',
};

/** The prep card tag for a technique, so the card links back to it. */
export function actionFor(t: Technique): PrepAction {
  return BY_ID[t.id] ?? BY_GROUP[t.group];
}

export interface TechniquePrepCard {
  actions: string[];
  leadMinutes: number;
  leadNote: string;
  steps: { body: string; timer_seconds: number | null }[];
}

/** A new house prep's card from a technique: the amounts for its usual batch first, then the steps. */
export function prepCardFor(t: Technique): TechniquePrepCard {
  const steps: TechniquePrepCard['steps'] = [];
  if (t.base && t.parts) {
    const base = t.base.amounts[Math.min(1, t.base.amounts.length - 1)];
    const parts = scaleParts(t.parts, base).map((p) => `${formatDose(p.amount)} ${p.unit} ${p.name.toLowerCase()}`);
    steps.push({ body: `For ${base} ${t.base.unit} ${t.base.name.toLowerCase()}: ${parts.join(', ')}.`, timer_seconds: null });
  }
  for (const s of t.steps) steps.push({ body: s.text, timer_seconds: s.timer ?? null });
  steps.push({ body: `How it works, and how much for any batch: ${t.name} in Techniques.`, timer_seconds: null });
  return { actions: [actionFor(t)], leadMinutes: t.totalMinutes, leadNote: t.time, steps };
}
