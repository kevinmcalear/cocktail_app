import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { PREP_KINDS, recipeEyebrow, withFacts } from '@/lib/prepKinds';
import { techniqueById } from '@/lib/techniques';

import { Eyebrow } from '../WizardChrome';
import type { PrepBuilderProps } from './PrepBuilder';
import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';
import { PrepRecipeStep, RecipeView } from './PrepRecipeStep';
import { usePrepDraft } from './usePrepDraft';

/** Its root's id on the web: the desktop page holds ⌘↵ while a prep is half written here. */
export const PREP_CARD_ID = 'prep-card-open';

/**
 * A house prep written under its own line on the desktop page (board
 * make-create-desktop, step 6), not over the page: what it is, the recipe
 * and how it's made, the builder's own steps on one card. Add hands it to
 * the line; Just the name leaves its recipe for later.
 */
export function PrepCard({ name, venueName, initial, picked, technique, ingredients, aliases, onDone, onLater }: Omit<PrepBuilderProps, 'name' | 'drinkName' | 'onClose'> & { name: string; venueName: string | null }) {
  const ds = useDs();
  const { draft, setDraft, view, setView, fromCatalog, pickKind, pickTechnique, version, phrase, named, slotsOpen } = usePrepDraft({ name, initial, picked, technique });
  const set = (c: Partial<typeof draft>) => setDraft({ ...draft, ...c });
  const word = (draft.technique ? techniqueById(draft.technique)?.name : draft.kind !== 'other' ? PREP_KINDS.find((k) => k.id === draft.kind)?.name : null)?.toLowerCase();
  return (
    <View nativeID={PREP_CARD_ID} role="group" aria-label={`House prep: ${name}`} style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <View style={styles.head}>
        <Body>{`House prep: ${name}`}</Body>
        <Caption tone="muted">{`${venueName ? `Private to ${venueName}. ` : ''}Made from parts you buy, so it costs itself.`}</Caption>
      </View>
      <Eyebrow>What are you making</Eyebrow>
      <PrepKindStep name={name} draft={draft} onKind={pickKind} onTechnique={pickTechnique} onChangeAmount={() => {}} />
      <View style={styles.recipeHead}>
        <Eyebrow>{recipeEyebrow(draft) || 'Recipe'}</Eyebrow>
        <RecipeView value={view} onChange={setView} />
      </View>
      {fromCatalog ? <Caption tone="muted">{fromCatalog}</Caption> : null}
      <PrepRecipeStep key={`recipe-${version}`} draft={draft} view={view} set={set} ingredients={ingredients} aliases={aliases} />
      <Eyebrow>How</Eyebrow>
      <PrepMethodStep key={`method-${version}`} draft={draft} set={set} phrase={phrase} />
      {slotsOpen ? <Caption tone="accent">Pick the parts still marked, or take them out, to add it.</Caption> : null}
      <View style={styles.buttons}>
        <Button label={word ? `Add the ${word}` : `Add ${name}`} disabled={!named || slotsOpen} onPress={() => onDone(withFacts(draft))} />
        {onLater ? <Button label="Just the name for now" variant="secondary" onPress={onLater} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginLeft: 40 + space.md, marginBottom: space.md, gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1 },
  head: { gap: space.xs },
  recipeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
