import { useRouter } from 'expo-router';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DrinkImage, Headline, MatchText, RowScore, Surface } from '@/components/ds';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { radius, space } from '@/constants/tokens';
import { useBestDrink, useDrinkRank, useRowScores } from '@/hooks/useBestDrink';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { byScore, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import type { MapPin } from '@/lib/discoverMap';
import { barSearchHref, searchTitle } from '@/lib/discoverMatch';
import { itemHref } from '@/lib/itemRoutes';
import { areaLabel } from '@/lib/nearMe';

import { MapLayers, type MapLayer } from './DiscoverControls';
import { BarAway, DrinkAtBarList, type MoreDrinks } from './DrinksAtBars';
import { ClassicLine, resultsCaption, ResultsHead } from './ResultsHead';

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
  const top = useBestDrink(drink, filter, { load: best, active: best });
  const near = useDiscoverList(filter, { from, enabled: nearest });
  const drinks = top.scores ? byScore(top.picked, top.scores.drinks) : nearest ? near.drinks : results.drinks;
  const browse = useRowScores(drinks, filter.area, !top.scores);
  const scores = top.scores ?? browse;
  const more = best ? undefined : nearest ? { total: near.totals?.drinks ?? null, hasMore: near.hasMore, loadMore: near.loadMore, loading: near.isLoadingMore } : results.more;
  const loading = best ? top.isLoading : nearest ? near.isLoading : results.isLoading;
  const where = areaLabel(filter.area);
  const atPicked = picked ? drinks.filter((d) => d.barId === picked.id) : [];
  const rest = atPicked.length ? drinks.filter((d) => d !== atPicked[0]) : drinks;
  return (
    <View style={styles.pane}>
      <ResultsHead
        caption={resultsCaption(true, results.totals, where, 0)}
        title={searchTitle(filter.search)}
        chips={<MapLayers layer={nearest ? 'nearest' : best ? 'best' : 'drinks'} onLayer={onLayer} drinkName={drink?.name ?? null} searching nearest={!!from} />}
        below={<ClassicLine drinks={results.drinks} search={filter.search} where={where} />}
      />
      {picked && atPicked[0] ? <PickedRow drink={atPicked[0]} also={atPicked.slice(1)} pin={picked} filter={filter} score={scores.drinks[atPicked[0].id]} /> : null}
      {loading ? <ListNote>Loading…</ListNote> : rest.length ? <DrinkAtBarList key={layer} drinks={rest} limit={20} scores={scores} more={more} /> : <ListNote>{`Nothing ${where} matches. Try Everywhere.`}</ListNote>}
    </View>
  );
}

/**
 * The picked bar's best match, opened in place as a compact row: its
 * picture, name and score, where it ranks, the menu and description, the
 * bar and its other matches, then Open drink and the bar.
 */
function PickedRow({ drink, also, pin, filter, score }: { drink: DiscoverDrink; also: DiscoverDrink[]; pin: MapPin; filter: DrinkFilter; score?: number }) {
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
            <Headline numberOfLines={1} style={styles.flex}>
              <MatchText text={drink.name} query={filter.search} look="tint" />
            </Headline>
            <RowScore score={rank.score ?? score} />
          </View>
          {rank.caption ? <Caption tone="muted">{rank.caption}</Caption> : null}
          {menu || drink.description ? (
            <Caption tone="muted" numberOfLines={2}>
              {[menu, drink.why ?? drink.description].filter(Boolean).join(' · ')}
            </Caption>
          ) : null}
          <Caption numberOfLines={1}>{at}</Caption>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="Open drink" onPress={() => router.push(itemHref('Cocktail', drink.id) as never)} />
        <Button label={pin.name} variant="secondary" onPress={() => router.push(barSearchHref(pin.handle || pin.id, filter.search) as never)} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  pane: { gap: space.lg },
  picked: { gap: space.md, padding: space.lg, borderRadius: radius.card },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  thumb: { width: 72, height: 72 },
  flex: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
