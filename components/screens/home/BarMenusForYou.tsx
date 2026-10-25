import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, TextLink, useDs } from '@/components/ds';
import { DrinkThumb, MenuRowFrame } from '@/components/screens/menus/MenuRows';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, space } from '@/constants/tokens';
import { FIFTY_BEST_READ, useBarMenusForYou, useFiftyBest, type BarMenuForYou } from '@/hooks/useBarMenusForYou';
import { useSavedMenus } from '@/hooks/useKept';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { barMenuPicks, listMenuPicks, type ForYouHad } from '@/lib/collectionMenus';
import { plural } from '@/lib/menus';

import { BarMark } from './BarMark';
import { CardGrid } from './CardGrid';

const menuHref = (e: BarMenuForYou) => `/p/${e.barId}/menus/${e.id}` as Href;
const andNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]);

/** The 50 Best picks in Bar menus for you's shape: the best placed first, the rest after it, no news. */
function coldPicks(list: { edition: BarMenuForYou; reason: string }[]) {
  const [first, ...rest] = list;
  return { featured: first ? { edition: first.edition, ranked: [] as ForYouHad[] } : null, rail: rest.slice(0, 6), news: [] as { edition: BarMenuForYou; title: string; sub: string }[] };
}

/** A bar's menu as a menu row (menus-one-look): its first drink, the name, then "Kinsman · 10 drinks · on now". */
function ForYouRow({ edition, reason }: { edition: BarMenuForYou; reason: string }) {
  const router = useRouter();
  const first = edition.drinks[0];
  const line = [edition.barName, edition.drinkIds.length ? plural(edition.drinkIds.length, 'drink') : null, edition.dates.isCurrent ? 'on now' : null].filter(Boolean).join(' · ');
  return (
    <MenuRowFrame
      label={`${edition.name}. ${line}. ${reason}`}
      onPress={() => router.push(menuHref(edition))}
      thumb={first ? <DrinkThumb itemId={first.id} name={first.name} /> : <BarMark name={edition.barName} logoUrl={edition.barAvatarUrl} size={56} filled />}
      name={edition.name}
      line={line}
    />
  );
}

/**
 * Bar menus for you (b08, option E), as menu rows (menus-one-look): from the
 * bars you had drinks at, the menu on now you know best first, then the
 * others "because of drinks you had", and what's new at bars you ranked.
 * Menus you saved are left out. Before you've ranked a drink at a bar, the
 * World's 50 Best Bars' menus on now, best placed first. A desktop (`wide`)
 * sets the rows in a grid. Each opens the menu, where it can be saved.
 */
export function BarMenusForYou({ wide }: { wide: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const had = useMyHadDrinks().data ?? [];
  const saved = useSavedMenus().data ?? [];
  const [now] = useState(() => Date.now());
  const atBars: ForYouHad[] = had.flatMap((h) => (h.venue ? [{ itemId: h.itemId, name: h.name, score: h.score, barId: h.venue.id }] : []));
  const savedIds = new Set(saved.map((m) => m.editionId));
  const editions = useBarMenusForYou(atBars.map((h) => h.barId)).data ?? [];
  const ranked = barMenuPicks(atBars, editions, savedIds, now);
  // Nothing on now at a bar you ranked a drink at: the menus on now at the World's 50 Best Bars (canvas E, decided 10 Oct).
  const cold = !ranked.featured;
  const places = useFiftyBest(cold).data ?? [];
  const listEditions = useBarMenusForYou(cold ? places.slice(0, FIFTY_BEST_READ).map((p) => p.barId) : [], { currentOnly: true }).data ?? [];
  const listed = cold ? listMenuPicks(places, listEditions, savedIds) : [];
  const picks = cold ? coldPicks(listed) : ranked;
  if (!picks.featured) return null;
  const { featured } = picks;
  const rankedWhy = cold ? (listed[0]?.reason ?? '') : `You ranked ${andNames(featured.ranked.slice(0, 2).map((h) => h.name))} here`;
  const all = [{ edition: featured.edition, reason: rankedWhy }, ...picks.rail];

  return (
    <View style={[styles.section, { borderTopColor: ds.c.line }]}>
      <View style={styles.head}>
        <Headline role="heading">Bar menus for you</Headline>
        <TextLink label={wide ? 'Browse bar menus' : 'Browse'} onPress={() => router.push('/discover')} />
      </View>
      <Caption tone="muted">
        {cold
          ? 'On now at The World’s 50 Best Bars. Rank a drink you had at a bar and these become picks for you. Make one at home, credited to the bar.'
          : wide
            ? 'From bars you ranked and drinks you had. Make one at home, credited to the bar.'
            : 'Picked from the bars you ranked and the drinks you had there. Make one at home, credited to the bar.'}
      </Caption>
      {wide ? (
        <CardGrid min={300} gap={space.sm}>
          {all.map((p) => (
            <ForYouRow key={p.edition.id} edition={p.edition} reason={p.reason} />
          ))}
        </CardGrid>
      ) : (
        <View style={styles.group}>
          {all.map((p) => (
            <ForYouRow key={p.edition.id} edition={p.edition} reason={p.reason} />
          ))}
        </View>
      )}
      {picks.news.length ? (
        <View style={styles.group}>
          <Headline role="heading">New at bars you ranked</Headline>
          {picks.news.map((n) => (
            <PressableScale key={n.edition.id} role="link" accessibilityLabel={`${n.title}. ${n.sub}`} onPress={() => router.push(`/p/${n.edition.barHandle || n.edition.barId}` as Href)} style={[styles.news, { borderBottomColor: ds.c.line }]}>
              <BarMark name={n.edition.barName} logoUrl={n.edition.barAvatarUrl} size={40} filled />
              <View style={styles.flex}>
                <DsText variant="body" style={styles.semi}>
                  {n.title}
                </DsText>
                <Caption tone="muted">{n.sub}</Caption>
              </View>
              <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.lg, paddingTop: space.xl, borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  group: { gap: space.sm + 2 },
  flex: { flex: 1, minWidth: 0 },
  semi: { fontFamily: fontFamilies.bodySemiBold },
  news: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
