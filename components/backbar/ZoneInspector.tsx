import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, Title, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { formatPar } from '@/lib/backBar';
import type { BarZone, ItemLocation } from '@/types/backBar';

import { selectedProps } from './BackBarPlan';
import { LocationEditor } from './LocationEditor';

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
}

/** The selected zone: its photo, where it is, and what lives in it, shelf by shelf. */
export function ZoneInspector({ barId, zone, contents, canPlace, openLocationId, onOpenLocation, onMove }: ZoneInspectorProps) {
  const ds = useDs();
  return (
    <View style={styles.wrap}>
      {/* ponytail: shows a zone photo when one is set; taking one arrives with the photo pipeline's storage folder. */}
      <View style={[styles.photo, { backgroundColor: ds.c.paper }]}>
        {zone.photo_url ? (
          <Image source={{ uri: zone.photo_url }} style={styles.photoImage} contentFit="cover" accessibilityLabel={`Photo of ${zone.name}`} />
        ) : (
          <Caption color={ds.c.sketchInk}>No photo of {zone.name} yet</Caption>
        )}
      </View>
      <View style={styles.head}>
        <Title>{zone.name}</Title>
        {zone.description ? <Body tone="muted">{zone.description}</Body> : null}
      </View>
      {contents.length === 0 ? (
        <Body tone="muted">Nothing lives here yet.{canPlace ? ' Pick something waiting for a spot, then tap this zone.' : ''}</Body>
      ) : (
        <View role="list" aria-label={`In ${zone.name}`}>
          {contents.map((loc) => {
            const open = openLocationId === loc.id;
            const par = formatPar(loc.par_amount, loc.par_unit);
            const name = loc.item?.name ?? 'An item you can’t see';
            const row = (
              <View style={styles.rowInner}>
                <Caption color={ds.accentText} style={styles.shelf}>
                  {(loc.shelf ?? '').toUpperCase()}
                </Caption>
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  photo: { height: 160, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoImage: { width: '100%', height: '100%' },
  head: { gap: space.xs },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm },
  rowInner: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: layout.minTapTarget },
  shelf: { width: 96, fontFamily: fontFamilies.mono, letterSpacing: 0.8, paddingTop: 3 },
  rowText: { flex: 1, gap: 2 },
});
