import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, RowScore, Surface, Tag } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { DrinkScore, scoreWords, type DrinkScores } from '@/components/screens/home/DrinksAtBars';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useBestDrink, useRowScores } from '@/hooks/useBestDrink';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { byScore, drinkCount, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import type { MapPin } from '@/lib/discoverMap';
import { barSearchHref } from '@/lib/discoverMatch';
import { itemHref } from '@/lib/itemRoutes';
import { peopleCount, type Area } from '@/lib/nearMe';
import { formatScore } from '@/lib/ranking';

import { BarTopDrinks } from './BarTopDrinks';
import { DrinkHero } from './DrinkHero';

/** How many of a bar's drinks the pin card shows before "Show all". */
const PREVIEW_DRINKS = 3;

interface SelectedBarProps {
  pin: MapPin;
  drinks: DiscoverDrink[];
  scores?: DrinkScores;
  /** What was searched: the bar's page opens on it. */
  query?: string;
  /** Where Discover is looking: the drink that leads ranks in it. */
  area?: Area;
  /** Searching or filtering: the best matching drink leads, big, and the bar follows it. */
  lead?: boolean;
  /** card: floats over the wide map, with its drinks and Close. sheet: the top of the phone sheet, whose list holds the rest. */
  variant?: 'card' | 'sheet';
  onClose: () => void;
}

/**
 * A tapped pin. Searching, the drink that matched comes first (DrinkHero)
 * and the bar is where it is; otherwise the bar, its top drinks and the
 * drinks there (scored on "Best Martini"). Open bar carries the search, so
 * the bar's page opens on its matches.
 */
export function SelectedBar({ pin, drinks, scores, query = '', area, lead = false, variant = 'card', onClose }: SelectedBarProps) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const hero = lead && !pin.closed ? drinks[0] : undefined;
  const rest = hero ? drinks.slice(1) : drinks;
  const shown = all ? rest : rest.slice(0, PREVIEW_DRINKS);
  const openBar = <Button label="Open bar" variant={variant === 'sheet' || hero ? 'secondary' : 'primary'} onPress={() => router.push(barSearchHref(pin.handle || pin.id, query) as never)} />;
  const bar = (
    <View style={styles.cardRow} accessible accessibilityLabel={`${hero ? 'At ' : ''}${pin.name}, ${pin.place}. ${pin.closed ? pin.closed : pin.score !== null ? `Score ${formatScore(pin.score)}, ${peopleCount(pin.rankers)} ranked` : pin.drinks ? drinkCount(pin.drinks) : pin.matches ? drinkCount(pin.matches) : pin.rankers ? `Early: ${peopleCount(pin.rankers)} ranked` : 'Not ranked yet'}`}>
      <UserAvatar uri={pin.logo} name={pin.name} size={hero ? 40 : 48} />
      <View style={styles.flex}>
        {hero ? <Caption tone="muted">At</Caption> : null}
        <Headline numberOfLines={1}>{pin.name}</Headline>
        <Caption tone="muted" numberOfLines={1}>
          {pin.place || 'Bar'}
        </Caption>
      </View>
      {pin.closed ? (
        <Tag label={pin.closed} />
      ) : pin.score !== null ? (
        // The bar's score and how many ranked it (b02), on every layer.
        <RowScore score={pin.score} detail={pin.rankers ? `${pin.rankers} ranked` : null} />
      ) : (
        <Caption tone="muted">{pin.drinks ? drinkCount(pin.drinks) : pin.matches ? drinkCount(pin.matches) : pin.rankers ? `Early · ${peopleCount(pin.rankers)}` : 'Not ranked yet'}</Caption>
      )}
    </View>
  );

  if (variant === 'sheet') {
    return (
      <View style={styles.card}>
        <View style={styles.sheetActions}>
          <Button label="All results" icon="chevron.left" variant="ghost" onPress={onClose} />
          {openBar}
        </View>
        {hero ? <DrinkHero drink={hero} query={query} area={area} /> : null}
        {bar}
        <BarTopDrinks barId={pin.id} />
        {rest.length ? <Caption tone="muted" role="heading">{hero ? `More here for “${query.trim() || 'this'}”` : `${drinkCount(rest.length)} here`}</Caption> : null}
      </View>
    );
  }

  return (
    <Surface raised style={styles.card}>
      {hero ? <DrinkHero drink={hero} query={query} area={area} /> : null}
      {bar}
      <BarTopDrinks barId={pin.id} />
      {shown.map((d) => {
        const said = scoreWords(scores?.drinks[d.id]);
        const note = (d.why ?? d.description) || undefined;
        return (
          <DrinkRow
            key={d.id}
            name={d.name}
            itemId={d.id}
            href={itemHref('Cocktail', d.id)}
            imageUrl={d.imageUrl}
            glass={null}
            note={note}
            trailing={<DrinkScore drink={scores?.drinks[d.id]} />}
            label={said ? [d.name, said, note].filter(Boolean).join('. ') : undefined}
          />
        );
      })}
      {rest.length > shown.length ? <Button label={`Show all ${rest.length}`} variant="ghost" onPress={() => setAll(true)} /> : null}
      <View style={styles.cardActions}>
        <Button label="Close" variant="ghost" onPress={onClose} />
        {openBar}
      </View>
    </Surface>
  );
}

interface PickedBarProps {
  pin: MapPin;
  filter: DrinkFilter;
  /** On "Best Martini" / "Top rated": that drink, so the bar's ones show scored, best first, as on the map. */
  best: { id: string; name: string } | null;
  onClose: () => void;
}

/**
 * Wide screens: the tapped pin at the top of Discover's list, its matching
 * drink first, rather than a card over the map. Its drinks and scores come
 * from the same cached queries as the map's.
 */
export function PickedBar({ pin, filter, best, onClose }: PickedBarProps) {
  const atBar = useDiscoverList(filter, { barId: pin.id, enabled: !best && !pin.closed, pageSize: 100 });
  const { picked, scores } = useBestDrink(best, filter, { load: !!best, active: !!best });
  const drinks = scores ? byScore(picked.filter((d) => d.barId === pin.id), scores.drinks) : atBar.drinks;
  const browse = useRowScores(atBar.drinks, filter.area, !best);
  const lead = !!filter.search.trim() || filter.kinds.length > 0;
  return <SelectedBar pin={pin} drinks={drinks} scores={scores ?? browse} query={filter.search} area={filter.area} lead={lead} onClose={onClose} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { gap: space.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
});
