import { useState } from 'react';
import { Modal } from 'react-native';

import { IngredientDrawing } from '@/components/ds';
import { guessKind, prepFromTechnique, startPrep, type PrepDraft, type PrepKindId } from '@/lib/prepKinds';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { prepCardFor } from '@/lib/techniques/makeIt';
import { techniqueById } from '@/lib/techniques';

import type { CatalogIngredient } from '../IngredientSearch';
import { PaperBand } from '../PaperBand';
import { WizardFooter } from '../WizardChrome';
import { WizardFrame } from '../WizardFrame';
import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';
import { PrepRecipeStep } from './PrepRecipeStep';

const STEPS = ['kind', 'recipe', 'method'] as const;
type Step = (typeof STEPS)[number];
const TITLES: Record<Step, string> = { kind: 'What are you making?', recipe: 'The recipe', method: 'How it’s made' };

export interface PrepBuilderProps {
  /** The prep's name ("Pineapple chili shrub"); null when closed. */
  name: string | null;
  /** The drink it's for, for the way back. */
  drinkName: string;
  /** Editing one already in the drink: opens on its recipe. */
  initial?: PrepDraft | null;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  onDone: (draft: PrepDraft) => void;
  /** Back out: the drink keeps going without it. */
  onClose: () => void;
}

/**
 * A new house prep, made in the middle of adding a drink: what kind it is,
 * the recipe as parts of one base, then the method, keeps and lead time, all
 * filled in from the kind. It lies over the drink wizard as one screen (never
 * a sheet on a sheet) and hands the prep back to the drink's line.
 */
export function PrepBuilder(props: PrepBuilderProps) {
  return (
    <Modal visible={!!props.name} animationType="slide" presentationStyle="fullScreen" onRequestClose={props.onClose}>
      {props.name ? <Builder {...props} name={props.name} /> : null}
    </Modal>
  );
}

function Builder({ name, drinkName, initial, ingredients, aliases, onDone, onClose }: PrepBuilderProps & { name: string }) {
  const [step, setStep] = useState<Step>(initial ? 'recipe' : 'kind');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<PrepDraft>(() => initial ?? startPrep(guessKind(name) ?? 'other', name));
  const at = STEPS.indexOf(step);
  const go = (to: Step) => {
    setDirection(STEPS.indexOf(to) >= at ? 1 : -1);
    setStep(to);
  };
  const back = () => (at > 0 ? go(STEPS[at - 1]) : onClose());
  const next = () => (step === 'method' ? onDone(draft) : go(STEPS[at + 1]));
  const pickKind = (kind: PrepKindId, hot = false) => setDraft(startPrep(kind, name, hot));
  const pickTechnique = (id: string) => {
    const t = techniqueById(id);
    if (!t) return;
    setDraft(prepFromTechnique(t, name, prepCardFor(t)));
  };

  return (
    <WizardFrame
      testID="add-prep"
      pageTitle={`New prep: ${name}`}
      band={(place) => (
        <PaperBand
          progress={{ now: at + 1, of: STEPS.length, label: `New prep · ${at + 1} of ${STEPS.length}` }}
          first={at === 0}
          onBack={back}
          art={<IngredientDrawing name={name} />}
          artKey={name}
          artLabel={`Drawing of ${name}`}
          tag="House prep"
          note={`For ${drinkName || 'your drink'}`}
          {...place}
        />
      )}
      stepKey={step}
      direction={direction}
      eyebrow={name}
      title={TITLES[step]}
      onHardwareBack={() => {
        back();
        return true;
      }}
      footer={
        <WizardFooter
          nextLabel={step === 'kind' ? 'Next: recipe' : step === 'recipe' ? 'Next: method' : `Add it to ${drinkName || 'the drink'}`}
          optional={step === 'kind'}
          canNext={draft.lines.some((l) => l.name.trim())}
          saving={false}
          onSkip={() => onDone(draft)}
          onNext={next}
        />
      }
    >
      {step === 'kind' ? (
        <PrepKindStep name={name} draft={draft} onKind={pickKind} onTechnique={pickTechnique} />
      ) : step === 'recipe' ? (
        <PrepRecipeStep draft={draft} set={(c) => setDraft({ ...draft, ...c })} ingredients={ingredients} aliases={aliases} />
      ) : (
        <PrepMethodStep draft={draft} set={(c) => setDraft({ ...draft, ...c })} />
      )}
    </WizardFrame>
  );
}
