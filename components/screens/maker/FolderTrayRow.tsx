import { useRef, type ComponentRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PopoverMenu, useBreakpoint, useDs, usePopover, type PopoverSection } from '@/components/ds';
import { IngredientPhoto } from '@/components/ds/IngredientDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { MakerBottle } from '@/hooks/useMakers';
import type { FolderPhoto } from '@/hooks/usePhotoFolder';
import { shortName, type TrayRow } from '@/lib/folderMatch';

const THUMB = 48;

/** What a row says and does, from its place in the tray. */
function words(row: TrayRow, photo: FolderPhoto, byId: Map<string, MakerBottle>, maker: string, hasPhoto: boolean) {
  const named = (id: string) => byId.get(id)?.name ?? 'A bottle';
  if (photo.pending) return { title: photo.foundBy ? named(photo.bottleId as string) : 'Reading the label…', line: photo.foundBy ? 'Cutting out the bottle…' : null, quiet: !photo.foundBy };
  switch (row.kind) {
    case 'back':
      return { title: 'A back label', line: 'Only fronts are used', quiet: true };
    case 'another':
      return { title: `Another photo of ${shortName(named(row.bottleId), maker)}`, line: 'Pick one photo per bottle' };
    case 'which': {
      const few = photo.ask.length >= 2 && photo.ask.length <= 3 && photo.ask.length < byId.size;
      return {
        title: few ? `${photo.ask.map((id) => shortName(named(id), maker)).join(' or ')}?` : 'Which bottle is it?',
        line: photo.unclear ? 'The label is hard to read' : few ? 'The name fits more than one' : 'Pick the bottle',
        asks: true,
      };
    }
    case 'ready': {
      const how = photo.foundBy === 'label' ? 'Read from the label' : photo.foundBy === 'picked' ? 'You picked it' : 'Read from the file name';
      return { title: named(row.bottleId), line: hasPhoto ? `${how} · replaces its photo` : how };
    }
  }
}

/**
 * One photo in the folder match tray: the photo (cut out where it could be),
 * its file name, the bottle it matched or the question it asks, and Matched,
 * Pick the bottle, Use this one or Left out.
 */
export function FolderTrayRow({ row, bottles, byId, maker, hasPhoto, onPick, onKeep }: { row: TrayRow; bottles: readonly MakerBottle[]; byId: Map<string, MakerBottle>; maker: string; hasPhoto: boolean; onPick: (bottleId: string) => void; onKeep: () => void }) {
  const ds = useDs();
  const wide = useBreakpoint() !== 'phone';
  const menu = usePopover();
  const button = useRef<ComponentRef<typeof View>>(null);
  const photo = row.photo as FolderPhoto;
  const w = words(row, photo, byId, maker, hasPhoto);
  const asks = 'asks' in w && !photo.pending;

  const close = new Set(photo.ask);
  const sections: PopoverSection[] = [
    { title: close.size < bottles.length ? 'Closest' : undefined, items: photo.ask.map((id) => ({ label: byId.get(id)?.name ?? id, onPress: () => onPick(id) })) },
    ...(close.size < bottles.length ? [{ title: 'Every bottle', items: bottles.filter((b) => !close.has(b.id)).map((b) => ({ label: b.name, onPress: () => onPick(b.id) })) }] : []),
  ];

  const end = photo.pending ? (
    <ActivityIndicator />
  ) : row.kind === 'ready' ? (
    <View style={styles.matched}>
      <IconSymbol name="checkmark" size={16} color={ds.accentText} />
      <Caption color={ds.accentText}>Matched</Caption>
    </View>
  ) : row.kind === 'another' ? (
    <Button label={wide ? 'Use this one' : 'Pick one'} variant="secondary" size="sm" accessibilityLabel={`Use ${photo.fileName} for this bottle`} onPress={onKeep} />
  ) : row.kind === 'back' ? (
    <Caption tone="muted">Left out</Caption>
  ) : (
    <View ref={button} collapsable={false}>
      <Button label={wide ? 'Pick the bottle' : 'Pick'} icon="chevron.down" variant="secondary" size="sm" accessibilityLabel={`Which bottle is ${photo.fileName}?`} onPress={() => menu.open(button.current)} />
    </View>
  );

  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.thumb, { backgroundColor: photo.cut ? ds.c.paper : ds.c.raised }]} aria-hidden>
        <IngredientPhoto url={photo.cut ?? photo.uri} small />
      </View>
      {wide ? <Caption tone="muted" numberOfLines={1} style={styles.file}>{photo.fileName}</Caption> : null}
      {wide ? <IconSymbol name="arrow.right" size={16} color={ds.c.muted} /> : null}
      <View style={styles.flex}>
        <Body numberOfLines={1} color={asks ? ds.accentText : 'quiet' in w && w.quiet ? ds.c.muted : ds.c.ink}>{w.title}</Body>
        {w.line ? <Caption tone="muted" numberOfLines={1}>{w.line}</Caption> : null}
        {!wide ? <Caption tone="muted" numberOfLines={1} style={styles.mono}>{photo.fileName}</Caption> : null}
        {photo.saved === 'failed' ? <Caption tone="accent" role="alert">Couldn’t save this one. Try again.</Caption> : null}
      </View>
      {end}
      <PopoverMenu anchor={menu.anchor} label="Which bottle" sections={sections} onClose={menu.close} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
  file: { width: 250, fontFamily: fontFamilies.mono },
  mono: { fontFamily: fontFamilies.mono },
  flex: { flex: 1, minWidth: 0 },
  matched: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
