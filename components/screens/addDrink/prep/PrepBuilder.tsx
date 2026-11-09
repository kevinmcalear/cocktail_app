import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Field, IngredientDrawing } from '@/components/ds';
import { space } from '@/constants/tokens';
import { guessKind, RECIPE_STEPS, recipeEyebrow, withFacts, type PrepDraft, type PrepPick, type RecipeStep } from '@/lib/prepKinds';
import type { IngredientAlias } from '@/lib/ingredientNames';

import { BeerWineBand } from '../../addBeerWine/BeerWineBand';
import type { CatalogIngredient } from '../IngredientSearch';
import { PaperBand } from '../PaperBand';
import { Prompt } from '../Prompt';
import { trailInto, type TrailItem } from '../Trail';
import { WizardFooter } from '../WizardChrome';
import { WizardFrame } from '../WizardFrame';
import type { InDrinkPour } from './InDrink';
import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';
import { PrepRecipeStep, RecipeView } from './PrepRecipeStep';
import { LeaveCard } from './LeaveCard';
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
  /** Its own page (New › Something you make, board Add-house), not over a drink: no Modal, the main button alone in the footer. */
  page?: boolean;
  /** Its own page: each change, to keep the draft (Leave it for now keeps it). */
  onKeep?: (draft: PrepDraft, name: string, step: RecipeStep) => void;
  /** Its own page: Don't keep it, or closed with nothing written. */
  onDrop?: () => void;
  /** Its own page: the name is taken here (Add-house, Name taken): a card under the name, Open it or Rename this one, and Next waits. */
  taken?: { title: string; body: string; onOpen: () => void; openLabel: string } | null;
  /** Its own page: the name is still being checked; Next waits on the first step. */
  checking?: boolean;
  /** Its own page: the name as it's typed, for that check. */
  onName?: (name: string) => void;
  /** Its own page: the last step's button ("Save it", "Save on this phone") and a note above it. */
  saveLabel?: string;
  saving?: boolean;
  notice?: ReactNode;
  /** Inside the web's dialog: no safe-area padding. */
  embedded?: boolean;
  /** The web's dialog closes through it (Escape, its scrim), as the X does. */
  closeRef?: { current: (() => void) | null };
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
  if (props.page) return props.name === null ? null : <Builder {...props} name={props.name} backRef={back} />;
  return (
    <Modal visible={!!props.name} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => back.current()}>
      {/* A native Modal is its own root: the method step's drag needs gestures inside it. */}
      <GestureHandlerRootView style={styles.root}>{props.name ? <Builder {...props} name={props.name} backRef={back} /> : null}</GestureHandlerRootView>
    </Modal>
  );
}

