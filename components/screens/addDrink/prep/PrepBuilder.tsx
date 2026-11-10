import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Field } from '@/components/ds';
import { ListNote } from '@/components/ds/ListGroup';
import { space } from '@/constants/tokens';
import { guessKind, RECIPE_STEPS, withFacts, type PrepDraft, type RecipeStep } from '@/lib/prepKinds';
import { savesTogether } from '@/lib/houseMadeParts';
import type { IngredientAlias } from '@/lib/ingredientNames';

import { BeerWineBand } from '../../addBeerWine/BeerWineBand';
import type { CatalogIngredient } from '../IngredientSearch';
import { Prompt } from '../Prompt';
import { trailInto, type TrailItem } from '../Trail';
import { WizardFooter } from '../WizardChrome';
import { WizardFrame } from '../WizardFrame';
import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';
import { PrepRecipeStep, RecipeView } from './PrepRecipeStep';
import { LeaveCard } from './LeaveCard';
import { PartPage } from './PartPage';
import { useInside } from './useInside';
import { usePrepDraft } from './usePrepDraft';

const STEPS = RECIPE_STEPS;
type Step = RecipeStep;
const TITLES: Record<Step, string> = { kind: 'What are you making?', recipe: 'What goes in?', method: 'How it’s made' };

export interface PrepBuilderProps {
  /** The house-made's name ("Pineapple chili shrub") as it starts; null when closed. */
  name: string | null;
  /** Picked up again: what was written. */
  initial?: PrepDraft | null;
  /** Picked up again at the step it was left at. */
  startAt?: RecipeStep;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  /** The last step's button: its recipe, and its name as typed. */
  onDone: (draft: PrepDraft, name: string) => void;
  /** Gone, with what's written kept (Leave it for now). */
  onClose: () => void;
  /** The venue it's for, whose Kit How? is checked against; null at home. */
  bar?: { id: string; name: string } | null;
  /** Where it's made: a part's trail starts here, its own name added below. */
  above?: readonly TrailItem[];
  /** Each change, to keep the draft (Leave it for now keeps it). */
  onKeep?: (draft: PrepDraft, name: string, step: RecipeStep) => void;
  /** Don't keep it, or closed with nothing written. */
  onDrop?: () => void;
  /** The name is taken here (Add-house, Name taken): a card under the name, Open it or Rename this one, and Next waits. */
  taken?: { title: string; body: string; onOpen: () => void; openLabel: string } | null;
  /** The name is still being checked; Next waits on the first step. */
  checking?: boolean;
  /** The name as it's typed, for that check. */
  onName?: (name: string) => void;
  /** The last step's button ("Save it", "Save on this phone") and a note above it. */
  saveLabel?: string;
  saving?: boolean;
  notice?: ReactNode;
  /** Inside the web's dialog: no safe-area padding, and a part opens under its line. */
  embedded?: boolean;
  /** The web's dialog closes through it (Escape, its scrim), as the X does. */
  closeRef?: { current: (() => void) | null };
}

/**
 * Something you make, on its own page (New › Something you make, board
 * Add-house): what it is and how, what goes in, then the method, keeps and
 * lead time, filled in from the kind. A line made in-house too opens as a
 * part, one flat page (Add-parts). A house-made written inside a drink is
 * that flat page too (DrinkHouseMade, Add-inside), not these steps.
 */
export function PrepBuilder(props: PrepBuilderProps) {
  return props.name === null ? null : <Builder {...props} name={props.name} />;
}

