import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, Title, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { radius, space } from '@/constants/tokens';
import type { MadeTally } from '@/lib/madeIt';
import type { HadDrink } from '@/lib/hadDrinks';
import { dayLabel } from '@/lib/collection';
import { itemHref } from '@/lib/itemRoutes';
import { formatScore } from '@/lib/ranking';

/** Had out, To make, Made: where your drinks are, across the top of Collection's Drinks. */
export function DrinkCounts({ had, toMake, made }: { had: number; toMake: number; made: number }) {
  const ds = useDs();
  const cell = (n: number, label: string) => (
    <View style={[styles.cell, { backgroundColor: ds.c.surface }]} accessibilityLabel={`${n} ${label}`}>
      <Title>{String(n)}</Title>
      <Caption tone="muted">{label}</Caption>
    </View>
  );
  return (
    <View style={styles.counts}>
      {cell(had, 'Had out')}
      {cell(toMake, 'To make')}
      {cell(made, 'Made')}
    </View>
  );
}

/**
 * The drinks you've made at home, latest first, each with your score for
 * your version beside the one you gave the bar's, when you ranked both.
 */
export function MadeAtHome({ tallies, had }: { tallies: MadeTally[]; had: HadDrink[] }) {
  const [now] = useState(() => Date.now());
  if (!tallies.length) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Made at home</Headline>
      <Caption tone="muted">Your score for your version, beside the bar’s.</Caption>
      <View role="list">
        {tallies.map((t) => {
          const home = had.find((h) => h.itemId === t.itemId && !h.venue && !h.atBar);
          const bar = had.find((h) => h.itemId === t.itemId && (h.venue || h.atBar));
          const times = t.times === 1 ? 'Made once' : `Made ${t.times} times`;
          const scores = [home ? `yours ${formatScore(home.score)}` : null, bar ? `bar ${formatScore(bar.score)}` : null].filter(Boolean).join(', ');
          return (
            <View role="listitem" key={t.itemId}>
              <DrinkRow
                name={t.name}
                itemId={t.itemId}
                href={itemHref('Cocktail', t.itemId)}
                imageUrl={t.imageUrl}
                glass={null}
                caption={`${times} · last ${dayLabel(t.lastOn, now)}`}
                label={`${t.name}. ${times}.${scores ? ` Scores: ${scores}.` : ''}`}
                trailing={
                  home ? (
                    <View style={styles.score}>
                      <DsText variant="spec">{formatScore(home.score)}</DsText>
                      {bar ? <Caption tone="muted">{`bar ${formatScore(bar.score)}`}</Caption> : null}
                    </View>
                  ) : undefined
                }
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  counts: { flexDirection: 'row', gap: space.sm },
  cell: { flex: 1, padding: space.md, borderRadius: radius.control, gap: space.xs },
  section: { gap: space.xs },
  score: { alignItems: 'flex-end' },
});
