import { useMutation, useQueryClient } from '@tanstack/react-query';

import { uploadDrinkPhoto } from '@/components/drink/drinkImages';
import { useUserId } from '@/ctx/AuthContext';
import { dropdownKeys, refreshIngredients } from '@/hooks/useDropdowns';
import { saveItemNotes } from '@/hooks/useItemNotes';
import { savePrivateNote } from '@/hooks/usePrivateNote';
import { recentEntry } from '@/hooks/useTrackRecent';
import { useRefreshSpecs } from '@/hooks/useBulk';
import { liveIds, specLineSaver } from '@/hooks/specLineSave';
import { saveDrinkSpec, type SpecLineInput } from '@/hooks/useVersions';
import { track } from '@/lib/analytics';
import { plainDbMessage } from '@/lib/dbError';
import { orderedMethodIds } from '@/lib/drinkMethods';
import { linePart, storedParts } from '@/lib/drinkParts';
import { creatorProfileId, notesArePrivate, specLines, type WizardDraft } from '@/lib/drinkWizard';
import { fetchEditableRecipes } from '@/lib/editableRecipes';
import { saysMore, toStored, type IceLayer } from '@/lib/iceBuild';
import type { ImageAngle } from '@/lib/itemImages';
import { formatPrice } from '@/lib/menus';
import { priceText } from '@/lib/money';
import { capitalize } from '@/lib/stringUtils';
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

      const lines: SpecLineInput[] = [];
      const garnishes = new Set(draft.garnishes.map((g) => g.key));
      for (const { line, amount } of specLines(draft)) {
        lines.push({
          id: null,
          ingredient_item_id: await saver.line(line),
          amount,
          unit: line.unit || null,
          preparation_notes: line.note?.trim() || null,
          is_optional: !!line.optional,
          is_float: !!line.float,
          ...(draft.parts?.length ? { part: linePart(draft.parts, line.key, garnishes.has(line.key)) } : {}),
        });
      }
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
        // Its ranks, photos and menus stay; the spec it had is the version before, so it can be put back.
        const [had, hadMethods] = await Promise.all([fetchEditableRecipes(updateId), supabase.from('item_methods').select('method_item_id, sort_order').eq('item_id', updateId)]);
        if (hadMethods.error) throw hadMethods.error;
        // Its own rows keep their notes and service decisions, and a sheet that names no method we know (it went to notes) keeps the drink's.
        await saveDrinkSpec(updateId, ontoBarLines(lines, had), methodIds.length ? methodIds : orderedMethodIds(hadMethods.data), 'Updated from Bring in');
        // A batch read from the sheet keeps its bottle's recipe.
        await saver.saveOwnPreps();
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

      // At home the notes are yours to start (Q27); at a venue, the drink's.
      const privateNotes = notesArePrivate(draft, barId);
      const row: Insert<'items'> = {
        id: undefined,
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
        await saveDrinkSpec(id, lines, methodIds, null, parts);
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

      // "Just me": the notes are yours alone, never the drink's. Otherwise
      // they're the drink's, for a role and up at a venue (E29).
      if (privateNotes && draft.notes.trim()) {
        try {
          await savePrivateNote(id, draft.notes);
        } catch {
          warnings.push(`Your note wasn’t saved: “${draft.notes.trim().slice(0, 80)}”. Add it again on the drink’s page.`);
        }
      } else if (draft.notes.trim()) {
        try {
          await saveItemNotes(id, draft.notes, barId ? (draft.notesLevel ?? null) : null);
        } catch {
          warnings.push(`The notes weren’t saved: “${draft.notes.trim().slice(0, 80)}”. Add them again on the drink’s page.`);
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

      await saver.saveOwnPreps();
      await saver.saveCards();
      await saver.saveBottles();

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
    },
    onSuccess: (_, { barId, menuSectionId }) => track('drink_created', { at_bar: !!barId, on_menu: !!menuSectionId }),
    // The wizard says what went wrong itself, and keeps the draft.
    onError: () => {},
  });
}
