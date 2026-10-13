import { Fragment, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Caption, Headline, PressableScale, RowScore, TextLink, Title, scoreWords, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import type { HadDrink } from '@/lib/hadDrinks';
import { itemHref } from '@/lib/itemRoutes';
import { withAlpha } from '@/lib/color';
import type { MadeTally } from '@/lib/madeIt';
import { formatScore } from '@/lib/ranking';

export type CountJump = 'had' | 'toMake' | 'made';

/**
 * Had out, To make, Made: where your drinks are, across the top of
 * Collection's Drinks, with arrows between. Each jumps to its part of the
 * page (Had out to your had list on You); To make is lit, it's this page's
 * main list.
 */
export function DrinkCounts({ had, toMake, made, onJump }: { had: number; toMake: number; made: number; onJump: (to: CountJump) => void }) {
  const ds = useDs();
  const cells: { key: CountJump; n: number; label: string }[] = [
    { key: 'had', n: had, label: 'Had out' },
    { key: 'toMake', n: toMake, label: 'To make' },
    { key: 'made', n: made, label: 'Made' },
  ];
  return (
    <View style={styles.counts} aria-label="Where your drinks are">
      {cells.map((c, i) => {
        const lit = c.key === 'toMake';
        return (
          <Fragment key={c.key}>
            {i ? <IconSymbol name="arrow.right" size={14} color={ds.c.faint} /> : null}
            <PressableScale
              role="link"
              aria-current={lit ? true : undefined}
              accessibilityLabel={`${c.n} ${c.label}`}
              onPress={() => onJump(c.key)}
              style={[styles.cell, { backgroundColor: lit ? ds.c.raised : ds.c.surface, borderColor: lit ? withAlpha(ds.accentText, 0.45) : 'transparent' }]}
            >
              <Title tone={lit ? 'accent' : 'ink'} role={undefined}>
                {String(c.n)}
              </Title>
              <Caption tone="muted">{c.label}</Caption>
            </PressableScale>
          </Fragment>
        );
      })}
    </View>
  );
}

const SHOWN = 3;

/** "Little Rye’s spec · made 3 times", "Classic · made once", or just the times. */
function madeLine(t: MadeTally, spec: string | null): string {
  const times = t.times === 1 ? 'made once' : `made ${t.times} times`;
  return spec ? `${spec} · ${times}` : times.charAt(0).toUpperCase() + times.slice(1);
}

/**
 * The drinks you've made at home, latest first: whose spec you made, and your
 * score for your version over the one you gave the bar's (or "classic"). The
 * first three, then All.
 */
export function MadeAtHome({ tallies, had, classics, onLayout }: { tallies: MadeTally[]; had: HadDrink[]; classics: ReadonlySet<string>; onLayout?: (e: LayoutChangeEvent) => void }) {
  const [all, setAll] = useState(false);
  if (!tallies.length) return null;
  const shown = all ? tallies : tallies.slice(0, SHOWN);
  return (
    <View style={styles.section} onLayout={onLayout}>
      <View style={styles.head}>
        <Headline role="heading">Made at home</Headline>
        {tallies.length > SHOWN && !all ? <TextLink label={`All ${tallies.length}`} onPress={() => setAll(true)} /> : null}
      </View>
      <Caption tone="muted">Your score for your version, beside what you gave the bar’s.</Caption>
      <View role="list">
        {shown.map((t) => {
          const home = had.find((h) => h.itemId === t.itemId && !h.venue && !h.atBar);
          const bar = had.find((h) => h.itemId === t.itemId && (h.venue || h.atBar));
          const classic = classics.has(t.itemId);
          const spec = bar?.venue ? `${bar.venue.name}’s spec` : classic ? 'Classic' : null;
          const detail = bar ? `bar ${formatScore(bar.score)}` : classic ? 'classic' : null;
          const line = madeLine(t, spec);
          return (
            <View role="listitem" key={t.itemId}>
              <DrinkRow
                compact
                name={t.name}
                itemId={t.itemId}
                href={itemHref('Cocktail', t.itemId)}
                imageUrl={t.imageUrl}
                glass={null}
                caption={line}
                label={[t.name, line, home ? `your ${scoreWords(home.score, detail)}` : null].filter(Boolean).join('. ')}
                trailing={home ? <RowScore score={home.score} detail={detail} /> : undefined}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  counts: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  cell: { flex: 1, padding: space.md, borderRadius: radius.control, borderWidth: 1, gap: 2 },
  section: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});
