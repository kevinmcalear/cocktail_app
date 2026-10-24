import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useIngredientDraftEditor, useIngredientEditor, type IngredientEditor, type IngredientForm } from '@/hooks/useIngredientEditor';
import { useItemPrep, useSaveItemPrep, type PrepCardData } from '@/hooks/usePrepCard';
import { prepCardInput, prepFields, samePrepCard, type PrepFields } from '@/lib/prepCardForm';

import type { PendingEdits } from '../../drink/edit/VenueSections';
import { useSnapshotHistory } from '../../drink/edit/useEditHistory';

/** A saved ingredient: its row and recipe, and for a house prep its card (method, how it keeps). */
export function useIngredientEdit(id: string) {
  const editor = useIngredientEditor(id);
  const { data: card } = useItemPrep(id);
  const savePrep = useSaveItemPrep(id);
  return useEditState(editor, card, savePrep);
}

const NO_CARD: PrepCardData = { prep: null, steps: [] };

/** A draft from New > Drafts: its form only, kept a draft until More > Publish. */
export function useIngredientDraftEdit(opts: Parameters<typeof useIngredientDraftEditor>[0]) {
  return useEditState(useIngredientDraftEditor(opts), NO_CARD, null);
}

/**
 * Everything editing an ingredient in place changes (ingredient-edit-proposal):
 * the form, the prep card and the bottle's price at the venue. Undo and redo
 * cover the form and the card; `save` writes what changed.
 */
function useEditState(editor: IngredientEditor, card: PrepCardData | undefined, savePrep: ReturnType<typeof useSaveItemPrep> | null) {
  const [prep, setPrepState] = useState<PrepFields | null>(null);
  const [savedPrep, setSavedPrep] = useState<PrepFields | null>(null);
  // Sections that save their own rows with Done (the bottle's price).
  const pending = useRef<PendingEdits | null>(null);
  const [pendingDirty, setPendingDirty] = useState(false);

  // Once, like the row: a refetch mustn't undo what's typed. Set while rendering, as React's
  // "adjusting state when a prop changes" does, so the first paint already has it.
  if (card && !savedPrep) {
    const f = prepFields(card);
    setPrepState(f);
    setSavedPrep(f);
  }

  const setPrep = (patch: Partial<PrepFields>) => setPrepState((p) => (p ? { ...p, ...patch } : p));
  const prepDirty = !!savePrep && !!prep && !!savedPrep && !samePrepCard(prep, savedPrep);
  const history = useSnapshotHistory(editor.loaded && prep ? { form: editor.form, prep } : null, (s: { form: IngredientForm; prep: PrepFields }) => {
    editor.set(s.form);
    setPrepState(s.prep);
  });

  const save = async (): Promise<boolean> => {
    if (savePrep && prep && prepDirty) {
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
    if (pending.current?.dirty && !(await pending.current.save())) return false;
    if (!editor.isDirty) return true;
    return 'saveAsDraft' in editor ? editor.saveAsDraft() : editor.save();
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
    dirty: editor.isDirty || prepDirty || pendingDirty,
    saving: editor.saving || !!savePrep?.isPending,
    loading: editor.loading || !prep,
    save,
    discard,
    onPending: (p: PendingEdits) => {
      pending.current = p;
      if (p.dirty !== pendingDirty) setPendingDirty(p.dirty);
    },
  };
}

export type IngredientEdit = ReturnType<typeof useIngredientEdit>;
