import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, GlassButton, PressableScale, Title, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useZonePhoto } from '@/hooks/useZonePhoto';
import { formatPar } from '@/lib/backBar';
import type { BarZone, BarZoneKind, ItemLocation } from '@/types/backBar';

import { selectedProps } from './BackBarPlan';
import { LocationEditor } from './LocationEditor';

/** "Add a photo of this fridge": what each kind of zone is called in a sentence. */
const KIND_NOUN: Partial<Record<BarZoneKind, string>> = {
  shelf: 'shelf', fridge: 'fridge', freezer: 'freezer', speed_rail: 'rail', well: 'well', garnish: 'tray', glass_rack: 'rack', sink: 'sink', bar_top: 'bar top', storeroom: 'storeroom',
};

/** Items grouped by shelf, in the order the shelves first appear ("Top", "Middle", "Bottom"). */
function shelves(contents: ItemLocation[]): { shelf: string; items: ItemLocation[] }[] {
  const out: { shelf: string; items: ItemLocation[] }[] = [];
  for (const loc of contents) {
    const shelf = loc.shelf?.trim() ?? '';
    const group = out.find((g) => g.shelf.toLowerCase() === shelf.toLowerCase());
    if (group) group.items.push(loc);
    else out.push({ shelf, items: [loc] });
  }
  return out;
}

/** "Under the back bar, second from the left. 4 °C. 5 items." */
export function zoneLine(description: string | null | undefined, count: number): string {
  const items = `${count} ${count === 1 ? 'item' : 'items'}.`;
  const d = description?.trim();
  if (!d) return items;
  return `${d}${/[.!?]$/.test(d) ? '' : '.'} ${items}`;
}

interface ZoneInspectorProps {
  barId: string;
  zone: BarZone;
  contents: ItemLocation[];
  /** Set for people who can place and move items. */
  canPlace: boolean;
  openLocationId: string | null;
  onOpenLocation: (id: string | null) => void;
  /** Starts "tap a zone to move it there" for a location. */
  onMove: (location: ItemLocation) => void;
  /** Someone who can draw the plan can photograph the zone. */
  canPhoto?: boolean;
}

/** The selected zone: its photo, where it is, and what lives in it, shelf by shelf. */
export function ZoneInspector({ barId, zone, contents, canPlace, openLocationId, onOpenLocation, onMove, canPhoto }: ZoneInspectorProps) {
  const ds = useDs();
  const photo = useZonePhoto(barId);
  return (
    <View style={styles.wrap}>
      <View style={[styles.photo, { backgroundColor: ds.c.paper }]}>
        {zone.photo_url ? (
          <Image source={{ uri: zone.photo_url }} style={styles.photoImage} contentFit="cover" accessibilityLabel={`Photo of ${zone.name}`} />
        ) : (
          // A pencil outline of the zone, a line per shelf, until it has a photo.
          <View role="img" aria-label={`Drawing of ${zone.name}`} style={[styles.sketch, { borderColor: ds.c.sketchInk }]}>
            {Array.from({ length: Math.max(1, shelves(contents).filter((g) => g.shelf).length - 1) }, (_, i) => (
              <View key={i} style={[styles.sketchShelf, { backgroundColor: ds.c.sketchInk }]} />
            ))}
          </View>
        )}
        {canPhoto ? (
          <View style={styles.photoButton}>
            <GlassButton
              icon="camera"
              label={photo.isPending ? 'Uploading…' : `${zone.photo_url ? 'Change the photo' : 'Add a photo'} of this ${KIND_NOUN[zone.kind] ?? 'spot'}`}
              accessibilityLabel={`${zone.photo_url ? 'Change the photo' : 'Add a photo'} of ${zone.name}`}
              onPress={() => photo.mutate(zone.id)}
              onMedia
            />
          </View>
        ) : null}
      </View>
      {photo.error ? (
        <Caption tone="accent" role="alert">
          {photo.error.message}
        </Caption>
      ) : null}
      <View style={styles.head}>
        <Title>{zone.name}</Title>
        <Body tone="muted">{zoneLine(zone.description, contents.length)}</Body>
      </View>
      {contents.length === 0 ? (
        <Body tone="muted">Nothing lives here yet.{canPlace ? ' Pick something waiting for a spot, then tap this zone.' : ''}</Body>
      ) : (
        shelves(contents).map((group) => (
          <View key={group.shelf || 'none'} style={styles.group}>
            {group.shelf ? (
              <Caption tone="muted" role="heading" style={styles.shelf}>
                {group.shelf.toUpperCase()}
              </Caption>
            ) : null}
            <View role="list" aria-label={group.shelf ? `${group.shelf} shelf` : `In ${zone.name}`}>
              {group.items.map((loc) => {
                const open = openLocationId === loc.id;
                const par = formatPar(loc.par_amount, loc.par_unit);
                const name = loc.item?.name ?? 'An item you can’t see';
                const row = (
                  <View style={styles.rowInner}>
                    <View style={styles.rowText}>
                      <Body>{name}</Body>
                      {loc.container ? <Caption tone="muted">{loc.container}</Caption> : null}
                    </View>
                    {par ? <Caption tone="muted">Par {par}</Caption> : null}
                  </View>
                );
                return (
                  <View key={loc.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
                    {canPlace ? (
                      <PressableScale
                        onPress={() => onOpenLocation(open ? null : loc.id)}
                        accessibilityLabel={`${name}${loc.shelf ? `, ${loc.shelf}` : ''}`}
                        accessibilityHint={open ? 'Closes its details' : 'Edit its shelf, container and par, or move it'}
                        aria-expanded={open}
                        {...selectedProps(open)}
                      >
                        {row}
                      </PressableScale>
                    ) : (
                      row
                    )}
                    {open ? <LocationEditor barId={barId} location={loc} onMove={() => onMove(loc)} onDone={() => onOpenLocation(null)} /> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}
      {canPlace && contents.length ? <Caption tone="muted">Tap an item to change its shelf, container or par, or to move it.</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  photoButton: { position: 'absolute', right: space.sm, bottom: space.sm },
  photo: { height: 160, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoImage: { width: '100%', height: '100%' },
  head: { gap: space.xs },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm },
  rowInner: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: layout.minTapTarget },
  shelf: { fontFamily: fontFamilies.mono, letterSpacing: 0.8 },
  group: { gap: space.xs },
  sketch: { width: '46%', height: '80%', borderWidth: 1.5, borderRadius: radius.mark, justifyContent: 'space-evenly' },
  sketchShelf: { height: 1.5, marginHorizontal: space.xs },
  rowText: { flex: 1, gap: 2 },
});