function Builder({ name: started, initial, ingredients, aliases, onDone, onClose, bar = null, above, startAt, onKeep, onDrop, taken, checking, onName, saveLabel, saving = false, notice, embedded, closeRef }: PrepBuilderProps & { name: string }) {
  const [step, setStep] = useState<Step>(startAt ?? (initial ? 'recipe' : 'kind'));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName] = useState(started);
  const nameField = useRef<ComponentRef<typeof TextInput>>(null);
  const { draft, changed, setDraft, view, setView, fromCatalog, pickKind, pickTechnique, phrase, named, slotsOpen } = usePrepDraft({ name: started, nameNow: name, initial, bar, measured: true }, () => {
    if (step === 'kind') setStep('recipe');
  });
  const at = STEPS.indexOf(step);
  const go = (to: Step) => {
    setDirection(STEPS.indexOf(to) >= at ? 1 : -1);
    setStep(to);
  };
  const shown = name.trim() || started;
  // What's written is already kept (Kevin, 8 Nov: "Later on close"): closing asks first, and with nothing written just goes.
  // Written: typed or picked here, or picked up from before. A name passed in and nothing else is not.
  const [typed, setTyped] = useState(false);
  const filled = typed || changed() || !!initial;
  const leave = filled ? onClose : (onDrop ?? onClose);
  const [asking, setAsking] = useState(false);
  const ask = () => {
    // Escape on the web dialog comes here again: it answers Keep going.
    if (asking) return setAsking(false);
    if (filled) setAsking(true);
    else leave();
  };
  // A kind is picked: tapped, said by the name, or there from the start (Kevin, 8 Nov: the kit question waits for one).
  const [tapped, setTapped] = useState(!!initial);
  const [byName, setByName] = useState(!!guessKind(started));
  const chosen = tapped || byName;
  // Each change is kept as it's made, with the step it's on.
  useEffect(() => {
    if (onKeep && (typed || changed())) onKeep(withFacts(draft), name.trim(), step);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kept when what it keeps changes
  }, [draft, name, step]);
  const back = () => (at > 0 ? go(STEPS[at - 1]) : ask());
  const next = () => (step === 'method' ? onDone(withFacts(draft), shown) : go(STEPS[at + 1]));
  // The kind step goes on with no lines yet (Something else starts with none); the later steps need one named.
  const ready = (step === 'kind' || (named && !slotsOpen)) && !(taken || (step === 'kind' && checking));
  const trail = trailInto(above ?? [], leave, shown);
  // A line of this recipe made in-house too, one level down (Add-parts).
  const inside = useInside(draft, setDraft);
  // The web dialog's Escape and scrim: the level showing asks.
  useEffect(() => {
    if (!inside.props && closeRef) closeRef.current = ask;
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
      ink
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
  // A part opens as one flat page, or under its line on the web's dialog (Add-parts).
  const part = (inPlace: boolean) =>
    inside.props && inside.line ? <PartPage key={inside.line.key} name={inside.props.name} initial={inside.props.initial} parent={shown} top={shown} above={trail} level={2} bar={bar} ingredients={ingredients} aliases={aliases} inPlace={inPlace} onKeep={inside.keep} onDone={inside.props.onDone} onClose={inside.props.onClose} onUse={inside.use} /> : null;
  if (inside.props && !embedded) return part(false);
  const together = step !== 'kind' ? savesTogether(shown, draft) : null;
  return (
    <View style={styles.root}>
      <WizardFrame
        testID="add-prep"
        overNav
        pageTitle={`House-made: ${shown || 'something you make'}`}
        embedded={embedded}
        // Board Add-house: the X and "Something you make", a back arrow after the first step (as Add-beer, Kevin 8 Nov).
        band={(place) => <BeerWineBand place={place} title="Something you make" onClose={ask} onBack={at > 0 ? back : undefined} />}
        stepKey={step}
        direction={direction}
        eyebrow={`${step === 'kind' ? 'House-made' : shown} · ${at + 1} of ${STEPS.length}`}
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
            nextLabel={step === 'kind' ? 'Next: what goes in' : step === 'recipe' ? 'Next: how it’s made' : (saveLabel ?? 'Save it')}
            // The main button alone (Kevin, 8 Nov: "Later on close").
            canNext={ready && !!name.trim()}
            saving={saving}
            notice={taken && step !== 'kind' ? takenCard : step === 'method' && notice ? notice : together ? <ListNote icon="info.circle" text={together} /> : undefined}
            onNext={next}
          />
        }
      >
        {step === 'kind' ? (
          <View style={styles.stack}>
            <Field ref={nameField} label="Name" value={name} onChangeText={typeName} placeholder="e.g. Honey-ginger syrup, Fat-washed rye" maxLength={80} returnKeyType="done" />
            {taken ? (
              takenCard
            ) : (
              <PrepKindStep
                name={shown}
                draft={draft}
                chosen={chosen}
                onKind={(k, w) => {
                  setTapped(true);
                  pickKind(k, w);
                }}
                onTechnique={(id) => {
                  setTapped(true);
                  pickTechnique(id);
                }}
                bar={bar}
              />
            )}
          </View>
        ) : step === 'recipe' ? (
          <PrepRecipeStep draft={draft} view={view} set={(c) => setDraft({ ...draft, ...c })} ingredients={ingredients} aliases={aliases} onMake={inside.open} parts openKey={embedded ? inside.line?.key : null} below={embedded ? (l) => (l.key === inside.line?.key ? part(true) : null) : undefined} />
        ) : (
          <PrepMethodStep draft={draft} set={(c) => setDraft({ ...draft, ...c })} phrase={phrase} />
        )}
      </WizardFrame>
      {asking ? (
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

const styles = StyleSheet.create({ root: { flex: 1 }, stack: { gap: space.lg } });
