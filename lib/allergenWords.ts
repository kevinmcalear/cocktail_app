/**
 * What the drink, house-made and settings pages say about allergens. Kept off
 * lib/allergens, which Tonight and the menu lens load on every web page.
 */
import { allergenLabel, andList, listAllergens, type AllergyMatch, type DrinkAllergen, type DrinkAllergens, type GuestDrinkAllergens } from './allergens';

/** A drink's allergens as any reader gets them: staff (drink_allergens) or guests (guest_drink_allergens). */
export interface AllergenRead {
  allergens: DrinkAllergen[];
  unchecked: number;
  lines: number;
  /** When the bar checked it, while that check holds; null: not checked. */
  checked: string | null;
}

export const fromStaff = (d: DrinkAllergens): AllergenRead => ({ allergens: d.allergens, unchecked: d.unchecked, lines: d.lines, checked: d.checked ?? null });
export const fromGuest = (d: GuestDrinkAllergens): AllergenRead => ({ allergens: d.allergens, unchecked: d.unchecked, lines: d.lines, checked: d.checked_at });

/**
 * The only time anything may say a drink has no allergens: the bar has
 * checked it, every ingredient under it has a list, and none of them
 * declares one. Every "No allergens" in this file goes through here, so an
 * unchecked drink can never read as clean (the #1050 menu-page bug).
 */
export function isClear(d: AllergenRead | null | undefined): boolean {
  return !!d && !!d.checked && d.lines > 0 && d.unchecked === 0 && d.allergens.length === 0;
}

const ingredients = (n: number) => (n === 1 ? '1 ingredient' : `${n} ingredients`);

/**
 * The one line a server reads out: "Contains eggs and sulphites." Unchecked
 * ingredients are never hidden behind a clean bill, and a drink the bar
 * hasn't checked says so.
 */
export function containsLine(d: DrinkAllergens | null | undefined): string {
  if (!d || d.lines === 0) return 'No spec yet, so nothing to declare.';
  const read = fromStaff(d);
  if (isClear(read)) return 'No allergens.';
  const parts = [d.allergens.length ? `Contains ${listAllergens(d.allergens.map((a) => a.allergen))}.` : 'Nothing declared yet.'];
  if (d.unchecked > 0) parts.push(`${ingredients(d.unchecked)} not checked yet.`);
  if (!read.checked) parts.push('Not checked by the bar.');
  return parts.join(' ');
}

/** "Eggs, Sulphites" for a label or a chip row; "No allergens" only on a clear drink; else what's missing. */
export function allergenNames(d: AllergenRead | null | undefined): string {
  if (!d) return '';
  if (d.allergens.length) return d.allergens.map((a) => allergenLabel(a.allergen)).join(', ');
  return isClear(d) ? 'No allergens' : 'Allergens not checked';
}

/**
 * A house-made prep's label (Make, Log batch): a prep has no bar check of its
 * own, so it reads "No allergens" once every ingredient under it has a list
 * and none declares one; until then, "Allergens not checked".
 */
export function prepAllergenNames(d: DrinkAllergens | null | undefined): string {
  if (!d) return '';
  return allergenNames({ ...fromStaff(d), checked: d.unchecked === 0 ? 'every ingredient' : null });
}

export interface AllergenRow {
  key: string;
  /** "Eggs", or the warning: "Not checked by the bar". */
  label: string;
  /** "Egg white", the ingredients it comes through; or the unchecked count. */
  sub: string | null;
  warn: boolean;
}

/**
 * The drink page's Allergens list (board Loop-allergy): every allergen with
 * the top ingredients it comes through, for everyone (guest-allergen-read);
 * then what isn't checked, never folded into a clean bill. "No allergens"
 * only when isClear.
 */
export function allergenRows(d: AllergenRead): AllergenRow[] {
  const rows: AllergenRow[] = d.allergens.map((a) => {
    const tops = [...new Set(a.via.map((path) => path[0]).filter(Boolean))];
    return { key: a.allergen, label: allergenLabel(a.allergen), sub: tops.length ? tops.join(', ') : null, warn: false };
  });
  const noList = d.unchecked > 0 ? `${ingredients(d.unchecked)} ${d.unchecked === 1 ? 'has' : 'have'} no list yet` : null;
  if (!d.checked) rows.push({ key: 'unchecked', label: 'Not checked by the bar', sub: noList, warn: true });
  else if (noList) rows.push({ key: 'unchecked', label: noList, sub: null, warn: true });
  else if (isClear(d)) rows.push({ key: 'none', label: 'No allergens', sub: null, warn: false });
  return rows;
}

/** "12 October", with the year when it isn't this one. */
export function dayLine(at: string, now = new Date()): string {
  const d = new Date(at);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) });
}

/**
 * Under the list: "Checked by Caretaker's, 12 October." or, unchecked, "Ask
 * your bartender about your allergies." The bar's own team reads what guests
 * will see until they check it.
 */
export function allergenFooter(d: AllergenRead, barName: string | null, now = new Date(), staff = false): string {
  if (!d.checked) return staff ? 'Not checked yet: guests read Ask your bartender.' : 'Ask your bartender about your allergies.';
  return `Checked by ${barName ?? 'the bar'}, ${dayLine(d.checked, now)}.`;
}

/**
 * The warning at the top of the page: "Contains sulphites, from the dry
 * vermouth" (board Decided-who-guest-hit) / "Tell your bartender." (board
 * Loop-allergy "A match"). It names the allergen and every ingredient it comes
 * through, so a guest never acts on half of it. Only on a drink the bar has
 * checked, never a tick: null otherwise.
 */
export function allergyWarning(hits: AllergyMatch[] | null): { title: string; body: string } | null {
  if (!hits?.length) return null;
  const allergens = listAllergens([...new Set(hits.map((h) => h.allergen))]);
  const names = [...new Set(hits.flatMap((h) => (h.ingredient ? [h.ingredient.toLowerCase()] : [])))];
  return { title: `Contains ${allergens}${names.length ? `, from the ${andList(names)}` : ''}`, body: 'Tell your bartender.' };
}

/** The Settings row's value: "Eggs, Tree nuts", "None", or "Not set" (null: never set). */
export function myAllergiesLine(mine: readonly string[] | null | undefined): string {
  if (!mine) return 'Not set';
  return mine.length ? mine.map(allergenLabel).join(', ') : 'None';
}

/** "via Raspberry syrup, in Egg white" for one path, or "" when every name is hidden. */
export function viaLine(path: string[]): string {
  if (!path.length) return '';
  return `via ${path.join(', in ')}`;
}

/** "24 Sep", with the year when it isn't this one. */
function shortDay(at: string, now = new Date()): string {
  const d = new Date(at);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) });
}

/** "Checked 24 Sep" or "Not checked yet". */
export function checkedLine(checkedAt: string | null | undefined, now = new Date()): string {
  return checkedAt ? `Checked ${shortDay(checkedAt, now)}` : 'Not checked yet';
}

/**
 * The check sheet's note once a change cleared the bar's check (board
 * Loop-allergy, "A changed spec clears it"): when the spec changed, or, when
 * it was an ingredient's list instead, what changed.
 */
export function staleNote(specChanged: string | null, now = new Date()): string {
  const what = specChanged ? `The spec changed on ${shortDay(specChanged, now)}` : 'What goes in it changed';
  return `${what}, so the check cleared. Guests see Ask your bartender until you check it again.`;
}
