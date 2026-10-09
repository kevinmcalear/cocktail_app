import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, Spec, Surface, Tag } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { DrinkScore, scoreWords, type DrinkScores } from '@/components/screens/home/DrinksAtBars';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { drinkCount, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import type { MapPin } from '@/lib/discoverMap';
import { barSearchHref } from '@/lib/discoverMatch';
import { itemHref } from '@/lib/itemRoutes';
import { peopleCount } from '@/lib/nearMe';
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
export function SelectedBar({ pin, drinks, scores, query = '', lead = false, variant = 'card', onClose }: SelectedBarProps) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const hero = lead && !pin.closed ? drinks[0] : undefined;
  const rest = hero ? drinks.slice(1) : drinks;
  const shown = all ? rest : rest.slice(0, PREVIEW_DRINKS);
  const openBar = <Button label="Open bar" variant={variant === 'sheet' || hero ? 'secondary' : 'primary'} onPress={() => router.push(barSearchHref(pin.handle || pin.id, query) as never)} />;
  const bar = (
    <View style={styles.cardRow} accessible accessibilityLabel={`${hero ? 'At ' : ''}${pin.name}, ${pin.place}. ${pin.closed ? pin.closed : pin.drinks ? drinkCount(pin.drinks) : pin.score === null ? (pin.matches ? drinkCount(pin.matches) : pin.rankers ? `Early: ${peopleCount(pin.rankers)} ranked` : 'Not ranked yet') : `Score ${formatScore(pin.score)}, ${peopleCount(pin.rankers)}`}`}>
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
      ) : pin.drinks ? (
        <Caption tone="muted">{drinkCount(pin.drinks)}</Caption>
      ) : pin.score === null ? (
        <Caption tone="muted">{pin.matches ? drinkCount(pin.matches) : pin.rankers ? `Early · ${peopleCount(pin.rankers)}` : 'Not ranked yet'}</Caption>
      ) : (
        <View style={styles.score}>
          <Spec>{formatScore(pin.score)}</Spec>
          {pin.rankers ? <Caption tone="muted">{peopleCount(pin.rankers)}</Caption> : null}
        </View>
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
        {hero ? <DrinkHero drink={hero} /> : null}
        {bar}
        <BarTopDrinks barId={pin.id} />
        {rest.length ? <Caption tone="muted" role="heading">{hero ? `More here for “${query.trim() || 'this'}”` : `${drinkCount(rest.length)} here`}</Caption> : null}
      </View>
    );
  }

  return (
    <Surface raised style={styles.card}>
      {hero ? <DrinkHero drink={hero} /> : null}
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

/**
 * Wide screens: the tapped pin at the top of Discover's list, its matching
 * drink first, rather than a card over the map.
 * ponytail: the drinks layer's matches, so "Top rated" scores don't show
 * here; lift the pane's scores if that's missed.
 */
export function PickedBar({ pin, filter, onClose }: { pin: MapPin; filter: DrinkFilter; onClose: () => void }) {
  const atBar = useDiscoverList(filter, { barId: pin.id, enabled: !pin.closed, pageSize: 100 });
  const lead = !!filter.search.trim() || filter.kinds.length > 0;
  return <SelectedBar pin={pin} drinks={atBar.drinks} query={filter.search} lead={lead} onClose={onClose} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { gap: space.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  score: { alignItems: 'flex-end' },
});
