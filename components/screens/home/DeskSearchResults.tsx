import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DrinkImage, DsText, MatchText, RowScore, Surface } from '@/components/ds';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { radius, space } from '@/constants/tokens';
import { useBestDrink, useDrinkRank, useRowScores } from '@/hooks/useBestDrink';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { byScore, resultsCaption, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import type { MapPin } from '@/lib/discoverMap';
import { barSearchHref, searchTitle } from '@/lib/discoverMatch';
import { itemHref } from '@/lib/itemRoutes';
import { areaLabel } from '@/lib/nearMe';

import { MapLayers, type MapLayer } from './DiscoverControls';
import { BarAway, DrinkAtBarList, type MoreDrinks } from './DrinksAtBars';
import { ClassicLine, ResultsHead } from './ResultsHead';

interface DeskSearchResultsProps {
  filter: DrinkFilter;
  /** The drink the search names, for Top rated. */
  drink: { id: string; name: string } | null;
  results: { drinks: DiscoverDrink[]; more: MoreDrinks; isLoading: boolean; totals: { drinks: number; bars: number } | null };
  /** The sort, shared with the map's pins. */
  layer: MapLayer;
  onLayer: (layer: MapLayer) => void;
  /** Where Nearest counts from; no Nearest without it. */
  from: { latitude: number; longitude: number } | null;
  /** The pin tapped on the map: its best match opens in place at the top. */
  picked: MapPin | null;
}

/**
 * Wide screens, searching (disc-desk-search): the list pane holds the ranked
 * results, as the phone sheet does: "14 drinks at 9 bars near you",
 * "Martinis and more", Best match / Top rated / Nearest, the classic line,
 * the picked bar's match opened in place, then the scored rows.
 */
export function DeskSearchResults({ filter, drink, results, layer, onLayer, from, picked }: DeskSearchResultsProps) {
  const nearest = layer === 'nearest' && !!from;
  const best = layer === 'best' && !!drink;
  const ranked = useBestDrink(drink, filter, { load: best, active: best });
  const near = useDiscoverList(filter, { from, enabled: nearest });
  const drinks = ranked.scores ? byScore(ranked.picked, ranked.scores.drinks) : nearest ? near.drinks : results.drinks;
  const browse = useRowScores(drinks, filter.area, !ranked.scores);
  const scores = ranked.scores ?? browse;
  const more = best ? undefined : nearest ? { total: near.totals?.drinks ?? null, hasMore: near.hasMore, loadMore: near.loadMore, loading: near.isLoadingMore } : results.more;
  const loading = best ? ranked.isLoading : nearest ? near.isLoading : results.isLoading;
  const where = areaLabel(filter.area);
  // The picked bar's own matches, from the server: its pin may be past the loaded page.
  const atBar = useDiscoverList(filter, { barId: picked?.id ?? null, enabled: !!picked && !picked.closed, pageSize: 100 });
  const atPicked = picked ? (best || nearest ? drinks.filter((d) => d.barId === picked.id) : atBar.drinks) : [];
  // A clicked row opens in place at the top, the map keeping its pins (disc-desk-search). A new pin replaces it.
  const [opened, setOpened] = useState<{ drink: DiscoverDrink; pin: string | null } | null>(null);
  const open = opened && opened.pin === (picked?.id ?? null) ? opened.drink : null;
  const top = open ? { drink: open, also: [] as DiscoverDrink[], bar: barOf(open) } : picked && atPicked[0] ? { drink: atPicked[0], also: atPicked.slice(1), bar: picked } : null;
  const rest = top ? drinks.filter((d) => d.id !== top.drink.id) : drinks;
  return (
    <View style={styles.pane}>
      <ResultsHead
        caption={resultsCaption(true, results.totals, where, 0, false)}
        title={searchTitle(filter.search)}
        chips={<MapLayers layer={nearest ? 'nearest' : best ? 'best' : 'drinks'} onLayer={onLayer} drinkName={drink?.name ?? null} searching nearest={!!from} />}
        below={<ClassicLine drinks={results.drinks} search={filter.search} where={where} />}
      />
      {top ? <PickedRow key={top.drink.id} drink={top.drink} also={top.also} pin={top.bar} filter={filter} score={scores.drinks[top.drink.id]} /> : null}
      {loading ? (
        <ListNote>Loading…</ListNote>
      ) : rest.length ? (
        <DrinkAtBarList key={layer} drinks={rest} limit={20} scores={scores} more={more} query={filter.search} onOpen={(d) => setOpened({ drink: d, pin: picked?.id ?? null })} />
      ) : (
        <ListNote>{`Nothing ${where} matches. Try Everywhere.`}</ListNote>
      )}
    </View>
  );
}

/**
 * The picked bar's best match, opened in place as a compact row: its
 * picture, name and score, where it ranks, the menu and description, the
 * bar and its other matches, then Open drink and the bar.
 */
type PickedBar = Pick<MapPin, 'id' | 'name' | 'handle' | 'place'>;

/** The bar a result row names, for its card. */
function barOf(d: DiscoverDrink): PickedBar {
  return { id: d.barId, name: d.bar.name, handle: d.bar.handle, place: [d.bar.locality, d.bar.city].filter(Boolean).join(', ') };
}

function PickedRow({ drink, also, pin, filter, score }: { drink: DiscoverDrink; also: DiscoverDrink[]; pin: PickedBar; filter: DrinkFilter; score?: number }) {
  const router = useRouter();
  const rank = useDrinkRank(drink, filter.search, filter.area);
  const away = useContext(BarAway)(pin.id);
  const menu = drink.menu.onNow ? 'On the menu now' : drink.menu.past;
  const at = [`At ${pin.name}`, pin.place, away, also.length ? `also ${also.length === 1 ? `a ${also[0].name}` : `${also.length} more`}` : null].filter(Boolean).join(' · ');
  return (
    <Surface raised style={styles.picked}>
      <View role="article" aria-label={`${drink.name} at ${pin.name}, picked`} style={styles.row}>
        <DrinkImage source={drink.imageUrl} itemId={drink.id} glass={null} accessibilityLabel={drink.name} radius="control" style={styles.thumb} thumb />
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            {/* The big serif title, as the board draws the opened card. */}
            <DsText variant="title" numberOfLines={2} style={styles.flex}>
              <MatchText text={drink.name} query={filter.search} look="tint" />
            </DsText>
            <RowScore score={rank.score ?? score} />
          </View>
          {rank.caption ? <Caption tone="muted">{rank.caption}</Caption> : null}
          {menu || drink.description ? (
            <Caption tone="muted" numberOfLines={2}>
              {[menu, drink.why ?? drink.description].filter(Boolean).join(' · ')}
            </Caption>
          ) : null}
          <Caption tone="muted" numberOfLines={2}>
            {at}
          </Caption>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="Open drink" style={styles.flex} onPress={() => router.push(itemHref('Cocktail', drink.id) as never)} />
        <Button label={pin.name} variant="secondary" onPress={() => router.push(barSearchHref(pin.handle || pin.id, filter.search) as never)} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  pane: { gap: space.lg },
  picked: { gap: space.md, padding: space.md, borderRadius: radius.card },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  thumb: { width: 120, height: 120 },
  flex: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
});
