import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, Spec, Surface, Tag } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { DrinkScore, scoreWords, type DrinkScores } from '@/components/screens/home/DrinksAtBars';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { drinkCount, type DiscoverDrink } from '@/lib/discoverDrinks';
import type { MapPin } from '@/lib/discoverMap';
import { itemHref } from '@/lib/itemRoutes';
import { peopleCount } from '@/lib/nearMe';
import { formatScore } from '@/lib/ranking';

import { BarTopDrinks } from './BarTopDrinks';

/** How many of a bar's drinks the pin card shows before "Show all". */
const PREVIEW_DRINKS = 3;

export /** The bar a pin stands for, the drinks there on the drinks layers (scored on "Best Martini"), and a way in. */
function SelectedBar({ pin, drinks, scores, onClose }: { pin: MapPin; drinks: DiscoverDrink[]; scores?: DrinkScores; onClose: () => void }) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const shown = all ? drinks : drinks.slice(0, PREVIEW_DRINKS);
  return (
    <Surface raised style={styles.card}>
      <View style={styles.cardRow} accessible accessibilityLabel={`${pin.name}, ${pin.place}. ${pin.closed ? pin.closed : pin.drinks ? drinkCount(pin.drinks) : pin.score === null ? (pin.matches ? drinkCount(pin.matches) : pin.rankers ? `Early: ${peopleCount(pin.rankers)} ranked` : 'Not ranked yet') : `Score ${formatScore(pin.score)}, ${peopleCount(pin.rankers)}`}`}>
        <UserAvatar uri={pin.logo} name={pin.name} size={48} />
        <View style={styles.flex}>
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
      <BarTopDrinks barId={pin.id} />
      {shown.map((d) => {
        const said = scoreWords(scores?.drinks[d.id]);
        return (
          <DrinkRow
            key={d.id}
            name={d.name}
            itemId={d.id}
            href={itemHref('Cocktail', d.id)}
            imageUrl={d.imageUrl}
            glass={null}
            note={d.description ?? undefined}
            trailing={<DrinkScore drink={scores?.drinks[d.id]} />}
            label={said ? [d.name, said, d.description].filter(Boolean).join('. ') : undefined}
          />
        );
      })}
      {drinks.length > shown.length ? <Button label={`Show all ${drinks.length}`} variant="ghost" onPress={() => setAll(true)} /> : null}
      <View style={styles.cardActions}>
        <Button label="Close" variant="ghost" onPress={onClose} />
        <Button label="Open bar" onPress={() => router.push(`/p/${pin.handle || pin.id}`)} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { gap: space.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  score: { alignItems: 'flex-end' },
});
