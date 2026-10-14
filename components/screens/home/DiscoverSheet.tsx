import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Segmented } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarCities } from '@/hooks/useDiscover';
import type { NearMe } from '@/hooks/useNearMe';
import type { LocationAccess } from '@/lib/deviceLocation';
import { SPIRITS, STYLES } from '@/lib/drinkStyles';
import { NOTE_KINDS, noteKind, noteWord } from '@/lib/flavor';
import type { Area } from '@/lib/nearMe';

import { AllowLocation, areaStatus, ChipRow } from './DiscoverArea';
import { DiscoverOverlay } from './DiscoverOverlay';

export { DiscoverOverlay } from './DiscoverOverlay';

const NOTES = NOTE_KINDS.map((d) => ({ id: noteKind(d), label: noteWord(d) }));
const GROUPS = [
  { title: 'Style', items: STYLES },
  { title: 'Spirit', items: SPIRITS },
  { title: 'Tastes', items: NOTES },
] as const;

export interface FiltersSheetProps {
  kinds: readonly string[];
  onChange: (kinds: string[]) => void;
  /** Bars with matching drinks, null while loading. */
  bars: number | null;
  /** Closed bars in the area, and whether they're shown. */
  closed: { count: number; shown: boolean; onShow: (on: boolean) => void };
  onClose: () => void;
}

/** Styles, spirits and tastes, several at once, and closed bars: the filters, wherever they're shown. */
export function FilterGroups({ kinds, onChange, closed }: Pick<FiltersSheetProps, 'kinds' | 'onChange' | 'closed'>) {
  const toggle = (id: string) => onChange(kinds.includes(id) ? kinds.filter((k) => k !== id) : [...kinds, id]);
  return (
    <>
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
    </>
  );
}

/** Clear, and "Show 12 bars" to close: the filters sheet's buttons, and the options sheet's. */
export function filterButtons({ onChange, closed, bars, onClose }: Omit<FiltersSheetProps, 'kinds'>) {
  return {
    action: <Button label="Clear" variant="ghost" onPress={() => (onChange([]), closed.onShow(false))} />,
    footer: <Button label={bars === null ? 'Show bars' : `Show ${bars} ${bars === 1 ? 'bar' : 'bars'}`} onPress={onClose} />,
  };
}

/** The filters on their own (wide screens, and beside the search). The list and map behind update as you tap. */
export function FiltersSheet(props: FiltersSheetProps) {
  return (
    <DiscoverOverlay label="Filters" onClose={props.onClose} {...filterButtons(props)}>
      <FilterGroups {...props} />
    </DiscoverOverlay>
  );
}

const cityKey = (c: { city: string; country_code: string }) => `${c.city}|${c.country_code}`;

export interface AreaSheetProps {
  area: Area;
  near: NearMe;
  /** Whether location is allowed: "Allow location" asks, or opens Settings once the OS won't ask. */
  access: LocationAccess | null;
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

/**
 * Where: near me, anywhere, the map's area (always offered), or a city with
 * bars. `onPicked` runs after a pick. `sideways`: the cities in one row that
 * scrolls across, so they don't push what's below off the sheet.
 */
export function WhereGroups({ area, near, access, preferNear, onArea, onNearMe, onThisArea, onPicked, sideways }: Omit<AreaSheetProps, 'onClose'> & { onPicked?: () => void; sideways?: boolean }) {
  const { data: cities } = useBarCities();
  const pinOn = (area.kind === 'point' && area.source === 'me') || (preferNear && area.kind === 'anywhere');
  const note = areaStatus(near);
  const pick = (next: Area) => {
    onArea(next);
    onPicked?.();
  };
  const cityChips = cities?.map((c) => (
    <Chip key={cityKey(c)} quiet label={c.label} selected={area.kind === 'city' && cityKey(area) === cityKey(c)} onPress={() => pick({ kind: 'city', city: c.city, country_code: c.country_code, label: c.label })} />
  ));
  return (
    <>
      <View role="radiogroup" accessibilityLabel="Where" style={styles.chips}>
        <Chip label="Near me" selected={pinOn} onPress={() => (onNearMe(), onPicked?.())} />
        <Chip label="Anywhere" selected={area.kind === 'anywhere' && !pinOn} onPress={() => pick({ kind: 'anywhere' })} />
        <Chip label="This area" selected={area.kind === 'point' && area.source === 'map'} onPress={() => (onThisArea(), onPicked?.())} />
      </View>
      <Caption tone="muted" role="status">
        {note ?? whereLine(area, pinOn)}
      </Caption>
      <AllowLocation near={near} access={access} onAsk={() => (onNearMe(), onPicked?.())} />
      {cities?.length ? (
        sideways ? (
          <ChipRow label="Cities" title="Cities">
            {cityChips}
          </ChipRow>
        ) : (
          <View style={styles.group}>
            <Caption tone="muted">Cities</Caption>
            <View role="radiogroup" accessibilityLabel="Cities" style={styles.chips}>
              {cityChips}
            </View>
          </View>
        )
      ) : null}
    </>
  );
}

/** Where on its own (wide screens): a pick closes it. */
export function AreaSheet(props: AreaSheetProps) {
  return (
    <DiscoverOverlay label="Where" onClose={props.onClose}>
      <WhereGroups {...props} onPicked={props.onClose} />
    </DiscoverOverlay>
  );
}

interface OptionsSheetProps extends FiltersSheetProps {
  where: Omit<AreaSheetProps, 'onClose'>;
  /** Phones: the list or the map. Picking one closes the sheet on it. */
  view?: { showing: 'list' | 'map'; onChange: (view: 'list' | 'map') => void };
}

const VIEWS = [
  { value: 'list', label: 'List' },
  { value: 'map', label: 'Map' },
] as const;

/**
 * The phone header's options: the list or the map, where, and the filters in
 * one sheet (Eddie, 13 Oct: "combine this area of filters and lists into an
 * options button"). Where stays open on a pick here; Show closes it.
 */
export function OptionsSheet({ where, view, ...filters }: OptionsSheetProps) {
  return (
    <DiscoverOverlay label="Options" onClose={filters.onClose} {...filterButtons(filters)}>
      {view ? (
        <Segmented variant="pill" stretch onSurface accessibilityLabel="Show the list or the map" options={VIEWS} value={view.showing} onChange={(v) => (view.onChange(v), filters.onClose())} />
      ) : null}
      <View style={styles.group}>
        <Caption tone="muted">Where</Caption>
        <WhereGroups {...where} sideways />
      </View>
      <FilterGroups {...filters} />
    </DiscoverOverlay>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
