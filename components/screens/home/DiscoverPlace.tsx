import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, GlassSurface, PopoverMenu, PressableScale, useDs, usePopover, type PopoverSection } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useBarCities } from '@/hooks/useDiscover';
import { NEAR_ME_KM, type Area } from '@/lib/nearMe';

import { areaChipLabel } from './DiscoverControls';

export interface PlaceProps {
  area: Area;
  preferNear: boolean;
  onArea: (area: Area) => void;
  onNearMe: () => void;
  /** "This area": what the map shows; Discover searches it, or shows the map to move. */
  onThisArea: () => void;
}

/** The places, in the menu's sections: near me, the map's area, anywhere, then the cities with bars. */
export function placeSections({ area, preferNear, onArea, onNearMe, onThisArea }: PlaceProps, cities: readonly { city: string; country_code: string; label: string }[]): PopoverSection[] {
  const label = areaChipLabel(area, preferNear);
  const places: PopoverSection[] = [
    {
      items: [
        { label: 'Near me', detail: `Within ${NEAR_ME_KM} km of you`, checked: label === 'Near me', onPress: onNearMe },
        { label: 'This area', detail: 'What the map shows', checked: label === 'This area', onPress: onThisArea },
        { label: 'Anywhere', checked: label === 'Anywhere', onPress: () => onArea({ kind: 'anywhere' }) },
      ],
    },
  ];
  if (!cities.length) return places;
  const items = cities.map((c) => ({
    label: c.label,
    checked: area.kind === 'city' && area.city === c.city && area.country_code === c.country_code,
    onPress: () => onArea({ kind: 'city', city: c.city, country_code: c.country_code, label: c.label }),
  }));
  return [...places, { title: 'Cities', items }];
}

/**
 * "This area ⌄" at the end of Discover's search pill (discover-options-proposal,
 * approved 24 Oct): where Discover looks, as the Search tab's place token is.
 * A tap opens the places as a menu; a pick changes the place where you are,
 * and the pill's text still opens search. `wide`: the 48 tall desktop pill.
 * `pill`: a glass pill of its own with a pin, at the top of the phone map once
 * search moved to the sheet (Q29).
 */
export function PlaceToken({ wide, pill, ...where }: PlaceProps & { wide?: boolean; pill?: boolean }) {
  const ds = useDs();
  const menu = usePopover();
  const token = useRef<ComponentRef<typeof View>>(null);
  const { data: cities } = useBarCities();
  const label = areaChipLabel(where.area, where.preferNear);
  const button = (
    <View ref={token} collapsable={false} style={styles.shrink}>
      <PressableScale role="button" aria-expanded={!!menu.anchor} accessibilityLabel={`Where: ${label}. Change`} onPress={() => menu.open(token.current)} style={[styles.token, wide ? styles.wide : null, pill ? styles.pill : null]}>
        {pill ? <IconSymbol name="location" size={16} color={ds.c.ink} /> : null}
        <DsText variant="label" numberOfLines={1} style={styles.shrink}>
          {label}
        </DsText>
        <IconSymbol name="chevron.down" size={12} color={ds.c.ink} />
      </PressableScale>
      <PopoverMenu anchor={menu.anchor} label="Where to look" onClose={menu.close} sections={placeSections(where, cities ?? [])} />
    </View>
  );
  return pill ? (
    <GlassSurface interactive style={styles.glass}>
      {button}
    </GlassSurface>
  ) : (
    button
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1, minWidth: 0 },
  token: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: layout.minTapTarget, paddingLeft: space.sm, paddingRight: space.sm + 2 },
  pill: { gap: space.xs + 2, paddingLeft: space.md, paddingRight: space.md + 2 },
  glass: { flexShrink: 1, minWidth: 0, borderRadius: radius.pill },
  wide: { minHeight: layout.minTapTarget + space.xs, paddingLeft: space.md, paddingRight: space.lg },
});
