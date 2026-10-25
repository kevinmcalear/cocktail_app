import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { PREP_KINDS, recipeEyebrow, withFacts } from '@/lib/prepKinds';
import { techniqueById } from '@/lib/techniques';

import { Trail, trailInto } from '../Trail';
import { Eyebrow } from '../WizardChrome';
import type { PrepBuilderProps } from './PrepBuilder';
import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';
import { PrepRecipeStep, RecipeView } from './PrepRecipeStep';
import { aboveRecipe, useInside } from './useInside';
import { usePrepDraft } from './usePrepDraft';

/** Its root's id on the web: the desktop page holds ⌘↵ while a prep is half written here. */
export const PREP_CARD_ID = 'prep-card-open';

/**
 * A house prep written under its own line on the desktop page (board
 * make-anything-steps-1, step 4), not over the page: its name, what it is,
 * what goes in and how it's made, the builder's own steps on one card. Add
 * hands it to the line; Just the name leaves its recipe for later.
 */
export function PrepCard({ name: started, venueName, initial, combinedFrom, inDrink, picked, technique, ingredients, aliases, onDone, onLater, onClose, bar = null, above, drinkName, nested }: Omit<PrepBuilderProps, 'name'> & { name: string; venueName: string | null; nested?: boolean }) {
  const ds = useDs();
  const [name, setName] = useState(started);
  const combined = !!combinedFrom?.length;
  const { draft, setDraft, view, setView, fromCatalog, pickKind, pickTechnique, version, phrase, named, slotsOpen } = usePrepDraft({ name: started, nameNow: name, initial, picked, technique, combined, bar });
  const set = (c: Partial<typeof draft>) => setDraft({ ...draft, ...c });
  const shown = name.trim() || started;
  // A line of it made in-house too opens under that line, one level down (make-anything-steps-2, step 8).
  const inside = useInside(draft, setDraft, shown);
  const trail = trailInto(aboveRecipe(above ?? [{ label: drinkName || 'Your drink' }]), onClose, shown);
  const word = (draft.technique ? techniqueById(draft.technique)?.name : draft.kind !== 'other' ? PREP_KINDS.find((k) => k.id === draft.kind)?.name : null)?.toLowerCase();
  return (
    <View nativeID={nested ? undefined : PREP_CARD_ID} role="group" aria-label={`Made in-house: ${shown}`} style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <View style={styles.head}>
        <Trail items={trail} />
        <Body>{`Made in-house: ${shown}`}</Body>
        <Caption tone="muted">{`${venueName ? `Private to ${venueName}. ` : ''}Made from parts you buy, so it costs itself.`}</Caption>
      </View>
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} returnKeyType="done" />
      <Eyebrow>What is it</Eyebrow>
      <PrepKindStep name={shown} draft={draft} combined={combined} onKind={pickKind} onTechnique={pickTechnique} onChangeAmount={() => {}} bar={bar} />
      <View style={styles.recipeHead}>
        <Eyebrow>{recipeEyebrow(draft) || 'What goes in'}</Eyebrow>
        <RecipeView value={view} onChange={setView} />
      </View>
      {fromCatalog ? <Caption tone="muted">{fromCatalog}</Caption> : null}
      <PrepRecipeStep
        key={`recipe-${version}`}
        draft={draft}
        view={view}
        set={set}
        ingredients={ingredients}
        aliases={aliases}
        inDrink={inDrink}
        onMake={inside.open}
        below={(l) => (inside.props && l.key === inside.line?.key ? <PrepCard key={l.key} nested {...inside.props} venueName={venueName} ingredients={ingredients} aliases={aliases} bar={bar} above={trail} /> : null)}
      />
      <Eyebrow>How it’s made</Eyebrow>
      <PrepMethodStep key={`method-${version}`} draft={draft} set={set} phrase={phrase} />
      {slotsOpen ? <Caption tone="accent">Pick the parts still marked, or take them out, to add it.</Caption> : null}
      <View style={styles.buttons}>
        <Button label={word ? `Add the ${word}` : `Add ${shown}`} disabled={!named || slotsOpen || !name.trim()} onPress={() => onDone(withFacts(draft), shown)} />
        {/* A recipe already written can't go back to a name; leaving keeps it as it was (two lines combined go back to two). */}
        {onLater ? <Button label="Just the name for now" variant="secondary" onPress={onLater} /> : <Button label="Keep it as it was" variant="secondary" onPress={onClose} />}
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
