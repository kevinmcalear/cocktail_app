import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, Surface, useBreakpoint, useDs, useToast } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { MakerBottle } from '@/hooks/useMakers';
import type { MakerBottlePhoto } from '@/hooks/useMakerPhotos';
import type { usePhotoFolder } from '@/hooks/usePhotoFolder';
import { useWebImageDrop } from '@/hooks/useWebImageDrop';
import { traySummary } from '@/lib/folderMatch';
import { photosFromFiles, pickPhotoFolder } from '@/lib/photoFolder';
import { cutoutAvailable } from '@/modules/subject-cutout';

import { FolderTrayRow } from './FolderTrayRow';

const plural = (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`;

/**
 * The folder match tray (ppl-maker board, step 4) on Your bottles: every
 * photo with the bottle it matched, the ones to check, and the back labels
 * left out. Nothing shows until Use N photos. The web takes more files
 * dropped on it.
 */
export function FolderTray({ folder, bottles, photos, maker }: { folder: ReturnType<typeof usePhotoFolder>; bottles: readonly MakerBottle[]; photos: Record<string, MakerBottlePhoto>; maker: string }) {
  const ds = useDs();
  const toast = useToast();
  const wide = useBreakpoint() !== 'phone';
  const [error, setError] = useState<string | null>(null);
  const byId = new Map(bottles.map((b) => [b.id, b]));
  const n = folder.readyCount;
  const busy = folder.working || folder.saving;
  const summary = traySummary(folder.rows);

  const more = async () => {
    setError(null);
    await pickPhotoFolder({ folder: wide }).then(folder.add, (e: Error) => setError(e.message));
  };
  // Turned away while it reads or saves, as Add more is.
  const dropRef = useWebImageDrop(
    Platform.OS === 'web'
      ? (uris, files) => {
          uris.forEach((u) => URL.revokeObjectURL(u));
          if (!busy) void folder.add({ name: null, photos: photosFromFiles(files) });
        }
      : undefined,
  );
  const use = async () => {
    const all = await folder.use();
    if (!all) return setError('Some photos didn’t save. They’re still here to try again.');
    toast.show({ title: `${plural(n)} added` });
    folder.clear();
  };
  const cancel = () => {
    folder.clear();
  };

  const useButton = <Button label={folder.saving ? 'Saving…' : `Use ${plural(n)}`} size={wide ? 'md' : 'lg'} disabled={!n || busy} onPress={() => void use()} />;
  const progress = folder.working
    ? cutoutAvailable ? 'Reading the labels and cutting out every bottle…' : 'Reading the labels…'
    : cutoutAvailable ? 'Read every label and cut out every bottle · done' : 'Read every label · done';

  return (
    <View ref={dropRef} style={styles.tray}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Display role="heading">{wide ? 'Add a folder of photos' : plural(folder.photos.length)}</Display>
          <Caption tone="muted" role="status">{wide ? `${summary}. Nothing shows until you use them.` : summary}</Caption>
        </View>
        {wide ? (
          <View style={styles.actionsWide}>
            <Button label="Cancel" variant="secondary" disabled={folder.saving} onPress={cancel} />
            {useButton}
          </View>
        ) : null}
      </View>
      {wide ? (
        <Surface style={[styles.card, { borderColor: ds.c.line }]}>
          <IconSymbol name="folder.fill" size={22} color={ds.c.muted} />
          <View style={styles.flex}>
            <Body numberOfLines={1} style={styles.mono}>{`${folder.name ?? 'Your photos'} · ${plural(folder.photos.length)}`}</Body>
            <Caption tone="muted">{progress}</Caption>
          </View>
          <Button label="Add more" variant="ghost" size="sm" disabled={busy} onPress={() => void more()} />
        </Surface>
      ) : folder.working ? (
        <Caption tone="muted">{progress}</Caption>
      ) : null}
      {error ? <Caption tone="accent" role="alert">{error}</Caption> : null}
      <View role="list">
        {folder.rows.map((row) => (
          <FolderTrayRow
            key={row.photo.key}
            row={row}
            bottles={bottles}
            byId={byId}
            maker={maker}
            hasPhoto={row.kind === 'ready' && !!photos[row.bottleId]}
            onPick={(id) => folder.pick(row.photo.key, id)}
            onKeep={() => row.kind === 'another' && folder.keep(row.bottleId, row.photo.key)}
          />
        ))}
      </View>
      {wide ? null : (
        <View style={styles.actions}>
          {useButton}
          <Button label="Choose more photos" variant="secondary" icon="photo" disabled={busy} onPress={() => void more()} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  actionsWide: { flexDirection: 'row', gap: space.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card },
  mono: { fontFamily: fontFamilies.mono },
  actions: { gap: space.sm },
});
