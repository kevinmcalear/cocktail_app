import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import { IngredientDrawing } from '@/components/ds';
import { useCreateIngredient } from '@/hooks/useCreateIngredient';
import { useDropdowns } from '@/hooks/useDropdowns';
import { plainDbMessage } from '@/lib/dbError';
import { amountLabel } from '@/lib/drinkWizard';
import { sameIngredient } from '@/lib/ingredientNames';
import { EMPTY_INGREDIENT, guessRole, hasIngredientContent, INGREDIENT_COPY, ingredientSteps, ROLE_COPY, type IngredientDraft, type IngredientStep } from '@/lib/ingredientWizard';
import { toastDone } from '@/lib/toast';
import { useIngredientWizardStore, wizardPlace } from '@/store/useIngredientWizardStore';

import type { CatalogIngredient } from '../addDrink/IngredientSearch';
import { PaperBand } from '../addDrink/PaperBand';
import { ReviewList } from '../addDrink/ReviewStep';
import { WizardFooter } from '../addDrink/WizardChrome';
import { WizardFrame } from '../addDrink/WizardFrame';
import { KindStep, MakerStep, NotesStep, RecipeStep, StrengthStep, WhatStep } from './IngredientSteps';
import { NameStep } from './NameStep';

export interface AddIngredientWizardProps {
  /** The venue it's added at; null or missing for a shared one. */
  barId?: string | null;
  initialName?: string | null;
  /** Inside the desktop workspace: no safe-area padding. */
  embedded?: boolean;
  onClose: () => void;
  /** Saved, or an existing one picked instead of a copy. */
  onSaved: (item: { id: string; name: string }, existed: boolean) => void;
}

const hydrated = (cb: () => void) => useIngredientWizardStore.persist.onFinishHydration(cb);
const isHydrated = () => useIngredientWizardStore.persist.hasHydrated();

/** Adding an ingredient (a bottle, a house prep or anything else), one step per screen, drawn as it's filled in. */
export function AddIngredientWizard(props: AddIngredientWizardProps) {
  // The kept draft loads from storage first, so nothing typed is lost to it.
  const ready = useSyncExternalStore(hydrated, isHydrated, () => true);
  return ready ? <Wizard {...props} /> : null;
}

