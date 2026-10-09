import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, PressableScale, Tag, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import { itemHref } from '@/lib/itemRoutes';

/**
 * The drink a search found at a tapped bar, first and big: its picture,
 * name, whether it's on the menu, why it matched when the name doesn't say,
 * and the way into it. The bar comes after it (SelectedBar).
 */
export function DrinkHero({ drink }: { drink: DiscoverDrink }) {
  const router = useRouter();
  const open = () => router.push(itemHref('Cocktail', drink.id) as never);
  const menu = drink.menu.onNow ? 'On the menu now' : drink.menu.past;
  // A description match already shows the description, around the word.
  const note = drink.match?.kind === 'description' ? null : drink.description;
  return (
    <View style={styles.hero}>
      <PressableScale role="link" accessibilityLabel={`${drink.name}, open`} onPress={open}>
        <DrinkImage source={drink.imageUrl} itemId={drink.id} glass={null} accessibilityLabel={drink.name} aspectRatio={2} thumb />
      </PressableScale>
      <Title role="heading" numberOfLines={2}>
        {drink.name}
      </Title>
      {menu ? (
        <View style={styles.tags}>
          <Tag label={menu} />
        </View>
      ) : null}
      {drink.why ? <Body>{drink.why}</Body> : null}
      {note ? (
        <Caption tone="muted" numberOfLines={2}>
          {note}
        </Caption>
      ) : null}
      <Button label="Open drink" onPress={open} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm },
  tags: { flexDirection: 'row' },
});
