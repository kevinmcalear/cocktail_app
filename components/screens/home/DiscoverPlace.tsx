import type { PopoverSection } from '@/components/ds';
import { NEAR_ME_KM, type Area } from '@/lib/nearMe';

/** Where Discover looks, in the places menu's words. */
export function areaChipLabel(area: Area, preferNear: boolean): string {
  if (area.kind === 'point') return area.source === 'me' ? 'Near me' : 'This area';
  if (area.kind === 'city') return area.label;
  return preferNear ? 'Near me' : 'Anywhere';
}

export interface PlaceProps {
  area: Area;
  preferNear: boolean;
  onArea: (area: Area) => void;
  onNearMe: () => void;
}

/** The places, in the menu's sections: near me, anywhere, then the cities with bars (Discover's Pick a city). */
export function placeSections({ area, preferNear, onArea, onNearMe }: PlaceProps, cities: readonly { city: string; country_code: string; label: string }[]): PopoverSection[] {
  const label = areaChipLabel(area, preferNear);
  const places: PopoverSection[] = [
    {
      items: [
        { label: 'Near me', detail: `Within ${NEAR_ME_KM} km of you`, checked: label === 'Near me', onPress: onNearMe },
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
