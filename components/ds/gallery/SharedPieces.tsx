import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SpecCard } from '@/components/screens/drink/spec/SpecCard';
import { SKETCH_SAMPLES } from '@/constants/sketch';
import { space } from '@/constants/tokens';
import { specLines, type PresentationRecipe } from '@/lib/spec';
import { methodVerb } from '@/lib/specView';
import type { StepNote } from '@/lib/stepNotes';
import { readSketchInputs, type SketchInputs } from '@/lib/sketch/types';

import { Button } from '../Button';
import { DrinkDrawing } from '../DrinkDrawing';
import { PencilState } from '../PencilState';
import { Caption } from '../Text';
import { useToast } from '../Toast';
import { SAMPLE_LEVELS, sampleDrink } from './drinkSample';

// The words drawn on Decided-spec-groups-penicillin.
const STEP_NOTES: StepNote[] = [
  { step_key: 'main', aside: 'hard, with ice', note: 'Strain over one large cube in a rocks glass.' },
  { step_key: 'float', aside: null, note: 'Over the back of a bar spoon, so it sits on top.' },
  { step_key: 'garnish', aside: null, note: 'On a pick, resting across the rim.' },
];
const SERVE = ['Rocks', 'Large cube'];
const METHODS = ['Shaken'];
const VERB = methodVerb(METHODS);

/** The same Penicillin as each role sees it (masked as app_recipe_presentation masks it). */
const linesFor = (role: number) => specLines(sampleDrink(role).recipes as PresentationRecipe[] | undefined);

/** Spec controls by who is looking: a bartender (Steps), a public spec (Ingredients), the floor (names only). */
export function SpecPieces() {
  const toast = useToast();
  const batch = () => toast.show({ title: 'A batch opens the Batch sheet', detail: 'On a drink page: BatchSheet with this spec.' });
  return (
    <View style={styles.stack}>
      <Caption tone="muted">Bartender: Steps first, Makes 1, 2, 3 or A batch</Caption>
      <SpecCard itemId="sample-penicillin" barId="sample-venue" lines={linesFor(30)} maker verb={VERB} methods={METHODS} serve={SERVE} onBatch={batch} preview={{ role: 30, levels: SAMPLE_LEVELS }} stepNotes={STEP_NOTES} />
      <Caption tone="muted">Anyone, a public spec: Ingredients first</Caption>
      <SpecCard itemId="sample-classic" barId={null} lines={linesFor(40)} maker={false} verb={VERB} methods={METHODS} serve={SERVE} onBatch={batch} />
      <Caption tone="muted">Employee (floor): what&apos;s in it by name, no toggle</Caption>
      <SpecCard itemId="sample-penicillin" barId="sample-venue" lines={linesFor(20)} maker={false} verb={VERB} serve={SERVE} goesOut preview={{ role: 20, levels: SAMPLE_LEVELS }} />
    </View>
  );
}

/** Empty, loading, error and offline, in pencil. */
export function PencilStates() {
  return (
    <View style={styles.stack}>
      <PencilState kind="empty" title="No drinks on this menu yet" detail="Add one, or bring in a menu from a photo." action={{ label: 'Add a drink', onPress: () => {} }} />
      <PencilState kind="loading" title="Loading the menu" compact />
      <PencilState kind="error" title="Couldn't load the menu" detail="Check your connection, then try again." action={{ label: 'Try again', onPress: () => {} }} compact />
      <PencilState kind="offline" title="You're offline" compact />
    </View>
  );
}

const from: SketchInputs['from'] = { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' };
const NEGRONI = readSketchInputs({ v: 2, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: SKETCH_SAMPLES.negroni, alpha: 0.95 }, garnish: 'orange_peel', from }) as SketchInputs;
const MARTINI = readSketchInputs({ v: 2, glass: 'nick', ice: 'none', method: 'stir', liquid: { hex: SKETCH_SAMPLES.martini, alpha: 0.2 }, garnish: 'olive', from }) as SketchInputs;

/** One scene at hero, tile and row; the colour pours in (Replay to see it again). */
export function DrawingSizes() {
  const [round, setRound] = useState(0);
  return (
    <View style={styles.stack}>
      <View key={round} style={styles.wrap}>
        <DrinkDrawing inputs={NEGRONI} seed="gallery-negroni" size="hero" staff label="Drawing of a Negroni on the rocks with an orange peel" />
        <DrinkDrawing inputs={MARTINI} seed="gallery-martini" size="tile" />
        <View style={styles.rows}>
          <DrinkDrawing inputs={NEGRONI} seed="gallery-negroni" size="row" />
          <DrinkDrawing inputs={MARTINI} seed="gallery-martini" size="row" />
        </View>
      </View>
      <Caption tone="muted">Hero 280 (guests) or 180 (staff, shown), tile 160, row 56. Dark mode paints the same scene for night with a glow.</Caption>
      <View style={styles.wrap}>
        <Button label="Replay the pour" variant="secondary" size="sm" onPress={() => setRound((n) => n + 1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space.lg },
  rows: { gap: space.sm },
});
