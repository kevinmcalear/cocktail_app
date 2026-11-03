import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { TonightHead } from '@/components/screens/tonight/TonightParts';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useOpenBeside } from '@/hooks/useDrinksSplit';
import { useVenueMenus } from '@/hooks/useMenus';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { heroPicture } from '@/lib/itemImages';
import { fallbackGlass, itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { venueContextIds } from '@/lib/barContextFilter';
import { itemIdOf } from '@/lib/libraryFilters';
import { groupMenus, menuDateLine } from '@/lib/menus';

/**
 * Drinks' right side on a desktop while no drink is picked: the menu on now
 * (its name, since when, its drinks as rows), so the page is never a blank
 * "Pick a drink". With no menu on, one line says to pick from the list.
 */
export function OnNowPane() {
  const { active, isLoading } = useActiveVenue();
  const activeId = active?.id ?? null;
  const contextIds = useMemo(() => venueContextIds(activeId, isLoading), [activeId, isLoading]);
  const { items } = useSearchCatalog(contextIds, { ingredients: false });
  const { data: menus } = useVenueMenus(activeId);
  const beside = useOpenBeside();
  const [now] = useState(() => Date.now());
  const here = useMemo(() => (menus ?? []).filter((m) => m.barId === activeId), [menus, activeId]);
  // The same menu the list's card names.
  const current = groupMenus(here, now).on[0];
  const on = current;
  const ids = new Set(current?.itemIds ?? []);
  const rows = items.filter((i) => !i.isDraft && ids.has(itemIdOf(i.id))).sort((a, b) => a.name.localeCompare(b.name));
  if (!on || !current) {
    return (
      <Body tone="muted" style={styles.empty}>
        Pick a drink from the list to see it here.
      </Body>
    );
  }
  const since = menuDateLine(current, now, undefined, true);
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <TonightHead eyebrow={['On now', since].filter(Boolean).join(' · ')} title={on.name.replace(/ menu$/i, '')} />
      <View style={styles.rows}>
        {rows.map((i) => (
          <DrinkRow
            key={i.id}
            name={i.name}
            imageUrl={heroPicture(i.item_images ?? [])?.url ?? null}
            glass={fallbackGlass(i.category as ItemCategory)}
            itemId={i.id}
            onPress={() => beside.open(itemHref(i.category as ItemCategory, i.id))}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xxl, gap: space.lg, maxWidth: layout.page.text },
  rows: { gap: space.xs },
  empty: { padding: space.xxl },
});
