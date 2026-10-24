import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, DsText, IngredientThumb, PressableScale, Tag, useBreakpoint, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { MadeSheet } from '@/components/screens/made/MadeSheet';
import { useAgeGate } from '@/components/screens/safety/AgeGate';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import type { CollectedDrink } from '@/hooks/useCollection';
import { useShelfEdit } from '@/hooks/useHomeBar';
import { needLine, nextBottle, toMakeGroups, type HomeReach, type ShelfMatch } from '@/lib/collectionStages';
import { itemHref } from '@/lib/itemRoutes';

import { stageStyles } from './CollectionStages';

export type MakeDrink = CollectedDrink & { locked: boolean; from: string | undefined };

/** What stands between you and the drink: "Need Cynar", "Need 3 or more bottles", "Names only". Null when it's ready. */
function reachText(d: MakeDrink, reach: HomeReach): string | null {
  if (d.locked) return 'Names only';
  if (reach.kind === 'one' || reach.kind === 'two') return needLine(reach.need);
  return reach.kind === 'far' ? 'Need 3 or more bottles' : null;
}

/** "Buy Cynar, make 2 more": the bottle that opens the most of the list, and "I have it" to put it on your shelf. */
function NextBottle({ drinks, shelf }: { drinks: MakeDrink[]; shelf: ShelfMatch }) {
  const ds = useDs();
  const edit = useShelfEdit();
  const desk = useBreakpoint() === 'desktop';
  const pick = nextBottle(drinks, shelf.oneAway);
  if (!pick) return null;
  const names = pick.bottles.map((b) => b.name).join(' and ');
  const ids = pick.bottles.flatMap((b) => (b.id ? [b.id] : []));
  const title = `Buy ${names}, make ${pick.drinks.length} more`;
  const which = pick.drinks.map((d) => d.name).join(pick.drinks.length === 2 ? ' and ' : ', ');
  const have = ids.length ? <Button label="I have it" size="sm" variant="primary" accessibilityLabel={`I have ${names}. Add it to My Bar`} disabled={edit.add.isPending} onPress={() => edit.add.mutate(ids)} /> : null;
  return (
    <View style={[styles.card, desk ? styles.cardDesk : null, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.cardTop}>
        <IngredientThumb id={pick.bottles[0].id} name={pick.bottles[0].name} size={desk ? 56 : 44} />
        <View style={stageStyles.grow}>
          <DsText variant="headline">{title}</DsText>
          <Caption tone="muted">{which}</Caption>
        </View>
        {desk ? have : null}
      </View>
      {desk ? null : have}
    </View>
  );
}

/**
 * To make (board home-collection-drinks, step 2): the bottle that opens the
 * most of the list on top, then Ready now, One bottle away, Need more and
 * Spec not public. A ready drink has Made it, the same sheet as the drink
 * page's I made it.
 */
export function ToMake({ drinks, shelf }: { drinks: MakeDrink[]; shelf: ShelfMatch }) {
  const ds = useDs();
  const desk = useBreakpoint() === 'desktop';
  const router = useRouter();
  const ageGate = useAgeGate();
  const [making, setMaking] = useState<MakeDrink | null>(null);
  if (!drinks.length) return <Body tone="muted">Tap the bookmark on any drink to save it here for a night in. Drinks you collect from bars land here too.</Body>;
  const groups = toMakeGroups(drinks, shelf);
  // A bar's published drink opens its public page; a classic its own.
  const href = (d: MakeDrink) => (d.liveMode ? `/d/${d.itemId}` : itemHref('Cocktail', d.itemId!));
  const made = (d: MakeDrink) => (
    <Button label="Made it" size="sm" variant="secondary" accessibilityLabel={`I made ${d.name}`} onPress={() => ageGate.gate(() => setMaking(d))} />
  );
  return (
    <View style={styles.wrap}>
      <NextBottle drinks={drinks} shelf={shelf} />
      {groups.map((g) => (
        <View key={g.key} style={stageStyles.section}>
          <DsText variant="body" role="heading" style={styles.groupTitle}>
            {g.title} <DsText variant="body" tone="muted">{String(g.drinks.length)}</DsText>
          </DsText>
          <View role="list">
            {g.drinks.map(({ drink: d, reach }) => {
              const need = reachText(d, reach);
              const label = [d.name, d.from, need ?? 'Ready', d.note].filter(Boolean).join('. ');
              const status = need ? (
                <View style={styles.status}>
                  {d.locked ? <IconSymbol name="lock.fill" size={11} color={ds.c.muted} /> : null}
                  <Caption tone="muted" numberOfLines={1} style={styles.shrink}>
                    {need}
                  </Caption>
                </View>
              ) : null;
              return (
                <View role="listitem" key={d.id}>
                  {desk ? (
                    <View style={[stageStyles.tableRow, { borderBottomColor: ds.c.line }]}>
                      <PressableScale role="link" accessibilityLabel={label} onPress={() => router.push(href(d) as Href)} style={[stageStyles.grow, styles.drink]}>
                        <DrinkImage source={d.imageUrl} itemId={d.itemId} accessibilityLabel={d.name} radius="control" aspectRatio={1} style={styles.thumb} />
                        <DsText variant="headline" numberOfLines={1} style={stageStyles.grow}>
                          {d.name}
                        </DsText>
                      </PressableScale>
                      <Body tone="muted" numberOfLines={1} style={styles.from}>
                        {d.from ?? ''}
                      </Body>
                      <View style={styles.home}>{status ?? <Tag label="Ready" tone="accent" />}</View>
                      <View style={styles.action}>{reach.kind === 'ready' && !d.locked ? made(d) : null}</View>
                    </View>
                  ) : (
                    <DrinkRow
                      compact
                      name={d.name}
                      itemId={d.itemId}
                      href={href(d)}
                      imageUrl={d.imageUrl}
                      glass={null}
                      caption={d.from}
                      note={d.note ?? undefined}
                      below={status ?? undefined}
                      trailing={reach.kind === 'ready' && !d.locked ? made(d) : undefined}
                      label={label}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
      {making?.itemId ? <MadeSheet item={{ id: making.itemId, name: making.name }} ingredients={[]} barName={making.classic ? null : making.barName} onClose={() => setMaking(null)} /> : null}
      {ageGate.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
  card: { gap: space.sm + 2, padding: space.md + 2, borderRadius: radius.card, borderWidth: 1 },
  cardDesk: { padding: space.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  groupTitle: { fontWeight: '600' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrink: { flexShrink: 1 },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 48, height: 48 },
  from: { width: 240 },
  home: { width: 260, alignItems: 'flex-start' },
  action: { width: 110, alignItems: 'flex-end' },
});
