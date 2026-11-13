import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { uploadDrinkPhoto } from '@/components/drink/drinkImages';
import { useUserId } from '@/ctx/AuthContext';
import { dropdownKeys, refreshIngredients } from '@/hooks/useDropdowns';
import { saveItemNotes } from '@/hooks/useItemNotes';
import { savePrivateNote } from '@/hooks/usePrivateNote';
import { recentEntry } from '@/hooks/useTrackRecent';
import { refreshSpecs } from '@/hooks/useBulk';
import { linesOnKeptHouseMades, liveIds, specLineSaver, withKeptHouseMades } from '@/hooks/specLineSave';
import { saveDrinkSpec, type SpecLineInput } from '@/hooks/useVersions';
import { track } from '@/lib/analytics';
import { saveWritesNow } from '@/lib/keptWrites';
import { NEW_DRINK, specFingerprint } from '@/lib/offlineWrites';
import { saveErrorWords } from '@/lib/saveErrorWords';
import { STILL_IN_ADD } from '@/lib/unsentRows';
import { toastDone } from '@/lib/toast';
import { plainDbMessage } from '@/lib/dbError';
import { orderedMethodIds } from '@/lib/drinkMethods';
import { linePart, storedParts } from '@/lib/drinkParts';
import { creatorProfileId, newDraftId, notesArePrivate, savedNotice, specLines, type WizardDraft, type WizardLine } from '@/lib/drinkWizard';
import { fetchEditableRecipes } from '@/lib/editableRecipes';
import { saysMore, toStored, type IceLayer } from '@/lib/iceBuild';
import type { ImageAngle } from '@/lib/itemImages';
import { formatPrice } from '@/lib/menus';
import { priceText } from '@/lib/money';
import { capitalize } from '@/lib/stringUtils';
import { ontoBarLines } from '@/lib/sameName';
import type { SketchInputs } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';
import { namedOnly } from '@/lib/whoMadeIt';
import type { Insert, Json } from '@/types/db';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';
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
  /** Saved with no signal (Save on this phone): it waits on the phone, through a relaunch, and says so when it's in or refused. */
  queued?: boolean;
  /** The kept draft as it was when Save was pressed (specFingerprint): once it's in, a draft still the same goes; one changed since stays. */
  keptPrint?: string;
  /** Filled in as it sends, and saved with it (createDrink): sent again after the app was killed mid-send, it repeats nothing. */
  sent?: SentDrink;
}

/**
 * What a save froze as it went: the save_drink call exactly as sent (so a repeat is the same save, and the
 * database hands back the same drink), each photo's uploaded image, and the steps after it that are done.
 */
