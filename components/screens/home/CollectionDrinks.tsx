import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { MemorySheet } from '@/components/screens/published/MemorySheet';
import { space } from '@/constants/tokens';
import { useCollection, type CollectedDrink } from '@/hooks/useCollection';
import { useMyBar } from '@/hooks/useHomeBar';
import { hadOnLine, splitCollection } from '@/lib/collection';
import { itemHref } from '@/lib/itemRoutes';
import { readyFirst, shelfTag } from '@/lib/toMake';

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Headline role="heading">{title}</Headline>
      {note ? <Caption tone="muted">{note}</Caption> : null}
      {children}
    </View>
  );
}

/**
 * Collection's Drinks: To make, every drink saved with the bookmark (on any
 * drink page, or Collect on a bar's), ready ones first against your shelf;
 * then past drinks, memories of bar drinks that aren't public any more,
 * grouped by bar. Tapping a memory edits when you had it and your note.
 */
export function CollectionDrinks() {
  const { data, isLoading, error } = useCollection();
  const bar = useMyBar();
  const [now] = useState(() => Date.now());
  const [editing, setEditing] = useState<CollectedDrink | null>(null);
  if (error) return <Body tone="muted">Couldn’t load your collection. Try again in a moment.</Body>;
  if (isLoading || !data) return null;

  const { live, past } = splitCollection(data.drinks);
  const tagOf = (d: CollectedDrink) => shelfTag(d.itemId, bar.canMakeIds, bar.oneAway);
  const toMake = readyFirst(live, tagOf);
  const line = (d: CollectedDrink, withBar: boolean) => [withBar ? d.barName : null, hadOnLine(d.hadOn, now)].filter(Boolean).join(' · ') || undefined;

  return (
    <View style={styles.wrap}>
      <Section title="To make" note={toMake.length ? 'Ready from your shelf first.' : undefined}>
        {toMake.length ? (
          <View role="list">
            {toMake.map((d) => (
              <View role="listitem" key={d.id}>
                <DrinkRow
                  name={d.name}
                  itemId={d.itemId}
                  // A bar's published drink opens its public page; a classic its own.
                  href={d.liveMode ? `/d/${d.itemId}` : itemHref('Cocktail', d.itemId!)}
                  imageUrl={d.imageUrl}
                  glass={null}
                  caption={line(d, true)}
                  tag={tagOf(d)}
                  note={d.note ?? undefined}
                />
              </View>
            ))}
          </View>
        ) : (
          <Body tone="muted">Tap the bookmark on any drink to save it here for a night in. Drinks you collect from bars land here too.</Body>
        )}
      </Section>
      {past.length ? (
        <Section title="Past drinks" note="No longer on the bar’s public menu. You keep the memory; the spec went with it.">
          {past.map((group) => (
            <View key={group.bar} style={styles.group}>
              <Caption tone="muted" role="heading" style={styles.groupTitle}>
                {group.bar.toUpperCase()}
              </Caption>
              <View role="list">
                {group.drinks.map((d) => (
                  <View role="listitem" key={d.id}>
                    <DrinkRow
                      name={d.name}
                      itemId={d.itemId}
                      onPress={() => setEditing(d)}
                      imageUrl={d.imageUrl}
                      glass={null}
                      caption={line(d, false) ?? 'Add when you had it'}
                      note={d.note ?? undefined}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Section>
      ) : null}
      {editing ? <MemorySheet memory={editing} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
  section: { gap: space.xs },
  group: { gap: space.xs, paddingTop: space.md },
  groupTitle: { letterSpacing: 1.5 },
});
