import { useEffect, useRef, useState, type RefObject } from 'react';
import { Alert, Modal, StyleSheet, View, type AlertButton } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Field, IngredientDrawing } from '@/components/ds';
import { space } from '@/constants/tokens';
import { RECIPE_STEPS, recipeEyebrow, withFacts, type PrepDraft, type PrepPick, type RecipeStep } from '@/lib/prepKinds';
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
import { useInside } from './useInside';
import { usePrepDraft } from './usePrepDraft';

const STEPS = RECIPE_STEPS;
type Step = RecipeStep;
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
  /**
   * Leave it for now (make-anything-steps-3, step 9): what's done so far, with
   * the step it was left at, goes on the line as a recipe to finish. Without
   * it (a finished recipe opened again) leaving keeps it as it was, and the
   * first step's Skip goes on to the recipe.
   */
  onLater?: (draft: PrepDraft, name: string) => void;
  /** A recipe to finish picks up at the step it was left at. */
  startAt?: RecipeStep;
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
  // Android's back goes to the Modal, not the steps: it goes back on the level showing, one level at a time.
  const back = useRef(props.onClose);
  return (
    <Modal visible={!!props.name} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => back.current()}>
      {/* A native Modal is its own root: the method step's drag needs gestures inside it. */}
      <GestureHandlerRootView style={styles.root}>{props.name ? <Builder {...props} name={props.name} backRef={back} /> : null}</GestureHandlerRootView>
    </Modal>
  );
}

function Builder({ name: started, drinkName, initial, first, combinedFrom, inDrink, picked, technique, ingredients, aliases, onDone, onLater, onClose, bar = null, above, backRef, startAt }: PrepBuilderProps & { name: string; backRef: RefObject<() => void> }) {
  const [step, setStep] = useState<Step>(startAt ?? (!first && (initial || technique) ? 'recipe' : 'kind'));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName] = useState(started);
  const combined = !!combinedFrom?.length;
  const { draft, current, changed, setDraft, view, setView, fromCatalog, pickKind, pickTechnique, phrase, named, slotsOpen } = usePrepDraft({ name: started, nameNow: name, initial, picked, technique, combined, bar }, () => {
    if (step === 'kind') setStep('recipe');
  });
  const at = STEPS.indexOf(step);
  const go = (to: Step) => {
    setDirection(STEPS.indexOf(to) >= at ? 1 : -1);
    setStep(to);
  };
  const shown = name.trim() || started;
  const drink = drinkName || 'your drink';
  // Leaving keeps what's done on the line, a recipe to finish; lines just combined go back to two, and a finished recipe stays as it was.
  const keep = onLater && !combined ? () => onLater({ ...withFacts(current()), at: step }, shown) : null;
  // A finished recipe opened again keeps a change made below it (a recipe inside it, picked up and left); otherwise it stays as it was.
  const leave = keep ?? (() => (changed() ? onDone(withFacts(current()), shown) : onClose()));
  const ask = () => {
    if (!keep) return leave();
    // A new one opened by mistake can go; one picked up again can only be left or carried on with.
    const drop: AlertButton[] = initial ? [] : [{ text: 'Don’t keep it', style: 'destructive', onPress: onClose }];
    Alert.alert('Leave it for now?', `What you’ve done is kept. ${drinkName || 'The drink'} shows it as Recipe to finish, and New lists it under Drafts, with the way back.`, [
      { text: 'Keep going', style: 'cancel' },
      ...drop,
      { text: 'Leave it for now', onPress: keep },
    ]);
  };
  const back = () => (at > 0 ? go(STEPS[at - 1]) : ask());
  const next = () => (step === 'method' ? onDone(withFacts(draft), shown) : go(STEPS[at + 1]));
  const ready = named && (step === 'kind' || !slotsOpen);
  const trail = trailInto(above ?? [{ label: drinkName || 'Your drink' }], leave, shown);
  // A line of this recipe being made in-house too, one level down (make-anything-steps-2, step 8).
  const inside = useInside(draft, setDraft, name.trim() || started);
  // The level showing takes Android's back: this one, unless a level below it is open.
  useEffect(() => {
    if (!inside.props) backRef.current = back;
  });

  const intro = 'Start from a step or write your own. A time you write becomes a timer when you make it.';
  if (inside.props) return <Builder key={inside.line!.key} {...inside.props} ingredients={ingredients} aliases={aliases} bar={bar} above={trail} backRef={backRef} />;
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
          skipLabel={keep ? 'Later' : 'Skip'}
          canNext={ready && !!name.trim()}
          saving={false}
          onSkip={keep ?? (() => go('recipe'))}
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
        <PrepRecipeStep draft={draft} view={view} set={(c) => setDraft({ ...draft, ...c })} ingredients={ingredients} aliases={aliases} inDrink={inDrink} onMake={inside.open} />
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
