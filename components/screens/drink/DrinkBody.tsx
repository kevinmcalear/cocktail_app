import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';

import type { DrinkSections } from './DrinkSections';

/**
 * The drink page's sections on a phone, in the order the boards draw them:
 * venue mode (drink-phone-venue, -floor) puts the floor's talking points and
 * the spec first and the staff rows last; home mode (drink-phone-home,
 * -classic) leads with you and this drink, checks the spec against your shelf
 * and ends with photos.
 */
export function DrinkBody({ sections: s, home }: { sections: DrinkSections; home: boolean }) {
  return (
    <View style={styles.body}>
      {s.header}
      {s.journey}
      {s.menus}
      {s.banner}
      {s.description}
      {s.floor}
      {s.facts}
      {s.allergens}
      {s.flavor}
      {s.spec}
      {s.servedAt}
      {s.method}
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
