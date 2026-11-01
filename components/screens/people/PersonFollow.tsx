import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, RowScore, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { itemHref } from '@/lib/itemRoutes';
import { bestLine, dotLine, rankWhen } from '@/lib/follows';
import type { HadDrink } from '@/lib/hadDrinks';
import { formatScore } from '@/lib/ranking';

import { RankRow } from '../rankings/RankingLists';
import { FollowButton, type useFollow } from './Follow';

/** Lately shows this many of their newest ranks; their best, this many (pins run 1 to 4, so every pin shows). */
const LATELY = 3;
const BEST = 4;

/**
 * Under a person's name (Kept-follow): Follow (or Following, or Follow back)
 * beside Share, and once you follow them, where their ranks go.
 */
export function PersonActions({ follow, name, onShare }: { follow: ReturnType<typeof useFollow> | null; name: string; onShare: () => void }) {
  const first = name.split(' ')[0] || name;
  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        {follow ? <FollowButton follow={follow} name={name} /> : null}
        <Button label="Share" icon="square.and.arrow.up" variant="secondary" onPress={onShare} style={styles.grow} />
      </View>
      {follow?.following ? <Note icon="calendar" text={`${first}’s new ranks show on your Tonight.`} /> : null}
    </View>
  );
}

/** A soft card with an icon and a sentence. */
function Note({ icon, text }: { icon: 'calendar' | 'lock.fill'; text: string }) {
  const ds = useDs();
  return (
    <View style={[styles.note, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name={icon} size={18} color={ds.c.muted} />
      <Body style={styles.grow}>{text}</Body>
    </View>
  );
}

/**
 * What they've ranked, as they share it: Lately (newest first, with the bar
 * and when) and their best (their own pins first, then the top scores).
 * Someone who keeps their ranks to themselves gets the drawn lock note.
 */
export function PersonRanks({ name, drinks, keeps, following, families }: { name: string; drinks: HadDrink[] | undefined; keeps: boolean; following: boolean; families: Record<string, string | null> }) {
  const first = name.split(' ')[0] || name;
  if (keeps) {
    return (
      <Section title={`${first}’s ranks`}>
        <Note icon="lock.fill" text={`${first} keeps their ranks to themselves for now. ${following ? 'Any' : 'Follow, and any'} they share show on your Tonight.`} />
      </Section>
    );
  }
  if (!drinks?.length) return null;
  const now = new Date();
  const lately = drinks
    .filter((d) => d.createdAt)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, LATELY);
  const best = bestOf(drinks, families);
  return (
    <>
      {lately.length ? (
        <Section title="Lately">
          <View role="list">
            {lately.map((d) => {
              const family = families[d.itemId];
              const caption = dotLine([d.venue?.name, best.top.get(family ?? '') === d.id && family ? `now ${bestLine(first, family)}` : null, rankWhen(d.createdAt, now)]);
              return (
                <View role="listitem" key={d.id}>
                  <DrinkRow name={d.name} href={itemHref('Cocktail', d.itemId)} itemId={d.itemId} imageUrl={d.imageUrl} glass={null} caption={caption} label={`${d.name}. ${caption}. Score ${formatScore(d.score)}`} trailing={<RowScore score={d.score} />} />
                </View>
              );
            })}
          </View>
        </Section>
      ) : null}
      <Section title={`${first}’s best`}>
        <View role="list">
          {best.list.map((d, i) => (
            <View role="listitem" key={d.id}>
              <RankRow position={i + 1} title={d.name} detail={d.venue?.name ?? (d.atBar ? 'At a bar' : 'At home')} score={d.score} drinkId={d.itemId} />
            </View>
          ))}
        </View>
      </Section>
    </>
  );
}

/** Their pins in order, then their highest scores; and each family's top drink, for "now Sam's best sour". */
function bestOf(drinks: HadDrink[], families: Record<string, string | null>) {
  const byScore = [...drinks].sort((a, b) => b.score - a.score || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const pinned = drinks.filter((d) => d.pin).sort((a, b) => (a.pin ?? 0) - (b.pin ?? 0));
  const list = [...pinned, ...byScore.filter((d) => !d.pin)].slice(0, BEST);
  const top = new Map<string, string>();
  for (const d of byScore) {
    const f = families[d.itemId];
    if (f && !top.has(f)) top.set(f, d.id);
  }
  return { list, top };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Caption tone="muted" role="heading" style={styles.caps}>
        {title}
      </Caption>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md, alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  section: { gap: space.sm },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
