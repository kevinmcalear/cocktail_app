import { savePrepCard, savePrepRecipe } from '@/hooks/usePrepCard';
import { saveNewBottles } from '@/hooks/useDrinkDesk';
import { linePrep } from '@/lib/batchLines';
import { houseMadesPayload } from '@/lib/houseMadeParts';
import { plainDbMessage } from '@/lib/dbError';
import { isNetworkError } from '@/lib/offlineWrites';
import { COMMON_METHODS, likeExactly, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import { kindColumns } from '@/lib/glassware';
import { existingIngredientId } from '@/lib/ingredientNames';
import type { PrepDraft } from '@/lib/prepKinds';
import { recipesToFinish } from '@/lib/prepMath';
import { toLine, type SortableRecipeItem } from '@/lib/recipeItem';
import { capitalize, capitalizeFirst } from '@/lib/stringUtils';
import { techniqueById } from '@/lib/techniques';
import { prepCardFor } from '@/lib/techniques/makeIt';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/db';

export type ItemType = 'ingredient' | 'method' | 'glassware' | 'ice';

/** Which of these picked rows still exist: one can be merged into another since it was picked (20261008100000). */
export async function liveIds(ids: readonly (string | null | undefined)[]): Promise<Set<string>> {
  const picked = [...new Set(ids.filter((v): v is string => !!v))];
  const live = new Set<string>();
  if (!picked.length) return live;
  const { data, error } = await supabase.from('items').select('id').in('id', picked);
  if (error) throw error;
  for (const r of data ?? []) live.add(r.id);
  return live;
}

/**
 * Turns spec lines into the rows they save as, the one way New and the
 * editors do it: a picked row as it is, a typed name found under any
 * spelling or added once, and anything made in-house a row of its own whose
 * recipe, technique card or bottle details are saved after the spec
 * (`saveOwnPreps`, `saveCards`, `saveBottles`). A house-made written inside
 * the drink (board Add-inside) is saved first, with its parts, in one call
 * (`houseMades`); if the drink then can't be saved, `dropHouseMades` takes
 * them out again, so it saves with the drink or not at all. `live` is what
 * `liveIds` found of the picked rows.
 */
export function specLineSaver(barId: string | null, live: ReadonlySet<string>) {
  const warnings: string[] = [];
  // New rows the pickers' lists don't have yet: ingredients by id, spec items (glass, method, ice) at all.
  const newIngredients: string[] = [];
  const created: { id: string; name: string }[] = [];
  const later: string[] = [];
  let newSpecs = false;

  // Typed-in names become rows once, even if two lines share one.
  const made = new Map<string, string>();
  const ensure = async (pick: WizardPick, type: ItemType): Promise<string> => {
    if (pick.id && live.has(pick.id)) return pick.id;
    const key = `${type}:${pick.name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
    const known = made.get(key);
    if (known) return known;
    // A name missing from the picker may still exist, under any spelling or
    // another name ("1:1 sugar syrup" is Simple Syrup): use that, never a copy.
    const resolved = type === 'ingredient' ? await supabase.rpc('resolve_ingredient', { p_name: pick.name }) : null;
    const same = supabase.from('items').select('id').eq('item_type', type).ilike('name', likeExactly(pick.name));
    // A venue's own ice (item_ice) is its Kit: drinks name the shared ice for now (kit and ice PR 6 offers the venue's).
    const found =
      resolved && !resolved.error && resolved.data
        ? { id: resolved.data as string }
        : (await (type === 'ice' ? same.is('bar_id', null) : same).limit(1).maybeSingle()).data;
    // One that exists keeps its kind: only an admin may change it (20261124100000_glass_ice_kinds.sql).
    if (found) {
      made.set(key, found.id);
      return found.id;
    }
    // A new glass or ice saves the kind picked for it; Not sure saves none.
    const { data, error } = await supabase
      .from('items')
      .insert({ name: newItemName(pick.name, type), item_type: type, bar_id: type === 'ingredient' ? barId : null, ...kindColumns(type, pick.kind) })
      .select('id')
      .single();
    // The database knows a name we didn't (an alias added since): it says which to use.
    const existing = existingIngredientId(error);
    if (existing) {
      made.set(key, existing);
      return existing;
    }
    if (error || !data) throw error ?? new Error(`Couldn’t add ${pick.name}.`);
    made.set(key, data.id);
    if (type === 'ingredient') {
      newIngredients.push(data.id);
      created.push({ id: data.id, name: capitalizeFirst(pick.name) });
    } else newSpecs = true;
    return data.id;
  };

  // A house prep made here is always a row of its own, so its recipe is
  // never dropped for a same-named one. A name that's taken becomes your
  // version of it, the way a prep page copies one (useCopyPrep): the same
  // name at a venue, "My …" at home.
  const own = async (line: WizardPick): Promise<string> => {
    const key = `own:${line.name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
    const known = made.get(key);
    if (known) return known;
    const name = capitalizeFirst(line.name);
    const insert = (row: { name: string; generic_id?: string }) =>
      supabase.from('items').insert({ ...row, item_type: 'ingredient', bar_id: barId, ingredient_role: 'prep' }).select('id').single();
    let { data, error } = await insert({ name });
    const taken = existingIngredientId(error);
    if (taken) ({ data, error } = await insert({ name: barId ? name : `My ${name}`, generic_id: taken }));
    // Your version from before: the drink uses it, and it keeps its recipe.
    const yours = taken ? existingIngredientId(error) : null;
    if (yours) {
      warnings.push(`You already have “My ${name}”, so the drink uses it. Change its recipe on its page.`);
      made.set(key, yours);
      return yours;
    }
    if (error || !data) throw error ?? new Error(`Couldn’t add ${line.name}.`);
    made.set(key, data.id);
    newIngredients.push(data.id);
    created.push({ id: data.id, name });
    return data.id;
  };

  // New house preps made by a technique, to get their prep card once the spec is in.
  const preps: { id: string; technique: string }[] = [];
  // New house preps with their own recipe, saved once the spec is in.
  const ownPreps: { id: string; name: string; prep: PrepDraft }[] = [];
  // New bottles with what they are and how the venue buys them (the desktop page's card).
  const bottles: { itemId: string; name: string; bottle: NonNullable<WizardLine['bottle']>; isNew: boolean }[] = [];

  // House-mades written inside the drink, by their line: saved before the drink, in one call.
  const houseIds = new Map<WizardLine, string>();
  // Every line that wrote one, still there after they're taken out again.
  const houseLines = new Set<WizardLine>();
  const houseMadeIds: string[] = [];
  /** Every house-made these lines wrote (a recipe of their own, not yet a row), with its parts: all of them or none. */
  const houseMades = async (lines: readonly WizardLine[]) => {
    const own = lines.filter((l) => l.prep && l.name.trim() && !(l.id && live.has(l.id)));
    if (!own.length) return;
    const { payload, at } = houseMadesPayload(own.map((l) => ({ name: l.name, prep: l.prep! })));
    // A line picked before can be gone by now (merged into another): it goes by its name.
    const alive = await liveIds(payload.flatMap((p) => p.lines.flatMap((x) => ('id' in x ? [x.id] : []))));
    const sent = payload.map((p) => ({ ...p, lines: p.lines.map((x) => ('id' in x && !alive.has(x.id) ? { name: x.name ?? '', amount: x.amount, unit: x.unit, note: x.note } : x)) }));
    // p_bar is null at home: the function takes it (generated types call every argument required).
    const { data, error } = await supabase.rpc('save_house_mades', { p_bar: barId as string, p_preps: sent as unknown as Json });
    if (error) throw error;
    const ids = data as string[];
    houseMadeIds.push(...ids);
    newIngredients.push(...ids);
    own.forEach((l, i) => {
      const id = ids[at[i]];
      houseIds.set(l, id);
      houseLines.add(l);
      // Two lines with one house-made share its row (houseMadesPayload): it's new once.
      if (created.some((c) => c.id === id)) return;
      created.push({ id, name: capitalizeFirst(l.name.trim()) });
      // Recipes left to finish, in it and inside it: what's done is saved, and the notice says what's left.
      later.push(...recipesToFinish([l]).map((r) => capitalize(r.name)));
    });
  };
  /**
   * The drink couldn't be saved (`e`): the house-mades saved for it go too,
   * but only on a plain refusal. On a dropped connection the drink may have
   * gone in, and taking them out would take its lines with them (a recipe
   * line goes with its ingredient). What it hands back is what's still
   * saved, by line, for the lines to point at, so a retry uses them rather
   * than being refused by their names; empty when they were taken out.
   */
  const dropHouseMades = async (e: unknown): Promise<ReadonlyMap<WizardLine, string>> => {
    if (houseMadeIds.length && !isNetworkError(e)) {
      const { error } = await supabase.from('items').delete().in('id', [...houseMadeIds]);
      if (!error) {
        houseMadeIds.length = 0;
        houseIds.clear();
      }
    }
    return new Map(houseIds);
  };

  /** The row a line saves as. */
  const line = async (l: WizardLine): Promise<string> => {
    const house = houseIds.get(l);
    if (house) return house;
    const madeBefore = newIngredients.length;
    // Its recipe, or a batch read from a file as a house prep of the kind Batch: the bottle's recipe.
    const prep = linePrep(l);
    // A prep added by name only is still a house prep of its own, its recipe to come.
    const ownPrep = (!!prep || !!l.later) && !(l.id && live.has(l.id));
    const ingredientId = ownPrep ? await own(l) : await ensure(l, 'ingredient');
    const isNew = newIngredients.length > madeBefore;
    // Recipes left to finish, in it and inside its recipes: what's done is saved, and the notice says what's left.
    if (isNew) later.push(...recipesToFinish([l]).map((r) => capitalize(r.name)));
    if (prep && isNew) ownPreps.push({ id: ingredientId, name: l.name, prep });
    else if (l.technique && isNew) preps.push({ id: ingredientId, technique: l.technique });
    if (l.bottle && barId && !ownPrep) bottles.push({ itemId: ingredientId, name: capitalizeFirst(l.name), bottle: l.bottle, isNew });
    return ingredientId;
  };

  // Recipes made in-house inside a prep (make-anything-steps-2, step 8): rows of their own, recipes saved only on rows this save made.
  const inner = {
    own: async (pick: WizardPick) => {
      const before = newIngredients.length;
      const id = await own(pick);
      return { id, isNew: newIngredients.length > before };
    },
    warn: (message: string) => warnings.push(message),
  };
  /** A prep made here: its recipe, method and keeping, on the row this save made. */
  const saveOwnPreps = async () => {
    for (const p of ownPreps) {
      try {
        await savePrepRecipe(p.id, p.prep, ensure, barId, inner);
      } catch (e) {
        warnings.push(plainDbMessage(e) ?? `${capitalize(p.name)}’s recipe wasn’t saved. Add it on its page.`);
      }
    }
  };
  /** Only rows this save made get a card: an existing prep keeps its own. */
  const saveCards = async () => {
    for (const p of preps) {
      const t = techniqueById(p.technique);
      if (!t) continue;
      const card = prepCardFor(t);
      try {
        const role = await supabase.from('items').update({ ingredient_role: 'prep' }).eq('id', p.id);
        if (role.error) throw role.error;
        await savePrepCard(p.id, {
          prep: { yield_amount: null, yield_unit: null, shelf_life_hours: null, lead_time_minutes: card.leadMinutes, lead_time_note: card.leadNote, storage: null, actions: card.actions },
          steps: card.steps,
        });
      } catch (e) {
        warnings.push(plainDbMessage(e) ?? `${t.name} steps weren’t added to the new house-made ingredient. Add them on its page.`);
      }
    }
  };
  const saveBottles = async () => {
    if (barId) warnings.push(...(await saveNewBottles(barId, bottles)));
  };

  return { ensure, line, houseMades, dropHouseMades, houseMadeOf: (l: WizardLine) => houseLines.has(l), saveOwnPreps, saveCards, saveBottles, warnings, created, later, newIngredients, newSpecs: () => newSpecs };
}

/** A line that saves as it is: a picked row and nothing made with it. */
export const plainLine = (l: WizardLine) => !!l.id && !l.prep && !l.later && !l.technique && !l.bottle && !l.batch;

// House-mades a failed save left saved, by line key, on the error it failed with.
const keptOn = new WeakMap<object, ReadonlyMap<string, string>>();

/** `e`, carrying the house-mades its save left saved (`kept`, by line), for the draft's lines to point at. */
export function withKeptHouseMades(e: unknown, kept: ReadonlyMap<WizardLine, string>): unknown {
  if (!kept.size) return e;
  const err = e && typeof e === 'object' ? e : new Error(String(e));
  keptOn.set(err, new Map([...kept].map(([l, id]) => [l.key, id])));
  return err;
}

/**
 * A draft's lines after a save that failed with `e`: a line whose house-made
 * it left saved (a dropped connection) is on that row now, its recipe there,
 * so a retry uses it rather than being refused by its name (review of #1187).
 * Null when it left none.
 */
export function linesOnKeptHouseMades(e: unknown, d: { lines: WizardLine[]; garnishes: WizardLine[] }): { lines: WizardLine[]; garnishes: WizardLine[] } | null {
  const kept = e && typeof e === 'object' ? keptOn.get(e) : undefined;
  if (!kept) return null;
  const on = (l: WizardLine): WizardLine => {
    const id = kept.get(l.key);
    if (!id) return l;
    const { prep: _p, technique: _t, later: _l, bottle: _b, named: _n, combined: _c, batch: _ba, ...rest } = l;
    return { ...rest, id };
  };
  return { lines: d.lines.map(on), garnishes: d.garnishes.map(on) };
}

/** A line pointed at a row: what made it (a recipe, a technique, a bottle's details) is the row's now. */
export function pointAt(item: SortableRecipeItem, ingredientId: string): SortableRecipeItem {
  const { prep: _p, technique: _t, later: _l, bottle: _b, named: _n, combined: _c, batch: _ba, ...rest } = item;
  return { ...rest, ingredient_id: ingredientId };
}

/**
 * Saves the editors' lines with `write`, each line with its ingredient: one
 * typed or made while editing (combined, made in-house, a new name) is found
 * or added the way New saves it, with its recipe, card or bottle details,
 * before `write` runs, and `put` gets the lines on those rows, so a write
 * that fails and is tried again doesn't make them twice. House-mades written
 * inside it (board Add-inside) save with `write` or not at all: when anything
 * after them fails, `put` gets the lines as they were, recipes and all, or,
 * when they're still saved (a dropped connection, or a delete that failed),
 * the lines on them. `warnings` says what didn't stick.
 */
export async function saveEditItems<T>(items: readonly SortableRecipeItem[], barId: string | null, put: (items: SortableRecipeItem[]) => void, write: (items: SortableRecipeItem[]) => Promise<T>) {
  const lines = items.map(toLine);
  const saver = specLineSaver(barId, await liveIds(lines.filter((l) => !plainLine(l)).map((l) => l.id)));
  // All of them or none: nothing to take back if this fails.
  await saver.houseMades(lines);
  const out: SortableRecipeItem[] = [];
  try {
    for (const [i, l] of lines.entries()) out.push(plainLine(l) ? items[i] : pointAt(items[i], await saver.line(l)));
    await saver.saveOwnPreps();
    await saver.saveCards();
    await saver.saveBottles();
    put(out);
    const result = await write(out);
    return { result, warnings: saver.warnings, created: saver.newIngredients };
  } catch (e) {
    const kept = await saver.dropHouseMades(e);
    // A house-made taken out again: its line as it was. Still saved: its line on it. The rest on the rows found for them.
    put(items.map((item, i) => (saver.houseMadeOf(lines[i]) ? (kept.has(lines[i]) ? pointAt(item, kept.get(lines[i])!) : item) : (out[i] ?? item))));
    throw e;
  }
}

/** A new row's name: an ingredient's first letter up, a method the wizard offers as the wizard spells it ("Whip (whisk or frother)"), anything else in title case. */
function newItemName(name: string, type: ItemType): string {
  if (type === 'ingredient') return capitalizeFirst(name);
  const ours = type === 'method' ? COMMON_METHODS.find((m) => m.toLowerCase() === name.trim().toLowerCase()) : undefined;
  return ours ?? capitalize(name);
}
