import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';

import type { DrinkSections } from './DrinkSections';

/**
 * The drink page's sections on a phone, in two parts (13 Oct, with Eddie at
 * Caretaker's Cottage): first, just enough to make the drink (the name and
 * credit, the spec with method, glass, ice and garnish, the steps), then
 * "More about this drink" for everything else. At home the journey strip
 * (I made it) follows the spec; on a venue's team the floor's talking points
 * do, since below Bartender they stand in for the spec.
 */
export function DrinkBody({ sections: s, home }: { sections: DrinkSections; home: boolean }) {
  return (
    <View style={styles.body}>
      {s.header}
      {s.intro}
      {s.spec}
      {s.journey}
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
      {s.classicLink}
      {s.publish}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
});
