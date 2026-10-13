import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextLink } from '@/components/ds';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useWeekEventDrinks } from '@/hooks/useWeek';
import { itemHref } from '@/lib/itemRoutes';
import { kindLabel, type WeekItem } from '@/lib/week';

/** Drinks shown before "See all". */
const FIRST = 2;

/**
 * "On the takeover menu · by Pale Moth" on an event's page (week-event-guest):
 * the drinks on the event's menu with their drawings, two then See all.
 * Guests see the published ones; nothing shows when there are none.
 */
export function EventDrinks({ event }: { event: WeekItem }) {
  const { data: drinks = [] } = useWeekEventDrinks(event.id, !!event.menuId);
  const [all, setAll] = useState(false);
  if (!drinks.length) return null;
  const kind = kindLabel(event).replace(', team only', '').toLowerCase();
  const title = [`On the ${kind} menu`, event.guestName ? `by ${event.guestName}` : null].filter(Boolean).join(' · ');
  return (
    <View role="region" accessibilityLabel={title} style={styles.section}>
      <Eyebrow>{title}</Eyebrow>
      <View>
        {(all ? drinks : drinks.slice(0, FIRST)).map((d) => (
          <DrinkRow key={d.id} compact name={d.name} itemId={d.id} href={itemHref('Cocktail', d.id)} imageUrl={d.imageUrl} glass={d.glassKey} caption={d.description ?? undefined} />
        ))}
      </View>
      {drinks.length > FIRST && !all ? <TextLink label={`See all ${drinks.length}`} onPress={() => setAll(true)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs, marginTop: space.lg },
});