export interface SentDrink {
  key?: string;
  save?: Json;
  images?: Partial<Record<ImageAngle, string>>;
  done?: string[];
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

/**
 * Saves the add-drink wizard's drink in one go, at the end: any method, glass
 * or ice typed in that doesn't exist yet (found by name when tried again),
 * then one save_drink call with the drink, its credits, its spec (a first
 * version), its house-mades and every ingredient typed in: all or none. Its
 * key is the draft's id, kept on the device until this succeeds, so a try
 * whose reply was lost gets the same drink back, never a copy.
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

/**
 * The save itself. It reads only its input (and who is signed in when it
 * sends), so one kept on the phone sends the same after a relaunch.
 */
export async function createDrink(input: CreateDrinkInput, qc: QueryClient, signedIn?: string | null): Promise<CreateDrinkResult> {
  const { draft, barId, myProfileId, menuSectionId, sketch, updateId } = input;
  // Frozen in the write's own variables as it goes, and saved with it before the next request: a kill mid-send
  // sends the same save again (the same drink back) and skips what's done. Only a stored write saves (keptWrites).
  const sent = (input.sent ??= {});
  const done = new Set(sent.done);
  const keep = () => saveWritesNow(input);
  const mark = async (step: string) => {
    done.add(step);
    sent.done = [...done];
    await keep();
  };
  // One sent after a relaunch reads who's signed in from the session on the device (no request): sign-out drops another person's waiting saves (lib/clearUserData.ts).
  const userId = signedIn ?? (await supabase.auth.getSession()).data.session?.user.id;
  if (!userId) throw new Error('Sign in to save drinks.');
  // A picked row can be gone by now (merged into another ingredient since
  // the draft was made, 20261008100000): those go by name, like a typed one.
  const live = await liveIds([
    ...specLines(draft).map(({ line }) => line.id),
    ...draft.methods.map((m) => m.id),
    draft.glass?.id,
    draft.ice?.id,
    draft.methodIce?.id,
    ...(draft.iceBuild ?? []).map((l) => l.ice.id),
  ]);
  const saver = specLineSaver(barId, live);
  const { ensure, warnings, created, later, newIngredients } = saver;
  const creatorId = creatorProfileId(draft, myProfileId);
  const creatorNames = namedOnly(draft);
  // At home the notes are yours to start (Q27); at a venue, the drink's.
  const privateNotes = notesArePrivate(draft, barId);
  // Who made it (item_credits), as the drink editor saves it: the creator and people with no page, by name (tf-063).
  const saveCredits = (id: string, add: string[]) =>
    // Null is nobody; the generated types don't say a uuid argument can be null.
    supabase.rpc('set_drink_credits', { p_item_id: id, p_creator_profile_id: creatorId as string, p_creator_names: creatorNames, p_add: add, p_remove: [] });
  const spec = specLines(draft);
  const garnishes = new Set(draft.garnishes.map((g) => g.key));
  const specOf = (line: WizardLine, i: number) => ({
    id: null,
    amount: spec[i].amount,
    unit: line.unit || null,
    preparation_notes: line.note?.trim() || null,
    is_optional: !!line.optional,
    is_float: !!line.float,
    ...(draft.parts?.length ? { part: linePart(draft.parts, line.key, garnishes.has(line.key)) } : {}),
  });
  const key = (sent.key ??= draft.id ?? newDraftId());
  const freeze = async (save: Json) => {
    if (sent.save === undefined) {
      sent.save = save;
      await keep();
    }
    return sent.save;
  };
  const id = await (async () => {
    // Sent before: the same save again, not one rebuilt from what's read now (a price, a credit), which the database would take as a new drink.
    if (!updateId && sent.save !== undefined) return (await saver.saveDrink(key, spec.map(({ line }) => line), {}, specOf, freeze)).item;
    // Made in parts: each part's methods in turn, with its number (Build can be in two parts).
    const methodIds: string[] = [];
    const methodParts: number[] = [];
    const byPart = draft.parts?.length ? draft.parts.flatMap((p, i) => p.methods.map((m) => ({ m, part: i + 1 }))) : draft.methods.map((m) => ({ m, part: 1 }));
    for (const { m, part } of byPart) {
      methodIds.push(await ensure(m, 'method'));
      methodParts.push(part);
    }
    const parts = draft.parts?.length ? { methodParts, parts: storedParts(draft.parts) } : undefined;
    if (updateId) {
      // ponytail: Bring in's "Update it" stays on the two-step save (house-mades first, taken out again on a refusal):
      // ontoBarLines needs every line's row before the spec is written. It moves to save_drink with useIngredientEditor.
      await saver.houseMades(spec.map(({ line }) => line));
      try {
        const lines: SpecLineInput[] = [];
        for (const [i, { line }] of spec.entries()) lines.push({ ...specOf(line, i), ingredient_item_id: await saver.line(line) });
        // Its ranks, photos and menus stay; the spec it had is the version before, so it can be put back.
        const [had, hadMethods] = await Promise.all([fetchEditableRecipes(updateId), supabase.from('item_methods').select('method_item_id, sort_order').eq('item_id', updateId)]);
        if (hadMethods.error) throw hadMethods.error;
        // Its own rows keep their notes and service decisions, and a sheet that names no method we know (it went to notes) keeps the drink's.
        await saveDrinkSpec(updateId, ontoBarLines(lines, had), methodIds.length ? methodIds : orderedMethodIds(hadMethods.data), 'Updated from Bring in');
      } catch (e) {
        // Taken out again on a plain refusal; still saved after a dropped connection, and the error says which, for the draft's lines to point at.
        const kept = await saver.dropHouseMades(e);
        // Part of it is in: sent again as it was, it would be refused by those names, so it isn't retried; the draft's lines move onto them (newDrinkFailed).
        throw withKeptHouseMades(kept.size ? partlySaved() : e, kept);
      }
      return updateId;
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
      const { data, error } = await supabase.from('profiles').select('id').eq('bar_id', barId).eq('kind', 'bar').limit(1).maybeSingle();
      // Not read is not "none": a missing credit would also change the save's key, and a retry would make a second drink.
      if (error) throw error;
      originBar = data?.id ?? null;
    }
    // Another bar's name on it is a suggestion until the bar confirms it, as a drink added in setup is (useSaveCareerDrink).
    const otherBar = fromElsewhere && !!originBar;

    const row: Insert<'items'> = {
      // Under the draft's id, so it's drawn with the wizard's seed; the database gives one that's taken an id of its own.
      id: draft.id,
      name: capitalize(draft.name),
      item_type: 'cocktail',
      bar_id: barId,
      description: draft.description.trim() || null,
      glassware_id: glassId,
      sketch_variant: draft.glassVariant ?? null,
      // One of the venue's real glasses, when one was picked; the database sets glassware_id to its kind.
      ...(draft.glassModelId ? { glass_model_id: draft.glassModelId } : {}),
      // The colour picked as it was made; the database copies it into the drawing (20261017100000_sketch_liquid).
      sketch_liquid: draft.tint ?? null,
      // A hero photo replaces the drawing unless Keep it was picked (20261123200000_show_sketch). Only when it does, so other saves never send the column.
      ...(draft.photos?.hero && !draft.keepDrawing ? { show_sketch: false } : {}),
      ice_id: iceId,
      // Only when there is one: a database without 20261029100000 refuses an unknown column, so every other save keeps working whichever lands first.
      ...(methodIceId ? { method_ice_id: methodIceId } : {}),
      // The same for the build (20261029500000).
      ...(iceBuild ? { ice_build: iceBuild } : {}),
      based_on_id: draft.riffOf?.id ?? null,
      based_on_kind: draft.riffOf ? 'riff' : null,
      // The bar it was first made at (its credit follows from it); who made it is saved below.
      origin_bar_profile_id: originBar,
      origin_year: draft.originYear ?? null,
      price: barId ? await draftPrice(draft, barId) : null,
    };
    const saved = await saver.saveDrink(
      key,
      spec.map(({ line }) => line),
      {
        drink: row,
        // Every method, in order, in the same transaction as the spec.
        methods: methodIds,
        ...(parts ? { method_parts: parts.methodParts, parts: parts.parts } : {}),
        // You can say yes to your own credit; anyone else's starts as suggested.
        credits: { creator: creatorId, names: creatorNames, accept: !!creatorId && creatorId === myProfileId && !otherBar },
      },
      specOf,
      freeze,
    );
    return saved.item;
  })();

  if (updateId) {
    // A batch read from the sheet keeps its bottle's recipe.
    await afterSaved(warnings, () => saver.saveOwnPreps());
    void qc.invalidateQueries({ queryKey: ['same-name-drink'] });
    void refreshSpecs(qc, { drinkIds: [updateId], ingredientIds: newIngredients });
    return { id: updateId, warnings, created, later };
  }

  // The drawing the wizard showed stays the drink's: the worker won't
  // repaint it until the drink changes (20261009750000_maker_drawings).
  // Decorative, so a failure only means the worker draws it as usual.
  // No glass drawing picked goes without "variant": the database stores
  // the default drawing that way and refuses a null one.
  if (sketch && !done.has('sketch')) {
    // The database adds the build from the drink's own (20261029500000), and an older one refuses the key.
    // The ice's look, the glass's height and its traced outline are the venue's, not the drink's, so they aren't sent either.
    const { variant, build: _build, iceLook: _look, glassMm: _mm, outline: _outline, ...rest } = sketch;
    const { error } = await supabase.rpc('save_maker_sketch', { p_item_id: id, p_inputs: variant ? { ...rest, variant } : rest });
    if (!error) await mark('sketch');
  }

  if (draft.publish && !done.has('publish')) {
    const { error } = await supabase.from('items').update({ publish_mode: draft.publish }).eq('id', id);
    if (error) warnings.push(plainDbMessage(error) ?? 'It’s saved as private: who can see it didn’t change.');
    else await mark('publish');
  }

  // Not the person credited first, and only people with a profile (the database checks both).
  const coIds = [...new Set((draft.coCreators ?? []).map((c) => c.id).filter((p): p is string => !!p && p !== creatorId))];
  if (coIds.length && !done.has('credits')) {
    const { error } = await saveCredits(id, coIds);
    if (error) warnings.push(plainDbMessage(error) ?? 'The people who made it with you weren’t added. Add them on the drink’s page.');
    else await mark('credits');
  }

  // "Just me": the notes are yours alone, never the drink's. Otherwise
  // they're the drink's, for a role and up at a venue (E29).
  if (done.has('notes')) {
    // Saved by the send before this one: not again, over an edit made since.
  } else if (privateNotes && draft.notes.trim()) {
    try {
      await savePrivateNote(id, draft.notes);
      await mark('notes');
    } catch {
      warnings.push(`Your note wasn’t saved: “${draft.notes.trim().slice(0, 80)}”. Add it again on the drink’s page.`);
    }
  } else if (draft.notes.trim()) {
    try {
      await saveItemNotes(id, draft.notes, barId ? (draft.notesLevel ?? null) : null);
      await mark('notes');
    } catch {
      warnings.push(`The notes weren’t saved: “${draft.notes.trim().slice(0, 80)}”. Add them again on the drink’s page.`);
    }
  }

  // Photos picked on the review: the hero and the service angles. One that
  // fails is said, not fatal: the drink is saved and photos can follow.
  let photosMissed = 0;
  for (const [angle, uri] of Object.entries(draft.photos ?? {}) as [ImageAngle, string][]) {
    if (done.has(`photo:${angle}`)) continue;
    // Uploaded once: a repeat links the image the send before uploaded.
    let imageId = sent.images?.[angle];
    if (!imageId) {
      imageId = (await uploadDrinkPhoto(uri, `cocktails/${id}`).catch(() => null))?.id;
      if (imageId) {
        sent.images = { ...sent.images, [angle]: imageId };
        await keep();
      }
    }
    const linked = imageId ? await supabase.from('item_images').insert({ item_id: id, image_id: imageId, angle, sort_order: 0 }) : null;
    if (!imageId || linked?.error) photosMissed += 1;
    else await mark(`photo:${angle}`);
  }
  if (photosMissed) warnings.push(photosMissed === 1 ? 'One photo wasn’t added. Add it on the drink’s page.' : `${photosMissed} photos weren’t added. Add them on the drink’s page.`);
  if (Object.keys(draft.photos ?? {}).length) void qc.invalidateQueries({ queryKey: ['cocktail', id] });

  if (!done.has('preps')) {
    const said = warnings.length;
    await afterSaved(warnings, async () => {
      await saver.saveOwnPreps();
      await saver.saveCards();
      await saver.saveBottles();
    });
    if (warnings.length === said) await mark('preps');
  }

  if (menuSectionId) useMenuDrinkHandoff.getState().deliver(menuSectionId, id);

  // The worker writes its drawing inputs a little later; until then (and
  // instead of a cached "none yet") it shows the drawing the wizard did.
  if (sketch) qc.setQueryData(['item-sketch', id], sketch);
  useRecentActivityStore.getState().push(recentEntry('cocktail', id, capitalize(draft.name), { barId }));
  void qc.invalidateQueries({ queryKey: ['cocktails'] });
  // The next drink by this name is told the bar has one now (useSameNameDrink).
  void qc.invalidateQueries({ queryKey: ['same-name-drink'] });
  if (barId) void qc.invalidateQueries({ queryKey: ['bar', barId] });
  // A new drink linked to a classic joins Library's Classics.
  if (barId && draft.riffOf) void qc.invalidateQueries({ queryKey: ['staff-list-riffs', barId] });
  if (saver.newSpecs()) void qc.invalidateQueries({ queryKey: dropdownKeys.specs });
  void refreshIngredients(qc, newIngredients);
  if (creatorId) void qc.invalidateQueries({ queryKey: ['profile-originals'] });
  if (privateNotes) void qc.invalidateQueries({ queryKey: ['private-note', id] });
  return { id, warnings, created, later };
}

/** A save stopped part way by a dropped connection: not a network error, so it isn't sent again as it was. */
function partlySaved(): Error {
  return Object.assign(new Error('The connection dropped part way through. Save it again.'), { code: 'partly-saved' });
}

/**
 * Once the drink is in, a step after it that fails is said, not thrown:
 * a dropped connection would otherwise send the whole save again, and its
 * photos would be added twice.
 */
async function afterSaved(warnings: string[], step: () => Promise<unknown>) {
  try {
    await step();
  } catch (e) {
    warnings.push(`Some of what it uses wasn’t saved. ${saveErrorWords(e)}`);
  }
}

/**
 * Once it's in: the draft it came from goes, unless it changed since it was
 * kept (picked up again while waiting), then it stays as a new draft so
 * nothing typed is lost. One that waited says so, wherever you are by then.
 */
export function newDrinkSaved(qc: QueryClient, { warnings, later }: CreateDrinkResult, input: CreateDrinkInput) {
  track('drink_created', { at_bar: !!input.barId, on_menu: !!input.menuSectionId });
  // A try of this draft refused earlier (listed as didn't send) is done with now.
  const writes = qc.getMutationCache();
  for (const w of writes.findAll({ mutationKey: NEW_DRINK, status: 'error' })) {
    if ((w.state.variables as CreateDrinkInput | undefined)?.draft.id === input.draft.id) writes.remove(w);
  }
  const store = useDrinkWizardStore.getState();
  for (const [place, kept] of Object.entries(store.kept)) {
    if (!input.draft.id || kept.draft.id !== input.draft.id) continue;
    if (specFingerprint(kept.draft) === (input.keptPrint ?? specFingerprint(input.draft))) store.clear(place);
    // Its id is the saved drink's now: the changes keep a fresh one, so saving them makes a drink, not a no-op.
    else store.patch(place, { id: newDraftId() });
  }
  if (!input.queued) return;
  toastDone('Drink saved', input.draft.name.trim());
  const notice = savedNotice(warnings, later ?? []);
  if (notice) Alert.alert(notice.title, notice.body);
}

/** A save that waited and was refused: said here (the wizard has closed), and kept in Add and in what's waiting to send. */
export function newDrinkFailed(e: unknown, input: CreateDrinkInput) {
  // House-mades it left saved: the kept draft's lines use them now, so saving it again isn't refused by their names.
  const store = useDrinkWizardStore.getState();
  for (const [place, kept] of Object.entries(store.kept)) {
    if (!input.draft.id || kept.draft.id !== input.draft.id) continue;
    const on = linesOnKeptHouseMades(e, kept.draft);
    if (on) store.patch(place, on);
  }
  if (input.queued) Alert.alert(`Couldn’t save ${input.draft.name.trim() || 'the drink'}`, `${saveErrorWords(e)} ${STILL_IN_ADD}`);
}

export function useCreateDrink() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    // Its defaults (lib/react-query.ts): try again on a dropped connection, wait for signal, in order with other waiting writes.
    mutationKey: NEW_DRINK,
    mutationFn: (input: CreateDrinkInput) => createDrink(input, qc, userId),
    onSuccess: (result, input) => newDrinkSaved(qc, result, input),
    // The wizard says what went wrong itself, and keeps the draft; one that waited is said here.
    onError: (e, input) => newDrinkFailed(e, input),
  });
}
