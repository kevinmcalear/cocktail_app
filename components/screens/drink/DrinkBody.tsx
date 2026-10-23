import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';

import type { DrinkSections } from './DrinkSections';

/**
 * The drink page's sections on a phone, in two parts (13 Oct, with Eddie at
 * Caretaker's Cottage): first, just enough to make the drink, then "More
 * about this drink" for everything else. The name, credit and spec (with
 * method, glass, ice and garnish) sit close together, so on a 390 x 844 phone
 * a four to six line spec fits on the first screen with the picture. A short
 * description follows the spec; at home the journey strip (I made it) does
 * too, and on a venue's team the floor's talking points, since below
 * Bartender they stand in for the spec.
 */
export function DrinkBody({ sections: s, home }: { sections: DrinkSections; home: boolean }) {
  return (
    <View style={styles.body}>
      <View style={styles.make}>
        {s.header}
        {s.spec}
      </View>
      {s.intro}
      {s.journey}
      {s.myNote}
      {s.floor}
      {s.moreHeading}
      {s.standing}
      {s.banner}
      {s.description}
      {s.facts}
      {s.allergens}
      {s.flavor}
      {s.servedAt}
      {s.menus}
      {home ? null : s.photos}
      {s.service}
      {s.history}
      {s.cost}
      {s.backstory}
      {home ? s.photos : null}
      {s.publish}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
  make: { gap: space.md },
});
