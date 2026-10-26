import { useMutation, useQueryClient } from '@tanstack/react-query';

import { uploadDrinkPhoto } from '@/components/drink/drinkImages';
import { useUserId } from '@/ctx/AuthContext';
import { savePrepCard, savePrepRecipe } from '@/hooks/usePrepCard';
import { saveNewBottles } from '@/hooks/useDrinkDesk';
import { dropdownKeys, refreshIngredients } from '@/hooks/useDropdowns';
import { savePrivateNote } from '@/hooks/usePrivateNote';
import { recentEntry } from '@/hooks/useTrackRecent';
import { useRefreshSpecs } from '@/hooks/useBulk';
import { saveDrinkSpec, type SpecLineInput } from '@/hooks/useVersions';
import { track } from '@/lib/analytics';
import { linePrep } from '@/lib/batchLines';
import { plainDbMessage } from '@/lib/dbError';
import { orderedMethodIds } from '@/lib/drinkMethods';
import { COMMON_METHODS, creatorProfileId, likeExactly, specLines, type WizardDraft, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import { fetchEditableRecipes } from '@/lib/editableRecipes';
import { saysMore, toStored, type IceLayer } from '@/lib/iceBuild';
import { existingIngredientId } from '@/lib/ingredientNames';
import type { ImageAngle } from '@/lib/itemImages';
import { formatPrice } from '@/lib/menus';
import { priceText } from '@/lib/money';
import { recipesToFinish, type PrepDraft } from '@/lib/prepKinds';
import { capitalize, capitalizeFirst } from '@/lib/stringUtils';
import { techniqueById } from '@/lib/techniques';
import { prepCardFor } from '@/lib/techniques/makeIt';
import { ontoBarLines } from '@/lib/sameName';
import type { SketchInputs } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';
import type { Insert } from '@/types/db';
import { useMenuDrinkHandoff } from '@/store/useMenuDrinkHandoff';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

export interface CreateDrinkInput {
  draft: WizardDraft;
  /** The venue it's added at; null for a drink at home. */
  barId: string | null;
  /** Your own person profile, for "I made it". */
  myProfileId: string | null;
  /** Adding it from a menu section: it lands in that section. */
  menuSectionId?: string | null;
  /** The drawing the wizard showed (draftSketchInputs): the new drink shows it at once, not its glass icon. */
  sketch?: SketchInputs | null;
  /**
   * Bring in's "Update it" (board dup-drink-warning): this existing drink
   * takes the draft's spec as a new version (save_drink_spec, the editor's
   * save), and nothing else about it changes. No drink is made.
   */
  updateId?: string | null;
}

export interface CreateDrinkResult {
  id: string;
  /** Saved, but these parts didn't stick (said the way a person would want to hear it). */
  warnings: string[];
  /** Ingredients and preps this save made (Bring in records them so Undo all can take them back). */
  created: { id: string; name: string }[];
  /** House preps added by name only ("Just add the name", Later): their recipes are still to write. */
  later: string[];
}

type ItemType = 'ingredient' | 'method' | 'glassware' | 'ice';

/**
 * Saves the add-drink wizard's drink in one go, at the end: any ingredient,
 * method, glass or ice typed in that doesn't exist yet, then the drink with
 * its credits, then its spec (a first version, through save_drink_spec). If
 * the spec can't be written the half-made drink is removed again, so trying
 * again doesn't leave a copy; the draft stays on the device until this
 * succeeds.
 */
/**
 * The drink's typed price. A draft saved before prices were typed text
 * (20261103100000) kept the number only (WizardDraft.priceMinor), so that
 * becomes the price in the bar's currency.
 */
async function draftPrice(draft: WizardDraft, barId: string): Promise<string | null> {
  const typed = formatPrice(draft.price);
  const minor = (draft as { priceMinor?: unknown }).priceMinor;
  if (typed || typeof minor !== 'number' || !Number.isFinite(minor)) return typed;
  // The currency decides the units (yen have none); not knowing it keeps the draft to try again.
  const { data, error } = await supabase.from('bars').select('currency').eq('id', barId).maybeSingle();
  if (error) throw error;
  return priceText(minor, data?.currency ?? '');
}

export function useCreateDrink() {
  const qc = useQueryClient();
  const userId = useUserId();
  const refreshSpecs = useRefreshSpecs();

  return useMutation({
    mutationFn: async ({ draft, barId, myProfileId, menuSectionId, sketch, updateId }: CreateDrinkInput): Promise<CreateDrinkResult> => {
      if (!userId) throw new Error('Sign in to save drinks.');
      const warnings: string[] = [];
      // New rows the pickers' lists don't have yet: ingredients by id, spec items (glass, method, ice) at all.
      const newIngredients: string[] = [];
      const created: { id: string; name: string }[] = [];
      let newSpecs = false;

      // A picked row can be gone by now (merged into another ingredient since
      // the draft was made, 20261008100000): those go by name, like a typed one.
      const pickedIds = [
        ...specLines(draft).map(({ line }) => line.id),
        ...draft.methods.map((m) => m.id),
        draft.glass?.id,
        draft.ice?.id,
        draft.methodIce?.id,
        ...(draft.iceBuild ?? []).map((l) => l.ice.id),
      ].filter((v): v is string => !!v);
      const live = new Set<string>();
      if (pickedIds.length) {
        const { data, error } = await supabase.from('items').select('id').in('id', [...new Set(pickedIds)]);
        if (error) throw error;
        for (const r of data ?? []) live.add(r.id);
      }

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
        if (found) {
          made.set(key, found.id);
          return found.id;
        }
        const { data, error } = await supabase
          .from('items')
          .insert({ name: newItemName(pick.name, type), item_type: type, bar_id: type === 'ingredient' ? barId : null })
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
        }
        else newSpecs = true;
        return data.id;
      };

      // A house prep made in the wizard is always a row of its own, so its
      // recipe is never dropped for a same-named one. A name that's taken
      // becomes your version of it, the way a prep page copies one
      // (useCopyPrep): the same name at a venue, "My …" at home.
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

      const lines: SpecLineInput[] = [];
      // New house preps made by a technique, to get their prep card once the drink is in.
      const preps: { id: string; technique: string }[] = [];
      // New house preps with their own recipe (made in the wizard), saved once the drink is in.
      const ownPreps: { id: string; name: string; prep: PrepDraft }[] = [];
      const later: string[] = [];
      // New bottles with what they are and how the venue buys them (the desktop page's card).
      const bottles: { itemId: string; name: string; bottle: NonNullable<WizardLine['bottle']>; isNew: boolean }[] = [];
      for (const { line, amount } of specLines(draft)) {
        const madeBefore = newIngredients.length;
        // Its recipe, or a batch read from a file as a house prep of the kind Batch: the bottle's recipe.
        const prep = linePrep(line);
        // A prep added by name only is still a house prep of its own, its recipe to come.
        const ownPrep = (!!prep || !!line.later) && !(line.id && live.has(line.id));
        const ingredientId = ownPrep ? await own(line) : await ensure(line, 'ingredient');
        const isNew = newIngredients.length > madeBefore;
        // Recipes left to finish, in it and inside its recipes: what's done is saved, and the notice says what's left.
        if (isNew) later.push(...recipesToFinish([line]).map((r) => capitalize(r.name)));
        if (prep && isNew) ownPreps.push({ id: ingredientId, name: line.name, prep });
        else if (line.technique && isNew) preps.push({ id: ingredientId, technique: line.technique });
        if (line.bottle && barId && !ownPrep) bottles.push({ itemId: ingredientId, name: capitalizeFirst(line.name), bottle: line.bottle, isNew });
        lines.push({
          id: null,
          ingredient_item_id: ingredientId,
          amount,
          unit: line.unit || null,
          preparation_notes: line.note?.trim() || null,
          is_optional: false,
        });
      }
      const methodIds: string[] = [];
      for (const m of draft.methods) methodIds.push(await ensure(m, 'method'));
      // Recipes made in-house inside a prep (make-anything-steps-2, step 8): rows of their own, recipes saved only on rows this save made.
      const inner = {
        own: async (pick: WizardPick) => {
          const before = newIngredients.length;
          const id = await own(pick);
          return { id, isNew: newIngredients.length > before };
        },
        warn: (message: string) => warnings.push(message),
      };
      // A prep made here: its recipe, method and keeping, on the row this save made.
      const saveOwnPreps = async () => {
        for (const p of ownPreps) {
          try {
            await savePrepRecipe(p.id, p.prep, ensure, barId, inner);
          } catch (e) {
            warnings.push(plainDbMessage(e) ?? `${capitalize(p.name)}’s recipe wasn’t saved. Add it on its page.`);
          }
        }
      };
      if (updateId) {
        // Its ranks, photos and menus stay; the spec it had is the version before, so it can be put back.
        const [had, hadMethods] = await Promise.all([fetchEditableRecipes(updateId), supabase.from('item_methods').select('method_item_id, sort_order').eq('item_id', updateId)]);
        if (hadMethods.error) throw hadMethods.error;
        // Its own rows keep their notes and service decisions, and a sheet that names no method we know (it went to notes) keeps the drink's.
        await saveDrinkSpec(updateId, ontoBarLines(lines, had), methodIds.length ? methodIds : orderedMethodIds(hadMethods.data), 'Updated from Bring in');
        // A batch read from the sheet keeps its bottle's recipe.
        await saveOwnPreps();
        void qc.invalidateQueries({ queryKey: ['same-name-drink'] });
        void refreshSpecs({ drinkIds: [updateId], ingredientIds: newIngredients });
        return { id: updateId, warnings, created, later };
      }
      const glassId = draft.glass ? await ensure(draft.glass, 'glassware') : null;
      const iceId = draft.ice ? await ensure(draft.ice, 'ice') : null;
      const methodIceId = draft.methodIce ? await ensure(draft.methodIce, 'ice') : null;
      // How the ice sits, when it says more than its one ice (the top layer, ice_id).
      let iceBuild: IceLayer<string>[] | null = null;
      if (saysMore(draft.iceBuild)) {
        const ids: string[] = [];
        for (const l of draft.iceBuild) ids.push(await ensure(l.ice, 'ice'));
        iceBuild = toStored(draft.iceBuild.map((l, i) => ({ ...l, ice: ids[i] })), (x) => x);
      }

      // A venue's drink is credited to the venue too, unless it's from somewhere else; one added at home, to the bar it was first made at.
      const fromElsewhere = !barId || !!draft.elsewhere;
      let originBar: string | null = fromElsewhere ? (draft.place?.id ?? null) : null;
      if (!fromElsewhere) {
        const { data } = await supabase.from('profiles').select('id').eq('bar_id', barId).eq('kind', 'bar').limit(1).maybeSingle();
        originBar = data?.id ?? null;
      }
      const creatorId = creatorProfileId(draft, myProfileId);
      // Another bar's name on it is a suggestion until the bar confirms it, as a drink added in setup is (useSaveCareerDrink).
      const otherBar = fromElsewhere && !!originBar;

      const row: Insert<'items'> = {
        id: undefined,
        name: capitalize(draft.name),
        item_type: 'cocktail',
        bar_id: barId,
        description: draft.description.trim() || null,
        // "Just me" notes are kept apart, as yours (below).
        notes: draft.notesPrivate ? null : draft.notes.trim() || null,
        glassware_id: glassId,
        sketch_variant: draft.glassVariant ?? null,
        // One of the venue's real glasses, when one was picked; the database sets glassware_id to its kind.
        ...(draft.glassModelId ? { glass_model_id: draft.glassModelId } : {}),
        // The colour picked as it was made; the database copies it into the drawing (20261017100000_sketch_liquid).
        sketch_liquid: draft.tint ?? null,
        ice_id: iceId,
        // Only when there is one: a database without 20261029100000 refuses an unknown column, so every other save keeps working whichever lands first.
        ...(methodIceId ? { method_ice_id: methodIceId } : {}),
        // The same for the build (20261029500000).
        ...(iceBuild ? { ice_build: iceBuild } : {}),
        riff_of_id: draft.riffOf?.id ?? null,
        creator_profile_id: creatorId,
        origin_bar_profile_id: originBar,
        origin_year: draft.originYear ?? null,
        price: barId ? await draftPrice(draft, barId) : null,
        // You can claim your own credit; anyone else's starts as suggested.
        credit_status: creatorId && creatorId === myProfileId && !otherBar ? 'claimed' : null,
      };
      // Under the draft's id, so it's drawn with the wizard's seed. A clash
      // (an earlier try that saved but never answered) gets an id of its own.
      // (undefined is left out of the request, so the database makes one.)
      const insert = (id: string | undefined) => supabase.from('items').insert({ ...row, id }).select('id').single();
      let { data: item, error: itemError } = await insert(draft.id);
      if (itemError?.code === '23505' && draft.id) ({ data: item, error: itemError } = await insert(undefined));
      if (itemError || !item) throw itemError ?? new Error('Couldn’t save the drink.');
      const id = item.id as string;

      try {
        // Every method, in order, in the same transaction as the spec.
        await saveDrinkSpec(id, lines, methodIds, null);
      } catch (e) {
        await supabase.from('items').delete().eq('id', id);
        throw e;
      }

      // The drawing the wizard showed stays the drink's: the worker won't
      // repaint it until the drink changes (20261009750000_maker_drawings).
      // Decorative, so a failure only means the worker draws it as usual.
      // No glass drawing picked goes without "variant": the database stores
      // the default drawing that way and refuses a null one.
      if (sketch) {
        // The database adds the build from the drink's own (20261029500000), and an older one refuses the key.
        // The ice's look, the glass's height and its traced outline are the venue's, not the drink's, so they aren't sent either.
        const { variant, build: _build, iceLook: _look, glassMm: _mm, outline: _outline, ...rest } = sketch;
        await supabase.rpc('save_maker_sketch', { p_item_id: id, p_inputs: variant ? { ...rest, variant } : rest });
      }

      if (draft.publish) {
        const { error } = await supabase.from('items').update({ publish_mode: draft.publish }).eq('id', id);
        if (error) warnings.push(plainDbMessage(error) ?? 'It’s saved as private: who can see it didn’t change.');
      }

      // Not the person credited first, and only people with a profile (the database checks both).
      const coIds = [...new Set((draft.coCreators ?? []).map((c) => c.id).filter((p): p is string => !!p && p !== creatorId))];
      if (coIds.length) {
        const { error } = await supabase.from('item_co_creators').insert(coIds.map((profile_id) => ({ item_id: id, profile_id })));
        if (error) warnings.push(plainDbMessage(error) ?? 'The people who made it with you weren’t added. Add them on the drink’s page.');
      }

      // "Just me": the notes are yours alone, never the drink's.
      if (draft.notesPrivate && draft.notes.trim()) {
        try {
          await savePrivateNote(id, draft.notes);
        } catch {
          warnings.push(`Your note wasn’t saved: “${draft.notes.trim().slice(0, 80)}”. Add it again on the drink’s page.`);
        }
      }

      // Photos picked on the review: the hero and the service angles. One that
      // fails is said, not fatal: the drink is saved and photos can follow.
      let photosMissed = 0;
      for (const [angle, uri] of Object.entries(draft.photos ?? {}) as [ImageAngle, string][]) {
        const image = await uploadDrinkPhoto(uri, `cocktails/${id}`).catch(() => null);
        const linked = image ? await supabase.from('item_images').insert({ item_id: id, image_id: image.id, angle, sort_order: 0 }) : null;
        if (!image || linked?.error) photosMissed += 1;
      }
      if (photosMissed) warnings.push(photosMissed === 1 ? 'One photo wasn’t added. Add it on the drink’s page.' : `${photosMissed} photos weren’t added. Add them on the drink’s page.`);
      if (Object.keys(draft.photos ?? {}).length) void qc.invalidateQueries({ queryKey: ['cocktail', id] });

      await saveOwnPreps();

      // Only rows this save made get a card: an existing prep keeps its own.
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

      if (barId) warnings.push(...(await saveNewBottles(barId, bottles)));

      if (menuSectionId) useMenuDrinkHandoff.getState().deliver(menuSectionId, id);

      // The worker writes its drawing inputs a little later; until then (and
      // instead of a cached "none yet") it shows the drawing the wizard did.
      if (sketch) qc.setQueryData(['item-sketch', id], sketch);
      useRecentActivityStore.getState().push(recentEntry('cocktail', id, capitalize(draft.name), { barId }));
      void qc.invalidateQueries({ queryKey: ['cocktails'] });
      // The next drink by this name is told the bar has one now (useSameNameDrink).
      void qc.invalidateQueries({ queryKey: ['same-name-drink'] });
      if (barId) void qc.invalidateQueries({ queryKey: ['bar', barId] });
      if (newSpecs) void qc.invalidateQueries({ queryKey: dropdownKeys.specs });
      void refreshIngredients(qc, newIngredients);
      if (creatorId) void qc.invalidateQueries({ queryKey: ['profile-originals'] });
      if (draft.notesPrivate) void qc.invalidateQueries({ queryKey: ['private-note', id] });
      return { id, warnings, created, later };
    },
    onSuccess: (_, { barId, menuSectionId }) => track('drink_created', { at_bar: !!barId, on_menu: !!menuSectionId }),
    // The wizard says what went wrong itself, and keeps the draft.
    onError: () => {},
  });
}

/** A new row's name: an ingredient's first letter up, a method the wizard offers as the wizard spells it ("Whip (whisk or frother)"), anything else in title case. */
function newItemName(name: string, type: ItemType): string {
  if (type === 'ingredient') return capitalizeFirst(name);
  const ours = type === 'method' ? COMMON_METHODS.find((m) => m.toLowerCase() === name.trim().toLowerCase()) : undefined;
  return ours ?? capitalize(name);
}
