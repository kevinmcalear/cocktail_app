import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { useBringInSave } from '@/hooks/useBringInSave';
import type { RecipeChoices } from '@/lib/bringInDraft';
import type { MatchData } from '@/lib/bringInMatch';
import { approved, canCheck, isFinished, nextOpen, setMark, tally } from '@/lib/importReview';
import { useBringIn } from '@/store/useBringIn';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

import { useRecipeMaker } from './useRecipeMaker';

// Saves run one after another, even across screens: two drinks needing the
// same new ingredient must not both make it.
let line: Promise<unknown> = Promise.resolve();

const stamp = () => new Date().toISOString();

/**
 * A big import being reviewed (lib/importReview.ts): Approve saves the drink
 * through Bring in's own save at once, then moves on; Skip moves on; what's
 * left waits on this device. When the last drink is checked, Brought in shows
 * what the approved ones made.
 */
export function useImportReview(id: string, data: MatchData) {
  const router = useRouter();
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
    const drink = toMake(r.recipes[i], r.choices[i]);
    const name = r.choices[i].name.trim();
    // Marked (and kept) before it's sent: a review read back after the app
    // stopped mid-save keeps it approved and never sends it again.
    edit((x) => setMark(x, i, 'saving', stamp()));
    setError(null);
    moveOn(i);
    line = line.then(async () => {
      try {
        const done = await save.mutateAsync({ kind: 'recipes', source: r.source, drinks: [drink] });
        edit((x) => approved(x, i, { drinkId: done.drinkIds[0] ?? null, summary: done.summary, warnings: done.warnings }, stamp()));
      } catch (e) {
        edit((x) => setMark(x, i, null, stamp()));
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

  const setChoices = (i: number, change: (c: RecipeChoices) => RecipeChoices) => edit((r) => ({ ...r, choices: r.choices.map((c, k) => (k === i ? change(c) : c)) }));

  /** The full editor for one drink, filled in; saving there approves it here (app/add-cocktail.tsx). */
  const editDrink = (i: number) => {
    const r = current();
    if (!r || !canCheck(r, i)) return;
    const wizardAt = wizardPlace(r.barId);
    const wizard = useDrinkWizardStore.getState();
    wizard.clear(wizardAt);
    wizard.patch(wizardAt, toMake(r.recipes[i], r.choices[i]).draft);
    wizard.setStep(wizardAt, 'review');
    const query = `review=${encodeURIComponent(id)}&drink=${i}`;
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

  return { review, usual, toMake, error, go, approve, skip, setChoices, editDrink };
}
