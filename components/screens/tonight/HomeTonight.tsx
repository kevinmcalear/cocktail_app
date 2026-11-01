import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, DrinkDrawingFor, DsText, PencilState, PressableScale, useDs, useGutter } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { WeekRibbon, weekHref } from '@/components/screens/week/WeekParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space } from '@/constants/tokens';
import { useBarDrinks } from '@/hooks/useHomeBar';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { useMenu } from '@/hooks/useMenus';
import { useMyWeek, useWeekStart } from '@/hooks/useWeek';
import { toDay } from '@/lib/collection';
import { itemHref } from '@/lib/itemRoutes';
import { plural } from '@/lib/menus';
import { bestAway, oneBottleLine, shelfTiles } from '@/lib/tonight';
import { byDay, detailLine, itemDay, shortDay, upcoming, type WeekItem } from '@/lib/week';

import { DrinkTile, NoteCard, TonightSection } from './TonightParts';

/** How many of the week's things sit under the strip. */
const WEEK_ROWS = 3;

/**
 * Tonight at home (Prod-today-home, with This week on top, Kept-events opt
 * B): the week at the bars you love, what your shelf makes, the one bottle
 * worth buying, and a new list from a bar you love. No feed of strangers.
 */
export function HomeTonight() {
  const router = useRouter();
  const drinks = useBarDrinks();
  const tiles = shelfTiles(drinks.canMake, drinks.oneAway);
  const away = bestAway(drinks.oneAway);
  const awayLine = away ? oneBottleLine(away.bottles, away.drinks) : null;
  const openShelf = () => router.push('/shelf');
  const week = useHomeWeek();
  const nothing = !drinks.isLoading && !tiles.length && !week.card && !week.rows.length;
  return (
    <View style={styles.stack}>
      <ThisWeek week={week} />
      {tiles.length ? (
        <TonightSection title="From your shelf" aside={`${drinks.canMake.length} you can make`} onAside={openShelf}>
          <Tiles>
            {tiles.map((t) => (
              <DrinkTile key={t.id} {...t} onPress={() => router.push(itemHref('Cocktail', t.id) as Href)} />
            ))}
          </Tiles>
        </TonightSection>
      ) : null}
      {away && awayLine ? (
        <TonightSection title="One bottle away">
          <NoteCard icon="place.mybar" text={awayLine} onPress={() => router.push(itemHref('Ingredient', away.bottles[0].id) as Href)} />
        </TonightSection>
      ) : null}
      {week.card ? (
        <TonightSection title="From bars you love">
          <NewListCard item={week.card} />
        </TonightSection>
      ) : null}
      {nothing ? (
        <PencilState
          kind="empty"
          title="Start with your shelf"
          detail="Add the bottles you have and Tonight shows what you can make."
          action={{ label: 'Open your shelf', onPress: openShelf }}
        />
      ) : null}
    </View>
  );
}

/** The week at the bars you love: the lead new list becomes its card, the rest are rows. */
function useHomeWeek() {
  const from = useWeekStart();
  const hydrated = useIsHydrated();
  const { data = [] } = useMyWeek();
  const next = upcoming(data, from);
  const card = next.find((i) => i.kind === 'menu' && i.menuId) ?? null;
  const rows = next.filter((i) => i !== card).slice(0, WEEK_ROWS);
  // The days come from the device's clock, which the static web build doesn't have.
  return { from, card: hydrated ? card : null, rows: hydrated ? rows : [], days: byDay(data, from), today: toDay(from) };
}

function ThisWeek({ week }: { week: ReturnType<typeof useHomeWeek> }) {
  const router = useRouter();
  if (!week.rows.length && !week.card) return null;
  return (
    <TonightSection title="This week" aside="All" onAside={() => router.push('/week')}>
      <WeekRibbon days={week.days} today={week.today} />
      <View role="list">
        {week.rows.map((item, i) => (
          <WeekRow key={`${item.kind}-${item.id}`} item={item} from={week.from} first={i === 0} />
        ))}
      </View>
    </TonightSection>
  );
}

/** A bar's mark, the thing in the display face, and when and where under it (Keep-phone tonight B). */
function WeekRow({ item, from, first }: { item: WeekItem; from: Date; first: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const sub = [item.barName, shortDay(itemDay(item), from), detailLine(item, undefined, { tickets: false })].filter(Boolean).join(' · ');
  return (
    <PressableScale role="link" accessibilityLabel={`${item.name}. ${sub}`} onPress={() => router.push(weekHref(item, false))} style={[styles.row, { borderTopColor: first ? 'transparent' : ds.c.line }]}>
      <BarMark name={item.barName ?? item.name} size={40} filled />
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {item.name}
        </DsText>
        <Caption tone="muted" numberOfLines={1}>
          {sub}
        </Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/** A new list from a bar you love, on a card with three of its drinks (Prod-today-home's Winter). */
function NewListCard({ item }: { item: WeekItem }) {
  const ds = useDs();
  const router = useRouter();
  const menu = useMenu(item.menuId).data;
  const ids = (menu?.sections ?? []).flatMap((s) => s.drinks.map((d) => d.id)).slice(0, 3);
  const eyebrow = [item.barName, `goes on ${shortDay(itemDay(item), new Date()).toLowerCase()}`].filter(Boolean).join(' · ');
  const count = item.drinkCount ?? ids.length;
  return (
    <PressableScale role="link" accessibilityLabel={`${item.name}. ${eyebrow}`} onPress={() => router.push(weekHref(item, false))} style={[styles.card, { backgroundColor: ds.c.raised }]}>
      <View style={styles.cardArt}>
        {ids.map((id) => (
          <DrinkDrawingFor key={id} itemId={id} size="row" pour={false} />
        ))}
      </View>
      <Caption tone="muted" style={styles.caps}>
        {eyebrow}
      </Caption>
      <DsText variant="title" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
        {item.name}
      </DsText>
      <Caption tone="muted" numberOfLines={2}>
        {[count ? plural(count, 'drink') : null, item.description].filter(Boolean).join(' · ')}
      </Caption>
    </PressableScale>
  );
}

/** A row of tiles that scrolls sideways to the screen's edge. */
function Tiles({ children }: { children: React.ReactNode }) {
  const gutter = useGutter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={[styles.tiles, { paddingHorizontal: gutter }]}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xl },
  tiles: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  card: { gap: space.xs, padding: space.xl, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  cardArt: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', gap: space.xs, minHeight: 72 },
});
