/**
 * A whole spec pasted into the add-drink field, read line by line the way
 * one typed line is: "2 oz coconut fat-washed Bacardi" is 60 ml of Bacardí
 * to make house, "3 drops mint oil on top" goes to the finish, and the
 * drink's own name, the method and the glass are skipped. Pure; the sheet
 * is components/screens/addDrink/PasteSpecSheet.
 */
import type { WizardPick } from '@/lib/drinkWizard';
import { nearIngredient, sameIngredient, type IngredientAlias, type IngredientRow } from '@/lib/ingredientNames';
import { readHouse } from '@/lib/makeItHouse';
import { normName, typedPour } from '@/lib/paste';
import { capitalizeFirst } from '@/lib/stringUtils';

export interface SpecRow {
  key: string;
  /** The line as pasted. */
  source: string;
  /** A line of the drink, a line of its finish, or not a line at all. */
  kind: 'line' | 'finish' | 'skip';
  /** Why a skipped row is skipped. */
  note?: string;
  /** As typed ("2", "1/2"); empty when the line has none ("Top soda"). */
  amount: string;
  /** Null: the line guesses its unit, as a typed pour does. */
  unit: string | null;
  pick: WizardPick;
  /** The line says how the bottle was made house. */
  house?: { technique: string; adjunct: string | null; phrase: string };
}

/** On top or on the glass, never poured into the drink. */
const FINISH_UNITS = new Set(['drop', 'spray', 'rinse', 'float', 'peel', 'twist', 'discard', 'wheel', 'sprig', 'leaf', 'slice', 'wedge', 'rim']);
const FINISH_WORDS = /[,\s]+(on top|to finish|as a garnish|to garnish|on the glass)\.?$/i;
const GARNISH = /^garnish(?:ed)?(?: with)?:?\s+(.+)$/i;
const TOP = /^top(?:\s+(?:up\s+)?with)?\s+(.+)$/i;
// The method, the glass and the ice have their own steps: a method word, or a "Glass:" style heading.
const NOT_A_LINE = /^(shake|shaken|stir|stirred|build|built|blend|blended|throw|thrown|swizzle|swizzled|double strain|fine strain|strain|dry shake)\b|^(glass|ice|serve|method)\s*:/i;

/** Each pasted line, read. `drinkName` is skipped where it heads the paste. */
export function readSpec<T extends IngredientRow>(
  text: string,
  rows: readonly T[],
  opts: { aliases?: readonly IngredientAlias[]; coreIds?: ReadonlySet<string>; have?: ReadonlySet<string>; drinkName?: string } = {},
): SpecRow[] {
  const { aliases = [], drinkName = '' } = opts;
  const pickFor = (name: string): WizardPick => {
    const hit = sameIngredient(name, rows, aliases) ?? nearIngredient(name, rows, aliases);
    return hit ? { id: hit.id, name: hit.name ?? name } : { id: null, name: capitalizeFirst(name) };
  };
  return text
    .split('\n')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((source, i): SpecRow => {
      const row = source.replace(/^[-•*·]\s*/, '').replace(/^\.(\d)/, '0.$1');
      const key = String(i);
      const skip = (note: string): SpecRow => ({ key, source, kind: 'skip', note, amount: '', unit: null, pick: { id: null, name: source } });
      if (drinkName.trim() && normName(row) === normName(drinkName)) return skip('The drink’s name');
      // A first line with no amount that isn't an ingredient is the spec's title, whatever the drink is called here.
      if (i === 0 && !typedPour(row) && !TOP.test(row) && !GARNISH.test(row) && !sameIngredient(row, rows, aliases) && !nearIngredient(row, rows, aliases)) return skip('The title');
      const garnish = row.match(GARNISH);
      if (garnish) return { key, source, kind: 'finish', amount: '', unit: null, pick: pickFor(garnish[1].trim()) };
      if (NOT_A_LINE.test(row)) return skip('Set in its own step');
      const top = row.match(TOP);
      if (top) return { key, source, kind: 'line', amount: '', unit: 'top', pick: pickFor(top[1].trim()) };
      const pour = typedPour(row);
      // A line that is all words is a name with no amount ("Campari"), unless it reads like a sentence.
      if (!pour && row.split(/\s+/).length > 6) return skip('Not a line');
      const said = (pour?.name ?? row).trim();
      const name = said.replace(FINISH_WORDS, '').trim();
      const finish = name !== said || (!!pour?.unit && FINISH_UNITS.has(pour.unit));
      const amount = pour?.amount ?? '';
      const unit = pour?.unit ?? null;
      if (finish) return { key, source, kind: 'finish', amount, unit, pick: pickFor(name) };
      const house = readHouse(name, rows, opts);
      if (house) {
        const bottle = house.bottles[0];
        return { key, source, kind: 'line', amount, unit, pick: { id: bottle.id, name: bottle.name ?? house.base }, house: { technique: house.technique.id, adjunct: house.adjunct, phrase: house.phrase } };
      }
      return { key, source, kind: 'line', amount, unit, pick: pickFor(name) };
    });
}
