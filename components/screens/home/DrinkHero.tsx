import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, PressableScale, Tag, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import { itemHref } from '@/lib/itemRoutes';

import { CollectButton } from '../published/CollectButton';
import { RankFlow } from '../rank/RankActions';
import { useAgeGate } from '../safety/AgeGate';

/**
 * The drink a search found at a tapped bar, first and big: its picture,
 * name, whether it's on the menu, why it matched when the name doesn't say,
 * and the way into it, keeping it, or ranking it. The bar comes after it (SelectedBar).
 */
export function DrinkHero({ drink }: { drink: DiscoverDrink }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [ranking, setRanking] = useState(false);
  // Ranking needs a confirmed age, as on the drink page.
  const ageGate = useAgeGate();
  const picture = drink.imageUrl ? { url: drink.imageUrl, isSketch: false, isOutdated: false, credit: null, sourceUrl: null } : null;
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
      <View style={styles.actions}>
        <Button label="Open drink" onPress={open} />
        <CollectButton target={{ kind: 'drink', itemId: drink.id }} name={drink.name} quiet />
        {signedIn ? <Button label="Rank it" icon="list.number" variant="secondary" accessibilityLabel={`Rank ${drink.name} against others you've had`} onPress={() => ageGate.gate(() => setRanking(true))} /> : null}
      </View>
      {/* Its own bar comes from the drink (its signature bar), so no bar is passed. */}
      {ranking ? <RankFlow item={{ id: drink.id, name: drink.name, bar_id: null }} picture={picture} onClose={() => setRanking(false)} /> : null}
      {ageGate.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm },
  tags: { flexDirection: 'row' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.sm },
});
