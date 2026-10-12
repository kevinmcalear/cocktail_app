import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Headline, PressableScale, Spec, TextLink, Title, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { useBarMenusForYou, type BarMenuForYou } from '@/hooks/useBarMenusForYou';
import { useSaveBarMenu, useSavedMenus } from '@/hooks/useKept';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { barMenuPicks, type ForYouHad } from '@/lib/collectionMenus';
import { menuRange } from '@/lib/menuEditions';
import { formatScore } from '@/lib/ranking';

import { useAgeGate } from '../safety/AgeGate';
import { BarMark } from './BarMark';
import { CardGrid, CardRail } from './CardGrid';

const menuHref = (e: BarMenuForYou) => `/p/${e.barId}/menus/${e.id}` as Href;
const andNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]);

/** Keep a bar's menu in Saved from bars: the round bookmark beside Make it at home. */
function SaveIcon({ edition }: { edition: BarMenuForYou }) {
  const ds = useDs();
  const save = useSaveBarMenu();
  const age = useAgeGate();
  return (
    <>
      <PressableScale
        role="button"
        accessibilityLabel={`Save ${edition.name}`}
        aria-pressed={false}
        onPress={() => age.gate(() => save.mutate({ editionId: edition.id, save: true }))}
        style={[styles.save, { borderColor: ds.c.lineStrong }]}
      >
        <IconSymbol name="bookmark" size={18} color={ds.c.ink} />
      </PressableScale>
      {age.sheet}
    </>
  );
}

