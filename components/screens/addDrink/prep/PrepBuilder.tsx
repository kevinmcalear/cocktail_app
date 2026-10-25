import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Field, IngredientDrawing } from '@/components/ds';
import { space } from '@/constants/tokens';
import { prepAmounts, recipeEyebrow, withFacts, type PrepDraft, type PrepPick } from '@/lib/prepKinds';
import type { IngredientAlias } from '@/lib/ingredientNames';

import type { CatalogIngredient } from '../IngredientSearch';
import { PaperBand } from '../PaperBand';
import { trailInto, type TrailItem } from '../Trail';
import { WizardFooter } from '../WizardChrome';
import { WizardFrame } from '../WizardFrame';
import type { InDrinkPour } from './InDrink';
import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';
import { PrepRecipeStep, RecipeView } from './PrepRecipeStep';
import { usePrepDraft } from './usePrepDraft';

const STEPS = ['kind', 'recipe', 'method'] as const;
type Step = (typeof STEPS)[number];
const TITLES: Record<Step, string> = { kind: 'What are you making?', recipe: 'What goes in?', method: 'How it’s made' };

export interface PrepBuilderProps {
  /** The prep's name ("Pineapple chili shrub"); null when closed. */
  name: string | null;
  /** The drink it's for, for the way back. */
  drinkName: string;
  /** Editing one already in the drink: opens on its recipe. */
  initial?: PrepDraft | null;
  /** Opens on What is it even with a recipe: two lines just combined, or a typed line to check. */
  first?: boolean;
  /** Two lines just combined ("Tempus Fugit", "Red miso"): a kind picked keeps them. */
  combinedFrom?: string[];
  /** What the drink pours of it (22.5 ml), for "In Salty Boy" and how many a bottle makes. */
  inDrink?: InDrinkPour;
  /** Make it house from a line: the bottle it changes, and the "with what" if known. */
  picked?: { base?: PrepPick | null; adjunct?: PrepPick | null };
  /** Make it house: the technique picked for the line, so it opens on its recipe. */
  technique?: string | null;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  /** Its recipe, and its name as typed on What is it. */
  onDone: (draft: PrepDraft, name: string) => void;
  /** Leave the recipe for later: the drink gets the name now, and a reminder. Without it, the first step's Skip goes on to the recipe. */
  onLater?: () => void;
  /** Back out: the drink keeps going without it. */
  onClose: () => void;
  /** The venue the drink is for, whose Kit How? is checked against; null at home. */
  bar?: { id: string; name: string } | null;
  /** Where it's made, from the menu down to the drink (make-anything-overview, rule 3); its own name is added below them. */
  above?: readonly TrailItem[];
}

/**
 * A house prep, made in the middle of adding a drink: what it is and how,
 * what goes in, then the method, keeps and lead time, all filled in from
 * the kind (make-anything-steps-1 and 2, steps 4 to 6). The one recipe flow:
 * from the search, two lines combined, or a line's recipe opened again. It
 * lies over the drink wizard as one screen (never a sheet on a sheet) and
 * hands the prep back to the drink's line.
 */
export function PrepBuilder(props: PrepBuilderProps) {
  return (
    <Modal visible={!!props.name} animationType="slide" presentationStyle="fullScreen" onRequestClose={props.onClose}>
      {/* A native Modal is its own root: the method step's drag needs gestures inside it. */}
      <GestureHandlerRootView style={styles.root}>{props.name ? <Builder {...props} name={props.name} /> : null}</GestureHandlerRootView>
    </Modal>
  );
}

