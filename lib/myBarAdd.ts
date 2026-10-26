import { TECHNICAL_INGREDIENTS } from './techniques/ingredients';

/**
 * One opening of Add to your bar (wave 2, Q8 and Q7): it shows only what
 * isn't on your bar, and what you tick while it's open stays where it is,
 * ticked, until Done. Which gin? swaps a style for the bottles you pick.
 * Plain data, so it sits in component state.
 */
export interface AddSession {
  /** What this opening put on, in the order it was ticked: [id, name]. */
  ticked: [string, string][];
  /** Bottles picked in Which gin?, by the kind's id. */
  picks: Record<string, string[]>;
  /** Kinds a picked bottle took off the bar, to put back if every pick is unticked. */
  replaced: string[];
}

/** What each tab offers before anything is typed, by catalog name: the first are shown, `IDEAS_MORE` tops them up as you have them. */
export type IdeaTab = 'all' | 'bottles' | 'fridge' | 'lab' | 'preps';

export const IDEAS: Record<IdeaTab, readonly string[]> = {
  all: ['Gin', 'Lemon', 'Simple Syrup', 'Campari', 'Lime', 'Sweet Vermouth', 'Angostura Bitters', 'Sugar', 'Rye Whiskey', 'Egg', 'Soda Water', 'Mezcal'],
  bottles: ['Gin', 'Campari', 'Sweet Vermouth', 'Angostura Bitters', 'Rye Whiskey', 'Bourbon', 'White Rum', 'Tequila', 'Mezcal', 'Vodka', 'Dry Vermouth', 'Aperol'],
  fridge: ['Lemon', 'Lime', 'Orange', 'Grapefruit', 'Sugar', 'Honey', 'Egg', 'Soda Water', 'Mint', 'Tonic Water', 'Heavy Cream', 'Pineapple'],
  lab: TECHNICAL_INGREDIENTS.map((t) => t.name.replace(/ \(.*\)$/, '')),
  preps: ['Simple Syrup', 'Rich Simple Syrup', 'Saline', 'Lime Cordial', 'Oleo Saccharum', 'Orgeat', 'Grenadine', 'Honey Syrup'],
};

/** The next most used, in order, filling the gaps left by what you have. */
export const IDEAS_MORE: Record<IdeaTab, readonly string[]> = {
  all: ['Bourbon', 'Orange', 'Honey', 'White Rum', 'Tequila', 'Dry Vermouth', 'Grapefruit', 'Mint', 'Vodka', 'Aperol', 'Tonic Water', 'Orgeat', 'Grenadine', 'Heavy Cream', 'Cognac', 'Orange liqueur', 'Pineapple', 'Honey Syrup', 'Maraschino liqueur', 'Ginger Beer'],
  bottles: ['Cognac', 'Dark rum', 'Blanco tequila', 'Orange liqueur', 'Maraschino liqueur', 'Green Chartreuse', 'Amaro', 'Absinthe', 'Orange bitters', 'Irish whiskey', 'Pisco', 'Cachaça', 'Coffee liqueur', 'Crème de cassis', 'Fino sherry', 'Lillet Blanc', 'Aged rum', 'Apple brandy', 'Yellow Chartreuse', 'Reposado tequila'],
  fridge: ['Orange juice', 'Pineapple juice', 'Grapefruit juice', 'Ginger Beer', 'Cola', 'Ginger', 'Cucumber', 'Basil', 'Milk', 'Espresso', 'Coconut cream', 'Salt', 'Nutmeg', 'Maraschino cherry', 'Olive', 'Cranberry juice', 'Prosecco', 'Champagne'],
  lab: [],
  preps: ['Demerara syrup', 'Agave syrup', 'Maple syrup', 'Ginger syrup', 'Cinnamon syrup', 'Raspberry syrup', 'Passion fruit syrup', 'Falernum'],
};

export const NEW_SESSION: AddSession = { ticked: [], picks: {}, replaced: [] };

