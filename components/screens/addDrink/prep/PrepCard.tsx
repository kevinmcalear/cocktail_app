import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, PressableScale, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { PREP_KINDS, recipeEyebrow, stepToFinish, withFacts } from '@/lib/prepKinds';
import { techniqueById } from '@/lib/techniques';

import { Trail, trailInto } from '../Trail';
import { Eyebrow } from '../WizardChrome';
import type { PrepBuilderProps } from './PrepBuilder';
import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';
import { PrepRecipeStep, RecipeView } from './PrepRecipeStep';
import { useInside } from './useInside';
import { usePrepDraft } from './usePrepDraft';

/** Its root's id on the web: the desktop page holds ⌘↵ while a prep is half written here. */
export const PREP_CARD_ID = 'prep-card-open';

/**
 * A house prep written under its own line on the desktop page (board
 * make-anything-steps-1, step 4), not over the page: its name, what it is,
 * what goes in and how it's made, the builder's own steps on one card. Add
 * hands it to the line; Leave for now keeps what's done on the line, a
 * recipe to finish (make-anything-steps-3, step 9).
 */
export function PrepCard({ name: started, venueName, initial, combinedFrom, inDrink, picked, technique, ingredients, aliases, onDone, onLater, onClose, bar = null, above, drinkName, nested }: Omit<PrepBuilderProps, 'name'> & { name: string; venueName: string | null; nested?: boolean }) {
  const ds = useDs();
  const [name, setName] = useState(started);
  const combined = !!combinedFrom?.length;
  const { draft, current, changed, setDraft, view, setView, fromCatalog, pickKind, pickTechnique, version, phrase, named, slotsOpen } = usePrepDraft({ name: started, nameNow: name, initial, picked, technique, combined, bar });
  const set = (c: Partial<typeof draft>) => setDraft({ ...draft, ...c });
  const shown = name.trim() || started;
  // A line of it made in-house too opens under that line, one level down (make-anything-steps-2, step 8).
  const inside = useInside(draft, setDraft, shown);
  // Leaving keeps what's done, picked up where it stops.
  const keep = onLater && !combined ? () => onLater({ ...withFacts(current()), at: stepToFinish(current()) }, shown) : null;
  // A finished recipe opened again keeps a change made below it (a recipe inside it, picked up and left); otherwise it stays as it was.
  const trail = trailInto(above ?? [{ label: drinkName || 'Your drink' }], keep ?? (() => (changed() ? onDone(withFacts(current()), shown) : onClose())), shown);
  const word = (draft.technique ? techniqueById(draft.technique)?.name : draft.kind !== 'other' ? PREP_KINDS.find((k) => k.id === draft.kind)?.name : null)?.toLowerCase();
  return (
    <View nativeID={nested ? undefined : PREP_CARD_ID} role="group" aria-label={`House-made: ${shown}`} style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <View style={styles.head}>
        <View style={styles.trailRow}>
          <View style={styles.flex}>
            <Trail items={trail} />
          </View>
          {keep ? (
            <PressableScale role="button" onPress={keep} accessibilityLabel={`Leave ${shown} for now. What you’ve done is kept`} style={styles.leave}>
              <Caption tone="accent">Leave for now</Caption>
            </PressableScale>
          ) : null}
        </View>
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
        {/* A finished recipe opened again, or two lines just combined: leaving puts them back as they were. */}
        {keep ? null : <Button label="Keep it as it was" variant="secondary" onPress={onClose} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginLeft: 40 + space.md, marginBottom: space.md, gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1 },
  head: { gap: space.xs },
  trailRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  leave: { minHeight: layout.minTapTarget, justifyContent: 'center' },
  recipeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