function Builder({ name: started, drinkName, initial, first, combinedFrom, inDrink, picked, technique, ingredients, aliases, onDone, onLater, onClose, bar = null, above }: PrepBuilderProps & { name: string }) {
  const [step, setStep] = useState<Step>(!first && (initial || technique) ? 'recipe' : 'kind');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName] = useState(started);
  const combined = !!combinedFrom?.length;
  const { draft, setDraft, view, setView, fromCatalog, pickKind, pickTechnique, phrase, named, slotsOpen } = usePrepDraft({ name: started, nameNow: name, initial, picked, technique, combined, bar }, () => {
    if (step === 'kind') setStep('recipe');
  });
  const at = STEPS.indexOf(step);
  const go = (to: Step) => {
    setDirection(STEPS.indexOf(to) >= at ? 1 : -1);
    setStep(to);
  };
  const back = () => (at > 0 ? go(STEPS[at - 1]) : onClose());
  const shown = name.trim() || started;
  const next = () => (step === 'method' ? onDone(withFacts(draft), shown) : go(STEPS[at + 1]));
  const ready = named && (step === 'kind' || !slotsOpen);
  // A line of this recipe being made in-house too, one level down (make-anything-steps-2, step 8).
  const [inside, setInside] = useState<string | null>(null);
  const trail = trailInto(above ?? [{ label: drinkName || 'Your drink' }], onClose, name.trim() || started);

  const drink = drinkName || 'your drink';
  const intro = 'Start from a step or write your own. A time you write becomes a timer when you make it.';
  const nested = inside ? draft.lines.find((l) => l.key === inside) : null;
  if (nested) {
    const amount = prepAmounts(draft).find((a) => a.line.key === nested.key)?.amount ?? null;
    return (
      <Builder
        key={nested.key}
        name={nested.name || 'New recipe'}
        drinkName={shown}
        initial={nested.prep ?? null}
        inDrink={{ name: shown, amount: amount === null ? '' : String(amount), unit: nested.unit }}
        ingredients={ingredients}
        aliases={aliases}
        bar={bar}
        above={trail}
        onDone={(prep, n) => {
          setDraft({ ...draft, lines: draft.lines.map((l) => (l.key === nested.key ? { ...l, id: null, name: n, prep, slot: undefined } : l)) });
          setInside(null);
        }}
        onClose={() => setInside(null)}
      />
    );
  }
  const from = combinedFrom?.length ? `From ${combinedFrom.slice(0, -1).join(', ')} and ${combinedFrom.at(-1)}` : null;
  return (
    <WizardFrame
      testID="add-prep"
      overNav
      pageTitle={`New prep: ${shown}`}
      band={(place) => (
        <PaperBand
          progress={{ now: at + 1, of: STEPS.length, label: `${at + 1} of ${STEPS.length}` }}
          trail={trail}
          first={at === 0}
          backTo={drink}
          onBack={back}
          art={<IngredientDrawing name={shown} />}
          artKey={shown}
          artLabel={`Drawing of ${shown}`}
          tag="Made in-house"
          note={`For ${drinkName || 'your drink'}`}
          {...place}
        />
      )}
      stepKey={step}
      direction={direction}
      eyebrow={(step === 'kind' && from) || (step === 'recipe' && recipeEyebrow(draft)) || shown}
      title={TITLES[step]}
      intro={step === 'method' ? intro : step === 'recipe' ? fromCatalog : undefined}
      aside={step === 'recipe' ? <RecipeView value={view} onChange={setView} /> : null}
      onHardwareBack={() => {
        back();
        return true;
      }}
      footer={
        <WizardFooter
          nextLabel={step === 'kind' ? 'Next: what goes in' : step === 'recipe' ? 'Next: how it’s made' : `Add it to ${drinkName || 'the drink'}`}
          optional={step === 'kind'}
          skipLabel={onLater ? 'Later' : 'Skip'}
          canNext={ready && !!name.trim()}
          saving={false}
          onSkip={onLater ?? (() => go('recipe'))}
          onNext={next}
        />
      }
    >
      {step === 'kind' ? (
        <View style={styles.stack}>
          <Field label="Name" value={name} onChangeText={setName} maxLength={80} returnKeyType="done" />
          <PrepKindStep name={shown} draft={draft} combined={combined} onKind={pickKind} onTechnique={pickTechnique} onChangeAmount={() => go('recipe')} bar={bar} />
        </View>
      ) : step === 'recipe' ? (
        <PrepRecipeStep draft={draft} view={view} set={(c) => setDraft({ ...draft, ...c })} ingredients={ingredients} aliases={aliases} inDrink={inDrink} onMake={setInside} />
      ) : (
        <PrepMethodStep draft={draft} set={(c) => setDraft({ ...draft, ...c })} phrase={phrase} />
      )}
    </WizardFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stack: { gap: space.lg },
});