/** Shown in the sheet: not on your bar, or ticked (or swapped for a bottle) since it opened. */
export function shownHere(id: string, has: (id: string) => boolean, s: AddSession): boolean {
  return !has(id) || s.ticked.some(([t]) => t === id) || !!s.picks[id];
}

/** A tick or an untick, remembered so the tile stays put. An untick keeps its place too: it's still not on your bar. */
export function tick(s: AddSession, id: string, name: string, on: boolean): AddSession {
  const ticked = s.ticked.filter(([t]) => t !== id);
  return { ...s, ticked: on ? [...ticked, [id, name]] : s.ticked.some(([t]) => t === id) ? s.ticked : ticked };
}

/**
 * A bottle ticked in Which gin?: it goes on, and the kind comes off if it's
 * on (`kindOn`). Unticking the last pick puts a kind it replaced back.
 * Says what to do to the bar: what to add and what to take off.
 */
export function pick(s: AddSession, kindId: string, bottle: { id: string; name: string }, on: boolean, kindOn: boolean): { session: AddSession; add: string[]; remove: string[] } {
  const was = s.picks[kindId] ?? [];
  const now = on ? [...was.filter((b) => b !== bottle.id), bottle.id] : was.filter((b) => b !== bottle.id);
  const picks = { ...s.picks, [kindId]: now };
  const swap = on && kindOn;
  const back = !on && !now.length && s.replaced.includes(kindId);
  const replaced = swap ? [...s.replaced.filter((k) => k !== kindId), kindId] : back ? s.replaced.filter((k) => k !== kindId) : s.replaced;
  return {
    session: { ...tick(s, bottle.id, bottle.name, on), picks, replaced },
    add: [...(on ? [bottle.id] : []), ...(back ? [kindId] : [])],
    remove: [...(on ? [] : [bottle.id]), ...(swap ? [kindId] : [])],
  };
}

/** A swapped kind's tile unticked: "no gin after all", so the bottles picked for it come off too. */
export function dropKind(s: AddSession, kindId: string, name: string): { session: AddSession; remove: string[] } {
  const remove = s.picks[kindId] ?? [];
  const picks = { ...s.picks, [kindId]: [] };
  return { session: { ...tick(s, kindId, name, false), picks, replaced: s.replaced.filter((k) => k !== kindId) }, remove };
}

/** The footer: "2 added: Gin, Sweet vermouth", counting only what's on your bar now. Null when nothing is. */
export function addedLine(s: AddSession, onShelf: (id: string) => boolean): string | null {
  const names = s.ticked.filter(([id]) => onShelf(id)).map(([, name]) => name);
  return names.length ? `${names.length} added: ${names.join(', ')}` : null;
}

/** Which gin?'s footer once a bottle is picked: "Gin becomes Tanqueray London Dry". */
export function becomesLine(s: AddSession, kind: { id: string; name: string }, onShelf: (id: string) => boolean): string | null {
  const names = (s.picks[kind.id] ?? []).filter(onShelf).map((id) => s.ticked.find(([t]) => t === id)?.[1]).filter(Boolean);
  if (!names.length) return null;
  return s.replaced.includes(kind.id) ? `${kind.name} becomes ${names.join(', ')}` : `${names.length} added: ${names.join(', ')}`;
}

/** What a search left out because you have it, in one line: "Already on your bar: Limes, Lime cordial". */
export function leftOutLine(names: readonly string[], most = 4): string | null {
  if (!names.length) return null;
  const more = names.length - most;
  return `Already on your bar: ${names.slice(0, most).join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

// Kinds whose first word is a place or a people's name keep its capital.
const PROPER = /^(american|australian|canadian|cuban|dutch|english|french|irish|italian|jamaican|japanese|kentucky|london|mexican|old tom|plymouth|scotch|scottish|spanish|tennessee|welsh)\b/i;

/** A kind as Which asks for it: "gin", "rye whiskey", "Irish whiskey"; `many` gives "gins". */
export function kindName(name: string, many = false): string {
  const n = PROPER.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
  if (!many || /s$/i.test(n)) return n;
  return /[^aeiou]y$/i.test(n) ? `${n.slice(0, -1)}ies` : `${n}s`;
}
