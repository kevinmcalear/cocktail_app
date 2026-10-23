import { useState } from 'react';
import { Modal, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IngredientDrawing } from '@/components/ds';
import { recipeEyebrow, withFacts, type PrepDraft, type PrepPick } from '@/lib/prepKinds';
import type { IngredientAlias } from '@/lib/ingredientNames';

import type { CatalogIngredient } from '../IngredientSearch';
import { PaperBand } from '../PaperBand';
import { WizardFooter } from '../WizardChrome';
import { WizardFrame } from '../WizardFrame';
import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';
import { PrepRecipeStep, RecipeView } from './PrepRecipeStep';
import { usePrepDraft } from './usePrepDraft';

const STEPS = ['kind', 'recipe', 'method'] as const;
type Step = (typeof STEPS)[number];
const TITLES: Record<Step, string> = { kind: 'What are you making?', recipe: 'The recipe', method: 'How it’s made' };
/** A drink name longer than this leaves the band's label, so the progress bar keeps its room. */
const SHORT_NAME = 16;

export interface PrepBuilderProps {
  /** The prep's name ("Pineapple chili shrub"); null when closed. */
  name: string | null;
  /** The drink it's for, for the way back. */
  drinkName: string;
  /** Editing one already in the drink: opens on its recipe. */
  initial?: PrepDraft | null;
  /** Make it house from a line: the bottle it changes, and the "with what" if known. */
  picked?: { base?: PrepPick | null; adjunct?: PrepPick | null };
  /** Make it house: the technique picked for the line, so it opens on its recipe. */
  technique?: string | null;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  onDone: (draft: PrepDraft) => void;
  /** Leave the recipe for later: the drink gets the name now, and a reminder. Without it, the first step's Skip goes on to the recipe. */
  onLater?: () => void;
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
      {/* A native Modal is its own root: the method step's drag needs gestures inside it. */}
      <GestureHandlerRootView style={styles.root}>{props.name ? <Builder {...props} name={props.name} /> : null}</GestureHandlerRootView>
    </Modal>
  );
}

function Builder({ name, drinkName, initial, picked, technique, ingredients, aliases, onDone, onLater, onClose }: PrepBuilderProps & { name: string }) {
  const [step, setStep] = useState<Step>(initial || technique ? 'recipe' : 'kind');
  const [direction, setDirection] = useState<1 | -1>(1);
  const { draft, setDraft, view, setView, fromCatalog, pickKind, pickTechnique, phrase, named, slotsOpen } = usePrepDraft({ name, initial, picked, technique }, () => {
    if (step === 'kind') setStep('recipe');
  });
  const at = STEPS.indexOf(step);
  const go = (to: Step) => {
    setDirection(STEPS.indexOf(to) >= at ? 1 : -1);
    setStep(to);
  };
  const back = () => (at > 0 ? go(STEPS[at - 1]) : onClose());
  const next = () => (step === 'method' ? onDone(withFacts(draft)) : go(STEPS[at + 1]));
  const ready = named && (step === 'kind' || !slotsOpen);

  const drink = drinkName || 'your drink';
  const timers = 'Drag a step by its grip to move it; times you write become timers.';
  const filled = phrase ? `${phrase[0].toUpperCase()}${phrase.slice(1)}, filled in from the recipe.` : draft.technique ? 'Filled in from Techniques.' : 'Filled in from the recipe.';
  const where = drinkName && drinkName.length <= SHORT_NAME ? `${drinkName} › New prep` : 'New prep';
  return (
    <WizardFrame
      testID="add-prep"
      overNav
      pageTitle={`New prep: ${name}`}
      band={(place) => (
        <PaperBand
          progress={{ now: at + 1, of: STEPS.length, label: at === 0 ? `New prep · 1 of ${STEPS.length}` : `${where} · ${at + 1} of ${STEPS.length}` }}
          first={at === 0}
          backTo={drink}
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
      eyebrow={(step === 'recipe' && recipeEyebrow(draft)) || name}
      title={TITLES[step]}
      intro={step === 'method' ? `${filled} ${timers}` : step === 'recipe' ? fromCatalog : undefined}
      aside={step === 'recipe' ? <RecipeView value={view} onChange={setView} /> : null}
      onHardwareBack={() => {
        back();
        return true;
      }}
      footer={
        <WizardFooter
          nextLabel={step === 'kind' ? 'Next: recipe' : step === 'recipe' ? 'Next: method' : `Add it to ${drinkName || 'the drink'}`}
          optional={step === 'kind'}
          skipLabel={onLater ? 'Later' : 'Skip'}
          canNext={ready}
          saving={false}
          onSkip={onLater ?? (() => go('recipe'))}
          onNext={next}
        />
      }
    >
      {step === 'kind' ? (
        <PrepKindStep name={name} draft={draft} onKind={pickKind} onTechnique={pickTechnique} onChangeAmount={() => go('recipe')} />
      ) : step === 'recipe' ? (
        <PrepRecipeStep draft={draft} view={view} set={(c) => setDraft({ ...draft, ...c })} ingredients={ingredients} aliases={aliases} />
      ) : (
        <PrepMethodStep draft={draft} set={(c) => setDraft({ ...draft, ...c })} phrase={phrase} />
      )}
    </WizardFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
