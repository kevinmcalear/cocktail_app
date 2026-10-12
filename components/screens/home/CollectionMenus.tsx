import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, TextLink, useGutter } from '@/components/ds';
import { HomeNightSheet } from '@/components/screens/menus/HomeNight';
import { NewMenuSheet } from '@/components/screens/menus/NewMenuSheet';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useVenueMenus } from '@/hooks/useMenus';
import { shelfReady, splitHomeMenus } from '@/lib/collectionMenus';
import type { AwayGroup } from '@/lib/toMake';
import type { MenuSummary } from '@/types/menus';

import { CardGrid, CardRail } from './CardGrid';
import { BuildingMenu, NewMenuTile, PastNight, PaperMenuCard } from './HomeMenuCards';

export interface Shelf {
  canMakeIds: Set<string>;
  oneAway: readonly AwayGroup[];
}

const PAST_SHOWN = 3;

/**
 * Your own menus (no venue) on Collection's Menus (b08, option A): dated
 * ones as paper menu cards, soonest first; undated ones under Still building
 * with Pick a night; then Past nights. A phone scrolls the cards sideways; a
 * desktop (`wide`) lays them in a grid with a New menu tile, and New menu
 * moves to the page header (`creating` is lifted for that).
 */
export function CollectionMenus({ shelf, wide, creating, setCreating }: { shelf: Shelf; wide: boolean; creating: boolean; setCreating: (on: boolean) => void }) {
  const router = useRouter();
  const userId = useUserId();
  const gutter = useGutter();
  const { data = [], isLoading } = useVenueMenus(null);
  const [now] = useState(() => Date.now());
  const [picking, setPicking] = useState<MenuSummary | null>(null);
  const mine = data.filter((m) => m.barId === null && m.createdBy === userId);
  const { coming, building, past } = splitHomeMenus(mine, now);
  const ready = (m: MenuSummary) => shelfReady(m.itemIds, shelf.canMakeIds, shelf.oneAway);
  const subtitle = wide
    ? ['For nights in', coming.length ? `${coming.length} coming up` : null, building.length ? `${building.length} still building` : null, past.length ? `${past.length} past ${past.length === 1 ? 'night' : 'nights'}` : null].filter(Boolean).join(' · ')
    : `For nights in.${coming.length ? ` ${coming.length} coming up.` : ''}`;

  const cards = coming.map((m) => <PaperMenuCard key={m.id} menu={m} ready={ready(m)} now={now} compact={wide} />);
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Headline role="heading">Your menus</Headline>
          <Caption tone="muted">{subtitle}</Caption>
        </View>
        {wide ? null : <Button label="New menu" icon="plus" variant="secondary" onPress={() => setCreating(true)} />}
      </View>
      {!isLoading && !mine.length ? <Body tone="muted">Plan a night in: pick the drinks, then share the menu with your guests.</Body> : null}
      {wide ? (
        <CardGrid min={230} gap={space.lg + 4}>
          {cards}
          {building.map((m) => (
            <BuildingMenu key={m.id} menu={m} ready={ready(m)} onPickNight={() => setPicking(m)} card />
          ))}
          <NewMenuTile onPress={() => setCreating(true)} />
        </CardGrid>
      ) : (
        <>
          {cards.length ? (
            <CardRail width={300} gutter={gutter}>
              {cards}
            </CardRail>
          ) : null}
          {building.length ? (
            <View style={styles.group}>
              <Caption tone="muted" role="heading" style={styles.label}>
                STILL BUILDING
              </Caption>
              {building.map((m) => (
                <BuildingMenu key={m.id} menu={m} ready={ready(m)} onPickNight={() => setPicking(m)} />
              ))}
            </View>
          ) : null}
        </>
      )}
      {past.length ? (
        <View style={styles.group}>
          <View style={[styles.head, wide && styles.headLeft]}>
            <Headline role="heading">Past nights</Headline>
            {past.length > PAST_SHOWN ? <TextLink label={`All ${past.length}`} onPress={() => router.push('/menus/all')} /> : null}
          </View>
          {wide ? (
            <View role="list" style={styles.pastRow}>
              {past.slice(0, 6).map((m) => (
                <View role="listitem" key={m.id}>
                  <PastNight menu={m} />
                </View>
              ))}
            </View>
          ) : (
            <CardRail width={132} gutter={gutter}>
              {past.slice(0, PAST_SHOWN).map((m) => (
                <PastNight key={m.id} menu={m} />
              ))}
            </CardRail>
          )}
        </View>
      ) : null}
      {creating ? <NewMenuSheet visible onClose={() => setCreating(false)} menus={mine} now={now} /> : null}
      {picking ? <HomeNightSheet menu={picking} onClose={() => setPicking(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  headLeft: { justifyContent: 'flex-start', gap: space.lg },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  group: { gap: space.sm + 2 },
  label: { letterSpacing: 1.2 },
  pastRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
