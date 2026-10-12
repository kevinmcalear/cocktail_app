import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarCities } from '@/hooks/useDiscover';
import type { NearMe } from '@/hooks/useNearMe';
import { SPIRITS, STYLES } from '@/lib/drinkStyles';
import { NOTE_KINDS, noteKind, noteWord } from '@/lib/flavor';
import type { Area } from '@/lib/nearMe';

import { areaStatus } from './DiscoverArea';
import { DiscoverOverlay } from './DiscoverOverlay';

export { DiscoverOverlay } from './DiscoverOverlay';

const NOTES = NOTE_KINDS.map((d) => ({ id: noteKind(d), label: noteWord(d) }));
const GROUPS = [
  { title: 'Style', items: STYLES },
  { title: 'Spirit', items: SPIRITS },
  { title: 'Tastes', items: NOTES },
] as const;

interface FiltersSheetProps {
  kinds: readonly string[];
  onChange: (kinds: string[]) => void;
  /** Bars with matching drinks, null while loading. */
  bars: number | null;
  /** Closed bars in the area, and whether they're shown. */
  closed: { count: number; shown: boolean; onShow: (on: boolean) => void };
  onClose: () => void;
}

/** Styles, spirits and tastes, several at once, and closed bars. The list and map behind update as you tap. */
export function FiltersSheet({ kinds, onChange, bars, closed, onClose }: FiltersSheetProps) {
  const toggle = (id: string) => onChange(kinds.includes(id) ? kinds.filter((k) => k !== id) : [...kinds, id]);
  return (
    <DiscoverOverlay
      label="Filters"
      onClose={onClose}
      action={<Button label="Clear" variant="ghost" onPress={() => (onChange([]), closed.onShow(false))} />}
      footer={<Button label={bars === null ? 'Show bars' : `Show ${bars} ${bars === 1 ? 'bar' : 'bars'}`} onPress={onClose} />}
    >
      {GROUPS.map((g) => (
        <View key={g.title} style={styles.group}>
          <Caption tone="muted">{g.title}</Caption>
          <View role="group" accessibilityLabel={g.title} style={styles.chips}>
            {g.items.map((k) => (
              <Chip key={k.id} multi quiet label={k.label} selected={kinds.includes(k.id)} onPress={() => toggle(k.id)} />
            ))}
          </View>
        </View>
      ))}
      <Caption tone="muted">Drinks match any pick within a group and every group you pick from.</Caption>
      <View style={styles.group}>
        <Caption tone="muted">History</Caption>
        <View style={styles.chips}>
          <Chip multi quiet label={closed.count ? `Closed bars · ${closed.count}` : 'Closed bars'} selected={closed.shown} onPress={() => closed.onShow(!closed.shown)} />
        </View>
        <Caption tone="muted">Bars that have shut, kept for their history. Search finds them either way.</Caption>
      </View>
    </DiscoverOverlay>
  );
}

const cityKey = (c: { city: string; country_code: string }) => `${c.city}|${c.country_code}`;

interface AreaSheetProps {
  area: Area;
  near: NearMe;
  preferNear: boolean;
  onArea: (area: Area) => void;
  onNearMe: () => void;
  /** "This area": what the map shows; Discover searches it, or shows the map to move. */
  onThisArea: () => void;
  onClose: () => void;
}

/** What the Where sheet says about where Discover is looking (disc-where). */
function whereLine(area: Area, pinOn: boolean): string {
  const near = area.kind === 'point' && area.source === 'me' ? `Near you, within ${Math.round(area.radiusKm)} km.` : pinOn ? 'Near you.' : area.kind === 'city' ? `In ${area.label}.` : area.kind === 'anywhere' ? 'Anywhere.' : 'This area, as the map shows it.';
  return `${near} This area is what the map shows after you move it.`;
}

/** Where: near me, anywhere, the map's area (always offered), or a city with bars. */
export function AreaSheet({ area, near, preferNear, onArea, onNearMe, onThisArea, onClose }: AreaSheetProps) {
  const { data: cities } = useBarCities();
  const pinOn = (area.kind === 'point' && area.source === 'me') || (preferNear && area.kind === 'anywhere');
  const note = areaStatus(near);
  const pick = (next: Area) => {
    onArea(next);
    onClose();
  };
  return (
    <DiscoverOverlay label="Where" onClose={onClose}>
      <View role="radiogroup" accessibilityLabel="Where" style={styles.chips}>
        <Chip label="Near me" selected={pinOn} onPress={() => (onNearMe(), onClose())} />
        <Chip label="Anywhere" selected={area.kind === 'anywhere' && !pinOn} onPress={() => pick({ kind: 'anywhere' })} />
        <Chip label="This area" selected={area.kind === 'point' && area.source === 'map'} onPress={() => (onThisArea(), onClose())} />
      </View>
      <Caption tone="muted" role="status">
        {note ?? whereLine(area, pinOn)}
      </Caption>
      {cities?.length ? (
        <View style={styles.group}>
          <Caption tone="muted">Cities</Caption>
          <View role="radiogroup" accessibilityLabel="Cities" style={styles.chips}>
            {cities.map((c) => (
              <Chip
                key={cityKey(c)}
                quiet
                label={c.label}
                selected={area.kind === 'city' && cityKey(area) === cityKey(c)}
                onPress={() => pick({ kind: 'city', city: c.city, country_code: c.country_code, label: c.label })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </DiscoverOverlay>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