/** A bar's menu on now, in full: the bar, the menu and its theme, its first drinks with your scores, why it's here, Make it at home and Save. */
function ForYouCard({ edition, ranked, reason }: { edition: BarMenuForYou; ranked: ForYouHad[]; reason: string }) {
  const ds = useDs();
  const router = useRouter();
  const more = edition.drinkIds.length - 3;
  const since = menuRange(edition.dates).replace('On now since', 'menu on now since');
  return (
    <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.cardTop}>
        <View style={styles.barRow}>
          <BarMark name={edition.barName} logoUrl={edition.barAvatarUrl} size={36} filled />
          <View style={styles.flex}>
            <DsText variant="body" style={styles.semi}>
              {edition.barName}
            </DsText>
            <Caption tone="muted">{[edition.barPlace, since].filter(Boolean).join(' · ')}</Caption>
          </View>
        </View>
        <Title italic>{edition.name}</Title>
        {edition.theme ? <Body tone="muted">{edition.theme}</Body> : null}
      </View>
      <View role="list" style={styles.drinks}>
        {edition.drinks.slice(0, 3).map((d, i) => {
          const mine = ranked.find((h) => h.itemId === d.id);
          return (
            <View role="listitem" key={d.id} style={[styles.drink, { borderTopColor: ds.c.line }]}>
              <View style={styles.drinkHead}>
                <Caption style={styles.drinkName}>{d.name.toUpperCase()}</Caption>
                {mine ? <Spec accessibilityLabel={`your score ${formatScore(mine.score)}`}>{formatScore(mine.score)}</Spec> : i === 2 && more > 0 ? <Caption tone="muted">{`and ${more} more`}</Caption> : null}
              </View>
              {d.line ? (
                <Caption tone="muted" numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].italic }}>
                  {d.line}
                </Caption>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.cardFoot}>
        <View style={styles.reason}>
          <IconSymbol name="star" size={14} color={ds.c.muted} />
          <Caption tone="muted" style={styles.flex}>
            {reason}
          </Caption>
        </View>
        <View style={styles.actions}>
          <Button label="Make it at home" variant="secondary" onPress={() => router.push(menuHref(edition))} style={styles.flex} />
          <SaveIcon edition={edition} />
        </View>
      </View>
    </View>
  );
}

/** A smaller card in the phone's sideways rail: the bar, the menu, three drinks, and why. */
function RailCard({ edition, reason }: { edition: BarMenuForYou; reason: string }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale role="link" accessibilityLabel={[edition.name, edition.barName, reason].join('. ')} onPress={() => router.push(menuHref(edition))} style={[styles.rail, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.barRow}>
        <BarMark name={edition.barName} logoUrl={edition.barAvatarUrl} size={28} filled />
        <Caption style={[styles.flex, styles.semi]} numberOfLines={1}>
          {[edition.barName, edition.barPlace].filter(Boolean).join(' · ')}
        </Caption>
      </View>
      <DsText variant="headline" numberOfLines={3} style={{ fontFamily: displayFaces[ds.displayFace].italic }}>
        {edition.name}
      </DsText>
      <Caption color={ds.accentText} style={styles.drinkName}>
        {edition.drinks.slice(0, 3).map((d) => d.name.toUpperCase()).join('\n')}
      </Caption>
      <Caption tone="muted" style={styles.railReason}>
        {reason}
      </Caption>
    </PressableScale>
  );
}

/**
 * Bar menus for you (b08, option E): from the bars you had drinks at, the
 * menu on now you know best in full, a rail of the others "because of drinks
 * you had", and what's new at bars you ranked. Menus you saved are left out.
 * Nothing at all until you've ranked a drink at a bar. A desktop (`wide`)
 * shows every pick as a full card in a grid.
 */
export function BarMenusForYou({ wide }: { wide: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const had = useMyHadDrinks().data ?? [];
  const saved = useSavedMenus().data ?? [];
  const [now] = useState(() => Date.now());
  const atBars: ForYouHad[] = had.flatMap((h) => (h.venue ? [{ itemId: h.itemId, name: h.name, score: h.score, barId: h.venue.id }] : []));
  const editions = useBarMenusForYou(atBars.map((h) => h.barId)).data ?? [];
  const picks = barMenuPicks(atBars, editions, new Set(saved.map((m) => m.editionId)), now);
  if (!picks.featured) return null;
  const { featured } = picks;
  const rankedWhy = `You ranked ${andNames(featured.ranked.slice(0, 2).map((h) => h.name))} here`;
  const all = [{ edition: featured.edition, reason: rankedWhy }, ...picks.rail];

  return (
    <View style={[styles.section, { borderTopColor: ds.c.line }]}>
      <View style={styles.head}>
        <Headline role="heading">Bar menus for you</Headline>
        <TextLink label={wide ? 'Browse bar menus' : 'Browse'} onPress={() => router.push('/discover')} />
      </View>
      <Caption tone="muted">
        {wide ? 'From bars you ranked and drinks you had. Make one at home, credited to the bar.' : 'Picked from the bars you ranked and the drinks you had there. Make one at home, credited to the bar.'}
      </Caption>
      {wide ? (
        <CardGrid min={300} gap={space.lg}>
          {all.map((p) => (
            <ForYouCard key={p.edition.id} edition={p.edition} ranked={featured.edition === p.edition ? featured.ranked : atBars.filter((h) => h.barId === p.edition.barId)} reason={p.reason} />
          ))}
        </CardGrid>
      ) : (
        <>
          <ForYouCard edition={featured.edition} ranked={featured.ranked} reason={rankedWhy} />
          {picks.rail.length ? (
            <View style={styles.group}>
              <Headline role="heading">Because of drinks you had</Headline>
              <CardRail width={220} gutter={gutter}>
                {picks.rail.map((r) => (
                  <RailCard key={r.edition.id} edition={r.edition} reason={r.reason} />
                ))}
              </CardRail>
            </View>
          ) : null}
        </>
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
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  cardTop: { padding: space.xl - 4, gap: space.md },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  flex: { flex: 1, minWidth: 0 },
  semi: { fontFamily: fontFamilies.bodySemiBold },
  drinks: { paddingHorizontal: space.xl - 4 },
  drink: { paddingVertical: space.sm + 2, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  drinkHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  drinkName: { fontFamily: fontFamilies.bodySemiBold, letterSpacing: 1.4 },
  cardFoot: { paddingHorizontal: space.xl - 4, paddingTop: space.md, paddingBottom: space.xl - 4, gap: space.md },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  save: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rail: { minHeight: 236, borderRadius: radius.card, borderWidth: 1, padding: space.lg, gap: space.sm + 2 },
  railReason: { marginTop: 'auto' },
  news: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
