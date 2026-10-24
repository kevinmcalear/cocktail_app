import { useState } from 'react';
import { Alert } from 'react-native';

import { useIngredientEditor, type IngredientForm } from '@/hooks/useIngredientEditor';
import { useItemPrep, useSaveItemPrep } from '@/hooks/usePrepCard';
import { prepCardInput, prepFields, samePrepCard, type PrepFields } from '@/lib/prepCardForm';

import { useSnapshotHistory } from '../../drink/edit/useEditHistory';

/**
 * Everything editing an ingredient in place changes (ingredient-edit-proposal):
 * its row and recipe (useIngredientEditor), and for a house prep its card
 * (method, how it keeps). Undo and redo cover both; `save` writes what changed.
 */
export function useIngredientEdit(id: string) {
  const editor = useIngredientEditor(id);
  const { data: card } = useItemPrep(id);
  const savePrep = useSaveItemPrep(id);
  const [prep, setPrepState] = useState<PrepFields | null>(null);
  const [savedPrep, setSavedPrep] = useState<PrepFields | null>(null);

  // Once, like the row: a refetch mustn't undo what's typed. Set while rendering, as React's
  // "adjusting state when a prop changes" does, so the first paint already has it.
  if (card && !savedPrep) {
    const f = prepFields(card);
    setPrepState(f);
    setSavedPrep(f);
  }

  const setPrep = (patch: Partial<PrepFields>) => setPrepState((p) => (p ? { ...p, ...patch } : p));
  const prepDirty = !!prep && !!savedPrep && !samePrepCard(prep, savedPrep);
  const history = useSnapshotHistory(editor.loaded && prep ? { form: editor.form, prep } : null, (s: { form: IngredientForm; prep: PrepFields }) => {
    editor.set(s.form);
    setPrepState(s.prep);
  });

  const save = async (): Promise<boolean> => {
    if (prep && prepDirty) {
      const { problem, input } = prepCardInput(prep);
      if (problem) {
        Alert.alert('Check how it keeps', problem);
        return false;
      }
      try {
        await savePrep.mutateAsync(input);
        setSavedPrep(prep);
      } catch (e) {
        Alert.alert('Couldn’t save the method', e instanceof Error ? e.message : 'Try again.');
        return false;
      }
    }
    return editor.isDirty ? editor.save() : true;
  };

  const discard = () => {
    if (editor.saved) editor.set(editor.saved);
    if (savedPrep) setPrepState(savedPrep);
  };

  return {
    editor,
    prep,
    setPrep,
    card,
    history,
    dirty: editor.isDirty || prepDirty,
    saving: editor.saving || savePrep.isPending,
    loading: editor.loading || !prep,
    save,
    discard,
  };
}

export type IngredientEdit = ReturnType<typeof useIngredientEdit>;
