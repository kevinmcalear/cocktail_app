import { useState } from 'react';

import { ensureIngredient } from '@/hooks/useCreateIngredient';
import { useIceStartsFrom, useSaveIceRecipe } from '@/hooks/useIceRecipe';
import { useItemPrep } from '@/hooks/usePrepCard';
import type { VenueIce } from '@/hooks/useVenueIce';
import { iceWay, iceWaySteps, type IceStep, type IceWayKey } from '@/lib/iceRecipes';
import { ICE_YIELD_UNITS, newStepField, prepCardInput, prepFields, samePrepCard, type PrepFields } from '@/lib/prepCardForm';

import type { StartsFromPick } from './StartsFromSheet';

/**
 * An ice's recipe as its editor holds it: the card (steps with their tools,
 * Makes, Keeps) and what it starts from, loaded once so a refetch never
 * undoes what's typed. `start` writes a way's starting recipe into the form;
 * nothing is saved until Save.
 */
export function useIceRecipeEdit(barId: string, ice: VenueIce | null) {
  const iceId = ice?.id ?? null;
  const { data: card } = useItemPrep(iceId);
  const from = useIceStartsFrom(iceId);
  const save = useSaveIceRecipe(iceId ?? '');
  const [fields, setFields] = useState<PrepFields | null>(null);
  const [saved, setSaved] = useState<{ fields: PrepFields; from: StartsFromPick } | null>(null);
  const [startsFrom, setStartsFrom] = useState<StartsFromPick>(null);
  // Set when a way wrote the steps, until the first save: the "starting point" note.
  const [template, setTemplate] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (card && from.isSuccess && !saved) {
    const f = prepFields(card, ICE_YIELD_UNITS);
    const pick = from.data ? { id: from.data.id, name: from.data.name ?? '' } : null;
    setFields(f);
    setStartsFrom(pick);
    setSaved({ fields: f, from: pick });
  }

  const set = (patch: Partial<PrepFields>) => setFields((f) => (f ? { ...f, ...patch } : f));
  const toStep = (s: IceStep) => newStepField(s.body, '', s.tools);

  const start = (way: IceWayKey, pick: StartsFromPick) => {
    if (!fields || !ice) return;
    set({ steps: iceWaySteps(way, ice).map(toStep), storage: fields.storage || 'Freezer' });
    setStartsFrom(iceWay(way).from === 'water' ? null : pick);
    setTemplate(way !== 'own');
  };

  const dirty = !!fields && !!saved && (!samePrepCard(fields, saved.fields) || startsFrom?.id !== saved.from?.id || startsFrom?.name !== saved.from?.name);

  const submit = async (): Promise<boolean> => {
    if (!fields || !iceId) return false;
    const { problem: bad, input } = prepCardInput(fields);
    setProblem(bad);
    if (bad) return false;
    try {
      // A flavour typed by name is found, or added, the way the drink wizard does.
      const fromId = startsFrom ? (startsFrom.id ?? (await ensureIngredient({ id: null, name: startsFrom.name }, barId, new Map()))) : null;
      await save.mutateAsync({ startsFrom: fromId, card: input });
      const pick = startsFrom && fromId ? { id: fromId, name: startsFrom.name } : null;
      setStartsFrom(pick);
      setSaved({ fields, from: pick });
      setTemplate(false);
      return true;
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Couldn’t save it. Check your connection and try again.');
      return false;
    }
  };

  return { fields, set, startsFrom, setStartsFrom, start, template, dirty, submit, saving: save.isPending, problem, loading: !fields, toStep };
}
