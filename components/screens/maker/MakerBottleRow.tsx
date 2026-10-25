import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, IngredientThumb, PressableScale, Tag, useBreakpoint, useDs } from '@/components/ds';
import { IngredientPhoto } from '@/components/ds/IngredientDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { MakerBottle } from '@/hooks/useMakers';
import type { MakerBottlePhoto } from '@/hooks/useMakerPhotos';

const THUMB = 52;

/** How many drinks use it, in words. */
export function usesLine(n: number): string {
  return n === 0 ? 'In no drinks yet' : `In ${n} ${n === 1 ? 'drink' : 'drinks'}`;
}

/**
 * One bottle on Your bottles: its picture (the team's photo, even while it
 * waits for a check), name, kind and strength, how many drinks use it, Photo
 * / Waiting for a check / Drawing, and a way to add or change the photo.
 * Wide screens lay it out as a row of columns; phones stack the details.
 */
export function MakerBottleRow({ bottle, photo, uses, onPicture }: { bottle: MakerBottle; photo: MakerBottlePhoto | null; uses: number; onPicture: () => void }) {
  const ds = useDs();
  const wide = useBreakpoint() !== 'phone';
  const detail = [bottle.kind, bottle.abv != null ? `${bottle.abv}%` : null].filter(Boolean).join(' · ');
  const status = photo ? (photo.checked ? <Tag label="Photo" tone="accent" /> : <Tag label="Waiting for a check" tone="warning" />) : <Tag label="Drawing" tone="outline" />;
  const thumb = photo ? (
    <View aria-hidden style={[styles.thumb, { backgroundColor: ds.c.paper }]}>
      <IngredientPhoto url={photo.url} small />
    </View>
  ) : (
    <IngredientThumb id={bottle.id} name={bottle.name} size={THUMB} />
  );
  const label = photo ? `Change the photo of ${bottle.name}` : `Add a photo of ${bottle.name}`;

  if (wide) {
    return (
      <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
        {thumb}
        <View style={styles.flex}>
          <Body numberOfLines={1}>{bottle.name}</Body>
          {detail ? <Caption tone="muted" numberOfLines={1}>{detail}</Caption> : null}
        </View>
        <Caption tone="muted" style={styles.uses}>{usesLine(uses)}</Caption>
        <View style={styles.status}>{status}</View>
        <Button label={photo ? 'Change' : 'Add photo'} icon={photo ? undefined : 'camera'} variant="secondary" size="sm" accessibilityLabel={label} onPress={onPicture} />
      </View>
    );
  }
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      {thumb}
      <View style={[styles.flex, styles.stack]}>
        <Body numberOfLines={2}>{bottle.name}</Body>
        <View style={styles.meta}>
          {status}
          <Caption tone="muted" numberOfLines={1} style={styles.flex}>{usesLine(uses)}</Caption>
        </View>
      </View>
      <PressableScale role="button" accessibilityLabel={label} onPress={onPicture} style={[styles.camera, { borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="camera" size={20} color={ds.c.ink} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: space.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  uses: { width: 130 },
  status: { width: 170, alignItems: 'flex-start' },
  camera: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
