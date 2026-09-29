import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { MemorySheet } from '@/components/screens/published/MemorySheet';
import { space } from '@/constants/tokens';
import { useCollection, type CollectedDrink } from '@/hooks/useCollection';
import { dayLabel, hadOnLine, splitCollection } from '@/lib/collection';
import { plural } from '@/lib/menus';

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Headline role="heading">{title}</Headline>
      {note ? <Caption tone="muted">{note}</Caption> : null}
      <View role="list">{children}</View>
    </View>
  );
}

/**
 * What you collected from bars: releases, the drinks that are still
 * published (their page and spec open), and past drinks, memories of drinks
 * the bar has since taken down, grouped by bar. Tapping a memory edits when
 * you had it and your note.
 */
export function CollectionCollected() {
  const { data, isLoading, error } = useCollection();
  const [now] = useState(() => Date.now());
  const [editing, setEditing] = useState<CollectedDrink | null>(null);
  if (error) return <Body tone="muted">Couldn’t load your collection. Try again in a moment.</Body>;
  if (isLoading || !data) return null;

  const { live, past } = splitCollection(data.drinks);
  const memoryLine = (d: CollectedDrink, withBar: boolean) =>
    [withBar ? d.barName : null, hadOnLine(d.hadOn, now)].filter(Boolean).join(' · ') || undefined;

  if (!data.drinks.length && !data.releases.length) {
    return (
      <Section title="From bars">
        <Body tone="muted">Collect drinks and releases from bars on Discover. They stay here, with when you had them and a note.</Body>
      </Section>
    );
  }

  return (
    <View style={styles.wrap}>
      {data.releases.length ? (
        <Section title="Releases" note={plural(data.releases.length, 'release')}>
          {data.releases.map((r) => (
            <View role="listitem" key={r.id}>
              <DrinkRow
                name={r.name}
                href={r.live && r.releaseId ? `/r/${r.releaseId}` : undefined}
                imageUrl={r.coverUrl}
                glass={null}
                caption={[r.barName, r.releaseDate ? dayLabel(r.releaseDate, now) : null, r.live ? null : 'No longer public'].filter(Boolean).join(' · ')}
              />
            </View>
          ))}
        </Section>
      ) : null}
      {live.length ? (
        <Section title="Drinks" note={`${plural(live.length, 'drink')} from bars`}>
          {live.map((d) => (
            <View role="listitem" key={d.id}>
              <DrinkRow name={d.name} href={`/d/${d.itemId}`} imageUrl={d.imageUrl} glass={null} caption={memoryLine(d, true)} note={d.note ?? undefined} />
            </View>
          ))}
        </Section>
      ) : null}
      {past.length ? (
        <View style={styles.section}>
          <Headline role="heading">Past drinks</Headline>
          <Caption tone="muted">No longer on the bar’s public menu. You keep the memory; the spec went with it.</Caption>
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
                      onPress={() => setEditing(d)}
                      imageUrl={d.imageUrl}
                      glass={null}
                      caption={memoryLine(d, false) ?? 'Add when you had it'}
                      note={d.note ?? undefined}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
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
