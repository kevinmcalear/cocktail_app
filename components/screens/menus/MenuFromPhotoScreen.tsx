import * as Device from 'expo-device';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, GlassButton, TextLink, Title, useDs, useGutter } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useSetMissingPrices } from '@/hooks/useBulk';
import { useCreateMenu, useMenuLibrary, useReadMenu, useUploadMenuCover } from '@/hooks/useMenuMutations';
import { stageBringIn } from '@/lib/bringInHandoff';
import { plainDbMessage } from '@/lib/dbError';
import { blankSection } from '@/lib/menuLayout';
import { clearMenuPhotos, peekMenuPhotos } from '@/lib/menuPhotoHandoff';
import { plural } from '@/lib/menus';
import { appendReading, applyMenuPaste, bringInText, pasteRows, placedGroups, type ParsedMenuSection } from '@/lib/paste';
import { MAX_MENU_PHOTOS, pickMenuPhotos, takeMenuPhoto, type MenuPhoto } from '@/lib/readMenu';

import { PhotoRow } from './MenuPhotoRows';
import { useMenuPhotoDrop } from './useMenuPhotoDrop';

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * What a photo of a printed menu read, before it becomes a menu: drinks in
 * their printed sections, linked to the library where they match. New ones
 * finish in Bring in and come back matched. Make the menu saves it with the
 * first page as its cover.
 */
export function MenuFromPhotoScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const [start] = useState(peekMenuPhotos);
  const [pages, setPages] = useState<MenuPhoto[]>(start?.photos ?? []);
  const [sections, setSections] = useState<ParsedMenuSection[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const read = useReadMenu();
  const cover = useUploadMenuCover();
  const setPrices = useSetMissingPrices();
  const create = useCreateMenu();
  const { data: library = [] } = useMenuLibrary(start?.barId ?? null, !!start);
  const rows = useMemo(() => pasteRows(sections, library, picks), [sections, library, picks]);
  const making = cover.isPending || setPrices.isPending || create.isPending;
  const name = start?.name || title || 'Menu from a photo';
  const drop = useRef<ComponentRef<typeof View>>(null);

  const readPages = async (photos: MenuPhoto[]) => {
    setError(null);
    try {
      const reading = await read.mutateAsync(photos);
      setSections((prev) => appendReading(prev, reading.sections));
      setTitle((prev) => prev ?? reading.title);
      return true;
    } catch (e) {
      setError(message(e, 'Couldn’t read that menu. Try a closer, flatter photo.'));
      return false;
    }
  };

  // Read the pages once (the ref keeps a dev double render from paying twice).
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !start) return;
    started.current = true;
    void readPages(start.photos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  const addPages = async (photos: MenuPhoto[]) => {
    const room = photos.slice(0, MAX_MENU_PHOTOS - pages.length);
    if (!room.length) return;
    // Only the new pages are read; what's there stays.
    if (await readPages(room)) setPages((prev) => [...prev, ...room]);
  };
  const dragging = useMenuPhotoDrop(drop, (photos) => void addPages(photos));

  const addAnother = () => {
    const library = () => pickMenuPhotos(MAX_MENU_PHOTOS - pages.length).then(addPages, (e) => setError(message(e, 'Couldn’t open your photos.')));
    if (Platform.OS === 'web' || !Device.isDevice) return void library();
    Alert.alert('Add another page', undefined, [
      { text: 'Take a photo', onPress: () => void takeMenuPhoto().then(addPages, (e) => setError(message(e, 'Couldn’t open the camera.'))) },
      { text: 'Choose from photos', onPress: () => void library() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const make = async () => {
    if (!start) return;
    setError(null);
    try {
      const adding = rows.flatMap((row) => (row.status === 'add' && row.price ? [{ id: row.drink.id, price: row.price }] : []));
      if (adding.length) await setPrices.mutateAsync(adding);
      const coverUrl = await cover.mutateAsync(pages[0].uri);
      const layout = applyMenuPaste({ name, coverUrl, coverPosition: 50, sections: [blankSection()] }, null, placedGroups(rows, false));
      const id = await create.mutateAsync({ barId: start.barId, layout, night: start.night });
      clearMenuPhotos();
      router.replace(`/menus/${id}/edit`);
    } catch (e) {
      setError(plainDbMessage(e) ?? message(e, 'Couldn’t make the menu. Try again.'));
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/menus/all'));
  if (!start) {
    return (
      <View style={[styles.screen, styles.gone, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={back} />
        <Body tone="muted">Start again from New menu, then From a photo.</Body>
      </View>
    );
  }

  const drinks = sections.reduce((n, s) => n + s.lines.length, 0);
  const missing = rows.filter((row) => row.status === 'missing').length;
  const unresolved = rows.some((row) => row.status === 'pick');
  const status = read.isPending ? 'Reading your menu…' : drinks ? `Read from your photo: ${plural(drinks, 'drink')} in ${plural(sections.length, 'section')}` : null;

  return (
    <View ref={drop} style={[styles.screen, { backgroundColor: ds.c.ground }, dragging && { borderColor: ds.accentText }, dragging && styles.dragging]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter, paddingBottom: space.xl }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={back} />
        <View style={styles.head}>
          <View style={[styles.thumb, { backgroundColor: ds.c.paper }]}>
            <Image source={{ uri: pages[0]?.uri }} contentFit="cover" style={styles.fill} accessible accessibilityLabel="Your menu photo" />
          </View>
          <View style={styles.flex}>
            <Title>{name}</Title>
            {status ? <Body tone="muted">{status}</Body> : null}
            {pages.length < MAX_MENU_PHOTOS && !read.isPending ? (
              <TextLink label="Add another page" onPress={addAnother} />
            ) : null}
          </View>
        </View>
        {error ? <Body tone="accent">{error}</Body> : null}
        {error && !drinks && !read.isPending ? <Button label="Try again" variant="secondary" onPress={() => void readPages(pages)} style={styles.link} /> : null}
        {rows.map((row, i) => (
          <View key={row.key}>
            {row.section && row.section !== rows[i - 1]?.section ? (
              <Caption tone="muted" style={styles.label}>
                {row.section.toUpperCase()}
              </Caption>
            ) : null}
            <PhotoRow
              row={row}
              onPick={(id) => setPicks((prev) => ({ ...prev, [row.key]: id }))}
              onFinish={(name, ingredients) => {
                stageBringIn(bringInText([{ name, ingredients }]));
                router.push('/bring-in' as Href);
              }}
            />
          </View>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, paddingHorizontal: gutter }]}>
        {missing ? <Caption tone="muted" align="center">{`Finish the ${plural(missing, 'new drink')} to put ${missing === 1 ? 'it' : 'them'} on the menu.`}</Caption> : null}
        <Caption tone="muted" align="center">
          Your photo becomes the menu’s cover. No photo? We use the drinks’ sketches.
        </Caption>
        <Button label={making ? 'Making the menu…' : 'Make the menu'} size="lg" onPress={make} disabled={read.isPending || making || unresolved || !drinks} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  gone: { gap: space.lg },
  dragging: { borderWidth: 2, borderStyle: 'dashed' },
  body: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.sm },
  head: { flexDirection: 'row', gap: space.md, alignItems: 'center', marginTop: space.md },
  // A slight tilt, like a menu set down on the bar.
  thumb: { width: 84, height: 110, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous', transform: [{ rotate: '-3deg' }] },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  flex: { flex: 1, gap: space.xs },
  link: { alignSelf: 'flex-start' },
  label: { letterSpacing: 0.6, marginTop: space.lg, marginBottom: space.xs },
  footer: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.sm, paddingTop: space.md },
});