function Builder({ name: started, drinkName, initial, first, combinedFrom, inDrink, picked, technique, ingredients, aliases, onDone, onLater, onClose, bar = null, above, backRef, startAt, page, onKeep, onDrop, taken, checking, onName, saveLabel, saving = false, notice, embedded, closeRef }: PrepBuilderProps & { name: string; backRef: RefObject<() => void> }) {
  const [step, setStep] = useState<Step>(startAt ?? (!first && (initial || technique) ? 'recipe' : 'kind'));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName] = useState(started);
  const nameField = useRef<ComponentRef<typeof TextInput>>(null);
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
  // On its own page (Kevin, 8 Nov: "Later on close") what's written is already kept: closing asks first, and with nothing written just goes.
  // Written: typed or picked here, or picked up from before. A name passed in and nothing else is not.
  const [typed, setTyped] = useState(false);
  const filled = typed || changed() || !!initial;
  const leave = page ? (filled ? onClose : (onDrop ?? onClose)) : (keep ?? (() => (changed() ? onDone(withFacts(current()), shown) : onClose())));
  const [asking, setAsking] = useState(false);
  const ask = () => {
    // Escape on the web dialog comes here again: it answers Keep going.
    if (asking) return setAsking(false);
    if (page ? filled : keep) setAsking(true);
    else leave();
  };
  // A kind is picked: tapped, said by the name, or there from the start (Kevin, 8 Nov: the kit question waits for one).
  const [tapped, setTapped] = useState(!!(initial || technique || combined || !page));
  const [byName, setByName] = useState(!!guessKind(started));
  const chosen = tapped || byName;
  // Its own page keeps each change as it's made, with the step it's on.
  useEffect(() => {
    if (page && onKeep && (typed || changed())) onKeep(withFacts(draft), name.trim(), step);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kept when what it keeps changes
  }, [draft, name, step]);
  const back = () => (at > 0 ? go(STEPS[at - 1]) : ask());
  const next = () => (step === 'method' ? onDone(withFacts(draft), shown) : go(STEPS[at + 1]));
  const ready = named && (step === 'kind' || !slotsOpen) && !(page && (taken || (step === 'kind' && checking)));
  const trail = trailInto(above ?? [{ label: drinkName || 'Your drink' }], leave, shown);
  // A line of this recipe being made in-house too, one level down (make-anything-steps-2, step 8).
  const inside = useInside(draft, setDraft, name.trim() || started);
  // The level showing takes Android's back: this one, unless a level below it is open.
  useEffect(() => {
    if (inside.props) return;
    backRef.current = back;
    // The web dialog's Escape and scrim: the level showing asks.
    if (closeRef) closeRef.current = ask;
  });

  // The name says a kind ("…syrup"): it's picked as it's typed, until one is tapped.
  const typeName = (n: string) => {
    setName(n);
    setTyped(true);
    onName?.(n);
    const said = guessKind(n);
    if (tapped || !said) return;
    setByName(true);
    if (said !== guessKind(name) || !byName) pickKind(said, undefined, n);
  };

  // Board Add-house, Name taken: under the name; on a later step (a check that came back late) over the button it holds.
  const takenCard = taken ? (
    <Prompt
      warn
      icon="exclamationmark.triangle"
      title={taken.title}
      body={taken.body}
      actions={[
        { label: 'Open it', onPress: taken.onOpen, accessibilityLabel: taken.openLabel },
        // On a later step the name is on the first: back there, then into the name.
        { label: 'Rename this one', onPress: () => (step === 'kind' ? nameField.current?.focus() : go('kind')) },
      ]}
    />
  ) : null;

  const intro = 'Start from a step or write your own. A time you write becomes a timer when you make it.';
  if (inside.props) return <Builder key={inside.line!.key} {...inside.props} ingredients={ingredients} aliases={aliases} bar={bar} above={trail} backRef={backRef} embedded={embedded} closeRef={closeRef} />;
  const from = combinedFrom?.length ? `From ${combinedFrom.slice(0, -1).join(', ')} and ${combinedFrom.at(-1)}` : null;
  return (
    <View style={styles.root}>
    <WizardFrame
      testID="add-prep"
      overNav
      pageTitle={`House-made: ${shown || 'something you make'}`}
      embedded={embedded}
      band={(place) => page ? (
        // Board Add-house: the X and "Something you make", a back arrow after the first step (as Add-beer, Kevin 8 Nov).
        <BeerWineBand place={place} title="Something you make" onClose={ask} onBack={at > 0 ? back : undefined} />
      ) : (
        <PaperBand
          progress={{ now: at + 1, of: STEPS.length, label: `${at + 1} of ${STEPS.length}` }}
          trail={trail}
          first={at === 0}
          backTo={page ? 'Your recipes' : drink}
          onBack={back}
          art={<IngredientDrawing name={shown} />}
          artKey={shown}
          artLabel={`Drawing of ${shown}`}
          tag="House-made"
          note={page ? 'Your recipes' : `For ${drinkName || 'your drink'}`}
          {...place}
        />
      )}
      stepKey={step}
      direction={direction}
      eyebrow={page ? `${step === 'kind' ? 'House-made' : shown} · ${at + 1} of ${STEPS.length}` : (step === 'kind' && from) || (step === 'recipe' && recipeEyebrow(draft)) || shown}
      title={TITLES[step]}
      intro={step === 'method' ? intro : step === 'recipe' ? fromCatalog : undefined}
      aside={step === 'recipe' ? <RecipeView value={view} onChange={setView} /> : null}
      onHardwareBack={() => {
        if (asking) setAsking(false);
        else back();
        return true;
      }}
      footer={
        <WizardFooter
          nextLabel={step === 'kind' ? 'Next: what goes in' : step === 'recipe' ? 'Next: how it’s made' : page ? (saveLabel ?? 'Save it') : `Add it to ${drinkName || 'the drink'}`}
          // Its own page: the main button alone (Kevin, 8 Nov: "Later on close").
          optional={step === 'kind' && !page}
          skipLabel={keep ? 'Later' : 'Skip'}
          canNext={ready && !!name.trim()}
          saving={saving}
          notice={page && taken && step !== 'kind' ? takenCard : step === 'method' ? notice : undefined}
          onSkip={keep ?? (() => go('recipe'))}
          onNext={next}
        />
      }
    >
      {step === 'kind' ? (
        <View style={styles.stack}>
          <Field ref={nameField} label="Name" value={name} onChangeText={typeName} placeholder="e.g. Honey-ginger syrup, Fat-washed rye" maxLength={80} returnKeyType="done" />
          {page && taken ? (
            takenCard
          ) : (
            <PrepKindStep
              name={shown}
              draft={draft}
              combined={combined}
              chosen={chosen}
              onKind={(k, w) => {
                setTapped(true);
                pickKind(k, w);
              }}
              onTechnique={(id) => {
                setTapped(true);
                pickTechnique(id);
              }}
              onChangeAmount={() => go('recipe')}
              bar={bar}
            />
          )}
        </View>
      ) : step === 'recipe' ? (
        <PrepRecipeStep draft={draft} view={view} set={(c) => setDraft({ ...draft, ...c })} ingredients={ingredients} aliases={aliases} inDrink={inDrink} onMake={inside.open} />
      ) : (
        <PrepMethodStep draft={draft} set={(c) => setDraft({ ...draft, ...c })} phrase={phrase} />
      )}
    </WizardFrame>
      {asking && keep ? (
        // A new one opened by mistake can go; one picked up again can only be left or carried on with.
        <LeaveCard where={shown} step={`${at + 1} of ${STEPS.length}`} drink={drinkName || 'The drink'} onLeave={keep} onStay={() => setAsking(false)} onDrop={initial ? undefined : onClose} />
      ) : asking && page ? (
        <LeaveCard
          where={shown || 'Something you make'}
          step={`${at + 1} of ${STEPS.length}`}
          drink={shown}
          body={`What you’ve done is kept. ${bar ? 'House-made' : 'Add'} lists ${shown || 'it'} under ${bar ? 'Drafts' : 'Pick up where you left off'} with the way back, on this phone and the web.`}
          onLeave={onClose}
          onStay={() => setAsking(false)}
          onDrop={onDrop}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stack: { gap: space.lg },
});
