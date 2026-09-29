import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, Headline, PressableScale, SpecRow, Surface, Tag, useBreakpoint } from '@/components/ds';
import { DrinkFacts, type Fact } from '@/components/screens/drink/DrinkFacts';
import { space } from '@/constants/tokens';
import { useCollection, type CollectedDrink } from '@/hooks/useCollection';
import { usePublishedDrink, type PublicBar } from '@/hooks/usePublished';
import { hadOnLine } from '@/lib/collection';
import { specLines } from '@/lib/spec';

import { CollectButton } from './CollectButton';
import { MemorySheet } from './MemorySheet';
import { PublicMissing, PublicShell } from './PublicShell';

/** The bar a public page is credited to, opening its profile. */
export function BarLink({ bar }: { bar: PublicBar | null }) {
  const router = useRouter();
  if (!bar) return null;
  return (
    <PressableScale role="link" accessibilityLabel={`${bar.name}, open the bar`} onPress={() => router.push(`/p/${bar.handle}`)} style={styles.bar}>
      <Tag label={bar.name} tone="accent" />
    </PressableScale>
  );
}

/** What you wrote about a drink you collected, with a way to change it. */
export function MemoryCard({ memory, onEdit }: { memory: CollectedDrink; onEdit: () => void }) {
  const [now] = useState(() => Date.now());
  const had = hadOnLine(memory.hadOn, now);
  return (
    <Surface style={styles.memory}>
      <Headline role="heading">Your memory</Headline>
      {had ? <Body>{had}</Body> : null}
      {memory.note ? <Body tone="muted">{memory.note}</Body> : null}
      {!had && !memory.note ? <Body tone="muted">When did you have it? Add the day and a note, just for you.</Body> : null}
      <Button label={had || memory.note ? 'Edit' : 'Add the day and a note'} icon="pencil" variant="ghost" onPress={onEdit} style={styles.edit} />
    </Surface>
  );
}

/**
 * A published drink as anyone sees it, signed in or not: the menu card, and
 * the spec (generic ingredients and amounts) when the bar shares it. Collect
 * keeps it; your memory of it shows here once you have.
 */
export function PublishedDrinkScreen({ id, releaseId }: { id: string; releaseId?: string | null }) {
  const wide = useBreakpoint() !== 'phone';
  const { data, isPending } = usePublishedDrink(id);
  const { data: collection } = useCollection();
  const [editing, setEditing] = useState(false);
  if (!data) return <PublicMissing loading={isPending} what="drink" />;

  const { drink, bar } = data;
  const mine = collection?.drinks.find((d) => d.itemId === id);
  const facts: Fact[] = [
    data.glass && { label: 'Glass', value: data.glass.name },
    data.ice && { label: 'Ice', value: data.ice },
    data.family && { label: 'Family', value: data.family },
    drink.abv ? { label: 'ABV', value: `${drink.abv}%` } : null,
  ].filter((f): f is Fact => !!f);
  const lines = specLines(data.recipes);
  const who = bar?.name ?? 'The bar';

  return (
    <PublicShell title={drink.name} imageUrl={drink.imageUrl} generated={drink.imageIsGenerated} glass={data.glass?.iconKey ?? data.glass?.name}>
      <BarLink bar={bar} />
      <Display>{drink.name}</Display>
      {drink.description ? <Body tone="muted">{drink.description}</Body> : null}
      <CollectButton target={{ kind: 'drink', itemId: id, releaseId }} name={drink.name} />
      {mine ? <MemoryCard memory={mine} onEdit={() => setEditing(true)} /> : null}
      <DrinkFacts facts={facts} columns={wide ? 4 : 2} />
      <View style={styles.section}>
        <Headline role="heading">Spec</Headline>
        {drink.publishMode === 'spec' && lines.length ? (
          <>
            <Caption tone="muted">{`As ${who} shares it: the ingredients, not the brands.`}</Caption>
            <View>
              {lines.map((l) => (
                <SpecRow key={l.key} amount={l.amount ?? ''} ingredient={l.ingredient ?? 'House ingredient'} optional={l.optional} />
              ))}
            </View>
          </>
        ) : (
          <Body tone="muted">{`${who} shares this drink’s menu description, not its spec.`}</Body>
        )}
      </View>
      {editing && mine ? <MemorySheet memory={mine} onClose={() => setEditing(false)} /> : null}
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  bar: { alignSelf: 'flex-start' },
  section: { gap: space.md },
  memory: { gap: space.xs, padding: space.lg },
  edit: { alignSelf: 'flex-start', marginTop: space.xs },
});
