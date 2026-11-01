import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ds';
import { useBringInSave } from '@/hooks/useBringInSave';
import { refreshIngredients } from '@/hooks/useDropdowns';
import { useCreatePrep } from '@/hooks/usePrepCard';
import { recipePrep, type RecipeChoices } from '@/lib/bringInDraft';
import type { MatchData } from '@/lib/bringInMatch';
import { approved, canCheck, isFinished, nextOpen, putBack, rematch, setMark, takeOut, tally, type ImportReview } from '@/lib/importReview';
import { useBringIn } from '@/store/useBringIn';
import { draftSlot, reviewSlots, useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

import { useRecipeMaker } from './useRecipeMaker';

// Saves run one after another, even across screens: two drinks needing the
// same new ingredient must not both make it.
let line: Promise<unknown> = Promise.resolve();

const stamp = () => new Date().toISOString();

/** Where a drink is now: taking one out moves the ones after it up, so a save in flight finds its drink by its recipe. */
const placeOf = (review: ImportReview | undefined, recipe: ImportReview['recipes'][number]) => review?.recipes.indexOf(recipe) ?? -1;

/**
 * A big import being reviewed (lib/importReview.ts): Approve saves the drink
 * through Bring in's own save at once, then moves on; Skip moves on; what's
 * left waits on this device. When the last drink is checked, Brought in shows
 * what the approved ones made.
 */
export function useImportReview(id: string, data: MatchData) {
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const createPrep = useCreatePrep();
  const review = useBringIn((s) => s.reviews[id]);
  const save = useBringInSave(review?.barId ?? null);
  const { usual, toMake } = useRecipeMaker(data);
  const [error, setError] = useState<string | null>(null);
  const edit = (change: Parameters<ReturnType<typeof useBringIn.getState>['editReview']>[1]) => useBringIn.getState().editReview(id, change);
  const current = () => useBringIn.getState().reviews[id];

  const go = (i: number) => edit((r) => (i >= 0 && i < r.recipes.length ? { ...r, at: i } : r));
  const moveOn = (from: number) => {
    const r = current();
    const next = r ? nextOpen(r.marks, from) : null;
    if (next !== null) go(next);
  };

  const approve = (i: number) => {
    const r = current();
    if (!r || !canCheck(r, i) || !r.choices[i]?.name.trim()) return;
    const name = r.choices[i].name.trim();
    const which = r.recipes[i];
    // Marked (and kept) before it's sent: a review read back after the app
    // stopped mid-save keeps it approved and never sends it again.
    edit((x) => setMark(x, i, 'saving', stamp()));
    setError(null);
    moveOn(i);
    line = line.then(async () => {
      try {
        // Made when its turn comes, so a batch an earlier drink just saved is used, not made again.
        const x = current() ?? r;
        const k = placeOf(x, which);
        const drink = toMake(which, x.choices[k] ?? r.choices[i], x.batches);
        const done = await save.mutateAsync({ kind: 'recipes', source: r.source, drinks: [drink] });
        edit((y) => approved(y, placeOf(y, which), { drinkId: done.drinkIds[0] ?? null, summary: done.summary, warnings: done.warnings, batches: done.batches }, stamp()));
      } catch (e) {
        edit((x) => setMark(x, placeOf(x, which), null, stamp()));
        setError(`${name} didn’t save, so it’s still to check. ${e instanceof Error ? e.message : ''}`.trim());
      }
    });
  };

  const skip = (i: number) => {
    const r = current();
    if (!r || !canCheck(r, i)) return;
    edit((x) => setMark(x, i, 'skipped', stamp()));
    moveOn(i);
  };

  /**
   * Not a drink (board w2-import-review E20): gone from the list and the
   * count, with Undo. `lift`: the toast sits above the screen's pinned
   * buttons. The last drink to check taken out ends the review, so there's
   * nothing to undo into.
   */
  const takeOutDrink = (i: number, lift = 0) => {
    const r = current();
    const out = r ? takeOut(r, i, stamp()) : null;
    if (!out) return;
    edit(() => out.review);
    const title = `${r!.choices[i]?.name.trim() || out.gone.recipe.name} taken out`;
    if (isFinished(out.review)) return void toast.show({ title, lift });
    let used = false;
    toast.show({
      title,
      lift,
      action: {
        label: 'Undo',
        onPress: () => {
          if (used) return;
          used = true;
          edit((x) => putBack(x, out.gone, stamp()));
        },
      },
    });
  };

  /**
   * Not a drink, but worth keeping (E20 B): its recipe saved as a house-made
   * ingredient, then it's taken out, and the drinks still to check that call
   * for it match it once the catalog has it. Throws when the save fails, so
   * the sheet can say why and nothing is taken out.
   */
  const keepHouseMade = async (i: number, lift = 0) => {
    const r = current();
    if (!r || !canCheck(r, i)) return;
    const which = r.recipes[i];
    const name = r.choices[i]?.name.trim() || which.name;
    const made = await createPrep.mutateAsync({ name, prep: recipePrep(which, r.choices[i], data), barId: r.barId });
    // Saved, so it leaves the review whatever happens next: a catalog that can't be read again now still is on the next visit.
    // ponytail: at home a taken name saves as "My House Sweet Vermouth", which lines naming "House sweet vermouth" don't match by name; an alias for the read name would.
    await refreshIngredients(client, [made.id]).catch(() => {});
    const x = current();
    const out = x ? takeOut(x, placeOf(x, which), stamp()) : null;
    if (out) edit(() => rematch({ ...out.review, summary: { ...out.review.summary, preps: [...out.review.summary.preps, made.name] } }, name));
    toast.show({ title: `${made.name} kept as house-made`, detail: made.warnings[0] ?? 'Drinks still to check that use it now find it.', lift });
  };

  const setChoices = (i: number, change: (c: RecipeChoices) => RecipeChoices) => edit((r) => ({ ...r, choices: r.choices.map((c, k) => (k === i ? change(c) : c)) }));

  /**
   * The full editor for one drink, filled in; saving there approves it here (app/add-cocktail.tsx).
   * ponytail: a batch made there isn't recorded in review.batches (the wizard's save returns only the drink's id), so a
   * later drink pouring the same batch makes its own copy. Return what the save made from the wizard to close it.
   */
  const editDrink = (i: number) => {
    const r = current();
    if (!r || !canCheck(r, i)) return;
    // Its own slot: a plain New drink at this place never opens it (Eddie, 29 Oct).
    // ponytail: left without saving, it stays until this drink is edited again or the review is done; a review taken out another way keeps it. Clear on dropReview if that piles up.
    const wizardAt = draftSlot(wizardPlace(r.barId), { review: `${id}#${i}` });
    const wizard = useDrinkWizardStore.getState();
    wizard.clear(wizardAt);
    // Begun afresh, it opens at the first step: the person asked to edit it, not to check it again (Eddie, 26 Oct). Start over comes back to it.
    wizard.begin(wizardAt, toMake(r.recipes[i], r.choices[i], r.batches).draft);
    const query = `review=${encodeURIComponent(id)}&drink=${i}&imported=1`;
    router.push((r.barId ? `/add-cocktail?barId=${r.barId}&${query}` : `/add-cocktail?${query}`) as Href);
  };

  // Every drink checked and saved: Brought in, with what the approved ones made.
  const finished = !!review && isFinished(review);
  useEffect(() => {
    if (!finished) return;
    const r = current();
    if (!r) return;
    const count = tally(r).approved;
    const store = useBringIn.getState();
    store.dropReview(id);
    const wizard = useDrinkWizardStore.getState();
    for (const slot of reviewSlots(wizard.kept, wizardPlace(r.barId), id)) wizard.clear(slot);
    if (!count) return void (router.canGoBack() ? router.back() : router.replace('/(tabs)' as Href));
    store.setDone({
      batchId: null,
      kind: 'recipes',
      title: count === 1 ? (r.choices[r.marks.indexOf('approved')]?.name ?? '1 recipe') : `${count} recipes`,
      source: r.source,
      menuId: null,
      drinkIds: r.drinkIds.filter((d): d is string => !!d),
      summary: r.summary,
      createdAt: stamp(),
      warnings: r.warnings,
    });
    router.replace('/bring-in/done' as Href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  return { review, usual, toMake, error, go, approve, skip, setChoices, editDrink, takeOutDrink, keepHouseMade };
}
