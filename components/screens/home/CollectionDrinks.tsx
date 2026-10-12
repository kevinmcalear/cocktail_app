import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useRouter } from 'expo-router';

import { Body, Caption, Headline, RowScore, Tag, scoreWords } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { MemorySheet } from '@/components/screens/published/MemorySheet';
import { space } from '@/constants/tokens';
import { useCollection, type CollectedDrink } from '@/hooks/useCollection';
import { useMyBar } from '@/hooks/useHomeBar';
import { useMadeDrinks } from '@/hooks/useMade';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { hadOnLine, splitCollection } from '@/lib/collection';
import { itemHref } from '@/lib/itemRoutes';
import { tallyMade } from '@/lib/madeIt';
import { formatScore } from '@/lib/ranking';
import { readyFirst, shelfTag } from '@/lib/toMake';

import { DrinkCounts, MadeAtHome, type CountJump } from './CollectionMade';

function Section({ title, aside, note, children, onLayout }: { title: string; aside?: string; note?: string; children: ReactNode; onLayout?: (e: LayoutChangeEvent) => void }) {
  return (
    <View style={styles.section} onLayout={onLayout}>
      <View style={styles.head}>
        <Headline role="heading">{title}</Headline>
        {aside ? <Caption tone="muted">{aside}</Caption> : null}
      </View>
      {note ? <Caption tone="muted">{note}</Caption> : null}
      {children}
    </View>
  );
}

/** A To make row's pill: Ready, Need Cynar, or a lock and Names only for a bar drink whose spec isn't open. */
function StatusPill({ drink, shelf }: { drink: CollectedDrink; shelf: string | undefined }) {
  if (drink.liveMode === 'description' && !drink.specOpens) return <Tag label="Names only" tone="outline" icon="lock.fill" />;
  if (!shelf) return null;
  return <Tag label={shelf} tone={shelf === 'Ready' ? 'accent' : 'outline'} />;
}

/**
 * Collection's Drinks, from had out to made: how many of each, each jumping
 * to its part; To make, every drink saved with the bookmark (on any drink
 * page, or Collect on a bar's) and not made yet, ready ones first against
 * your shelf, each saying where it's from with your score; what you've made
 * at home; then past drinks, memories of bar drinks that aren't public any
 * more, grouped by bar. Tapping a memory edits when you had it and your note.
 * `onJump` scrolls the page to a point in this list (the screen owns the scroll).
 */
export function CollectionDrinks({ onJump }: { onJump?: (y: number) => void }) {
  const router = useRouter();
  const at = useRef<Record<string, number>>({});
  const { data, isLoading, error } = useCollection();
  const bar = useMyBar();
  const made = useMadeDrinks().data ?? [];
  const had = useMyHadDrinks().data ?? [];
  const [now] = useState(() => Date.now());
  const [editing, setEditing] = useState<CollectedDrink | null>(null);
  if (error) return <Body tone="muted">Couldn’t load your collection. Try again in a moment.</Body>;
  if (isLoading || !data) return null;

  const { live, past } = splitCollection(data.drinks);
  const tagOf = (d: CollectedDrink) => shelfTag(d.itemId, bar.canMakeIds, bar.oneAway);
  const tallies = tallyMade(made);
  const madeIds = new Set(tallies.map((t) => t.itemId));
  const classics = new Set(made.filter((m) => m.classic).map((m) => m.itemId));
  const toMake = readyFirst(live.filter((d) => !d.itemId || !madeIds.has(d.itemId)), tagOf);
  // Your own score for a past drink you ranked (b02), the best if you ranked it twice.
  const yours = new Map<string, number>();
  for (const h of had) yours.set(h.itemId, Math.max(h.score, yours.get(h.itemId) ?? 0));
  const line = (d: CollectedDrink, withBar: boolean) => [withBar ? d.barName : null, hadOnLine(d.hadOn, now)].filter(Boolean).join(' · ') || undefined;
  const scoreOf = (d: CollectedDrink) => (d.itemId ? yours.get(d.itemId) : undefined);
  // "Had at Little Rye · 8.4", "Saved from Pale Moth", "Saved · classic".
  const from = (d: CollectedDrink) => {
    const score = scoreOf(d);
    const had = d.barName && (score !== undefined || d.hadOn);
    const place = had ? `Had at ${d.barName}` : d.classic ? 'Saved · classic' : d.barName ? `Saved from ${d.barName}` : null;
    return [place, score !== undefined ? formatScore(score) : null].filter(Boolean).join(' · ') || undefined;
  };
  const jump = (to: CountJump) => {
    if (to === 'had') router.push('/profile');
    else if (at.current[to] !== undefined) onJump?.(at.current[to]);
  };

  return (
    <View style={styles.wrap}>
      <DrinkCounts had={had.filter((h) => h.venue || h.atBar).length} toMake={toMake.length} made={tallies.length} onJump={jump} />
      <Section
        title="To make"
        aside={toMake.length ? 'Ready first' : undefined}
        note={toMake.length ? 'Drinks you bookmarked and ones you had out, to try at home. The bookmark on any drink puts it here.' : undefined}
        onLayout={(e: LayoutChangeEvent) => (at.current.toMake = e.nativeEvent.layout.y)}
      >
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
                  caption={from(d)}
                  note={d.note ?? undefined}
                  trailing={<StatusPill drink={d} shelf={tagOf(d)} />}
                  label={[d.name, from(d), d.liveMode === 'description' && !d.specOpens ? 'Names only' : tagOf(d), d.note].filter(Boolean).join('. ')}
                />
              </View>
            ))}
          </View>
        ) : (
          <Body tone="muted">Tap the bookmark on any drink to save it here for a night in. Drinks you collect from bars land here too.</Body>
        )}
      </Section>
      <MadeAtHome tallies={tallies} had={had} classics={classics} onLayout={(e: LayoutChangeEvent) => (at.current.made = e.nativeEvent.layout.y)} />
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
                      trailing={<RowScore score={d.itemId ? yours.get(d.itemId) : null} />}
                      label={d.itemId && yours.has(d.itemId) ? [d.name, line(d, false), `your ${scoreWords(yours.get(d.itemId))}`, d.note].filter(Boolean).join('. ') : undefined}
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
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  group: { gap: space.xs, paddingTop: space.md },
  groupTitle: { letterSpacing: 1.5 },
});