function Wizard({ barId = null, initialName, embedded, onClose, onSaved }: AddIngredientWizardProps) {
  const place = wizardPlace(barId);
  const kept = useIngredientWizardStore((s) => s.kept[place]);
  const patch = useIngredientWizardStore((s) => s.patch);
  const setStoredStep = useIngredientWizardStore((s) => s.setStep);
  const clear = useIngredientWizardStore((s) => s.clear);
  const draft: IngredientDraft = { ...EMPTY_INGREDIENT, ...kept?.draft };
  const steps = ingredientSteps(draft.role);
  const stored = kept?.step ?? 'name';
  const step: IngredientStep = steps.includes(stored) ? stored : 'name';
  const at = steps.indexOf(step);
  const copy = INGREDIENT_COPY[step];
  const [resumed, setResumed] = useState(() => hasIngredientContent(draft));
  const [direction, setDirection] = useState<1 | -1>(1);
  const dropdowns = useDropdowns({ ingredients: true }).data;
  const create = useCreateIngredient();

  const ingredients: readonly CatalogIngredient[] = dropdowns?.ingredients ?? [];
  const coreIds = new Set(dropdowns?.coreIngredientIds ?? []);
  const catalog = { ingredients, aliases: dropdowns?.ingredientAliases ?? [], core: ingredients.filter((i) => coreIds.has(i.id)), coreIds, loading: !dropdowns?.ingredients };

  const set = (change: Partial<IngredientDraft>) => patch(place, change);
  const go = (to: IngredientStep) => {
    setDirection(steps.indexOf(to) >= at || !steps.includes(to) ? 1 : -1);
    setStoredStep(place, to);
  };
  const back = () => (at > 0 ? go(steps[at - 1]) : onClose());
  // One of each ingredient: a name that's already one (by any spelling or alias) can't be saved again, only used.
  const duplicate = draft.name.trim() ? sameIngredient(draft.name, catalog.ingredients, catalog.aliases) : null;
  const canSave = draft.name.trim().length > 0 && !duplicate;

  // A name passed in ("Add 'Orgeat'" from a spec) starts a fresh draft.
  useEffect(() => {
    const kept = useIngredientWizardStore.getState().kept[place]?.draft;
    if (initialName?.trim() && !(kept && hasIngredientContent(kept))) patch(place, { name: initialName.trim() });
  }, [initialName, place, patch]);

  const save = () =>
    create.mutate(
      { draft, barId },
      {
        onSuccess: ({ id }) => {
          clear(place);
          toastDone('Ingredient saved', draft.name.trim());
          onSaved({ id, name: draft.name.trim() }, false);
        },
        onError: (e) => Alert.alert('Couldn’t save the ingredient', `${plainDbMessage(e) ?? e.message} Your draft is kept on this device.`),
      }
    );
  const skip = () => go(steps[at + 1]);
  // Next on "What is it?" takes the marked guess (it decides the steps after); Skip leaves it unsaid.
  const next = () => {
    if (step === 'review') return save();
    const guess = step === 'what' && !draft.role ? guessRole(draft.name, draft.maker) : null;
    if (!guess) return skip();
    set({ role: guess });
    const list = ingredientSteps(guess);
    go(list[list.indexOf(step) + 1]);
  };
  const props = { draft, set, onDone: next };

  const body = (() => {
    switch (step) {
      case 'name':
        return (
          <NameStep
            {...props}
            {...catalog}
            onDone={() => canSave && next()}
            onUseExisting={(row) => {
              clear(place);
              onSaved(row, true);
            }}
            resumed={resumed}
            onStartOver={() => {
              clear(place);
              setResumed(false);
            }}
          />
        );
      case 'what':
        return <WhatStep {...props} />;
      case 'kind':
        return <KindStep {...props} {...catalog} />;
      case 'maker':
        return <MakerStep {...props} />;
      case 'recipe':
        return <RecipeStep {...props} {...catalog} />;
      case 'strength':
        return <StrengthStep {...props} />;
      case 'notes':
        return <NotesStep {...props} />;
      case 'review': {
        const value: Record<IngredientStep, string> = {
          name: draft.name.trim(),
          what: draft.role ? ROLE_COPY[draft.role].label : '',
          kind: draft.generic?.name ?? '',
          maker: draft.maker.trim(),
          recipe: draft.lines.map((l) => `${amountLabel(l)} ${l.name}`.trim()).join('\n'),
          strength: draft.abv ? `${draft.abv}% ABV` : '',
          notes: draft.description.trim(),
          review: '',
        };
        return <ReviewList rows={steps.filter((s) => s !== 'review').map((s) => ({ key: s, label: INGREDIENT_COPY[s].short, value: value[s] }))} onJump={(s) => go(s as IngredientStep)} />;
      }
    }
  })();

  const following = steps[at + 1];
  const name = draft.name.trim() || draft.generic?.name || 'Ingredient';
  return (
    <WizardFrame
      testID="add-ingredient"
      pageTitle="Add an ingredient"
      embedded={embedded}
      band={(p) => (
        <PaperBand
          {...p}
          first={at === 0}
          onBack={back}
          progress={{ now: Math.min(at + 1, steps.length - 1), of: steps.length - 1, label: step === 'review' ? 'Review' : `${at + 1} of ${steps.length - 1}` }}
          // Drawn from its kind's chain once it has one ("Gin": a gin bottle), else from the name.
          art={<IngredientDrawing id={draft.generic?.id ?? null} name={name} />}
          artKey={`${draft.generic?.id ?? ''}|${name}`}
          artLabel="Drawing of the ingredient"
        />
      )}
      stepKey={step}
      direction={direction}
      eyebrow={draft.name.trim() || 'New ingredient'}
      title={copy.title}
      intro={copy.intro}
      onHardwareBack={() => {
        if (at === 0) return false;
        back();
        return true;
      }}
      footer={
        <WizardFooter
          nextLabel={step === 'review' ? (create.isPending ? 'Saving…' : 'Save ingredient') : `Next: ${INGREDIENT_COPY[following].short.toLowerCase()}`}
          optional={copy.optional}
          canNext={step === 'name' || step === 'review' ? canSave : true}
          saving={create.isPending}
          onSkip={skip}
          onNext={next}
        />
      }
    >
      {body}
    </WizardFrame>
  );
}
