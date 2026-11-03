import * as Burnt from 'burnt';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { PixelRatio, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Button, GlassButton, Headline, PencilState, Segmented, useDs, useGutter } from '@/components/ds';
import { PaperPage } from '@/components/paper/PaperPage';
import { layout, radius, space } from '@/constants/tokens';
import { showMessage } from '@/lib/dialogs';
import { POSTER_PIXELS, type PosterSize } from '@/lib/paper/page';
import { preparePicture, sendPicture } from '@/lib/paper/picture';

import { useMenuPoster, useTopThreePoster, type PosterData } from './posterData';

const SIZES = [
  { value: 'story', label: 'Story' },
  { value: 'square', label: 'Square' },
] as const;

// The page is laid out POSTER_PIXELS device pixels wide, so the picture is sharp; the web draws it larger when it takes it.
const PAGE_POINTS = Platform.OS === 'web' ? 360 : POSTER_PIXELS / PixelRatio.get();
// The top bar, the size switch and the buttons, with the gaps between them.
const CHROME = layout.minTapTarget * 3 + space.xxl * 2 + space.lg * 2;
const WIDEST = 480;

/**
 * Share as a picture (Bet-poster): a menu's drinks drawn together in its
 * bar's colour and face, or your top three of one drink, as a story or a
 * square. Save puts it in Photos (a file on the web); Share opens the share
 * sheet with it. Opened from a menu's Share and a rankings page's Share.
 */
export function PosterScreen(props: { menuId: string } | { listId: string }) {
  return <BackbarTheme>{'menuId' in props ? <MenuPoster menuId={props.menuId} /> : <TopThreePoster listId={props.listId} />}</BackbarTheme>;
}

function MenuPoster({ menuId }: { menuId: string }) {
  const [size, setSize] = useState<PosterSize>('story');
  return <PosterFrame size={size} onSize={setSize} data={useMenuPoster(menuId, size)} />;
}

function TopThreePoster({ listId }: { listId: string }) {
  const [size, setSize] = useState<PosterSize>('story');
  return <PosterFrame size={size} onSize={setSize} data={useTopThreePoster(listId, size)} />;
}

function PosterFrame({ size, onSize, data }: { size: PosterSize; onSize: (s: PosterSize) => void; data: PosterData }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const window = useWindowDimensions();
  const page = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [painted, setPainted] = useState(false);
  // The stage's real height: on iOS the poster opens as a page sheet, shorter than the window, so the window's height overflows it.
  const [stageH, setStageH] = useState<number | null>(null);

  // Any change to what's drawn draws the picture ahead again (the web; phones take it on the tap).
  const stamp = data.page ? JSON.stringify(data.page) : '';
  useEffect(() => {
    if (stamp && data.ready && painted && page.current) preparePicture(page.current);
  }, [stamp, data.ready, painted]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const send = async (action: 'save' | 'share') => {
    if (!page.current || !data.page) return;
    setBusy(action);
    try {
      const result = await sendPicture(page.current, action, data.title);
      if (result === 'saved') Burnt.toast({ title: Platform.OS === 'web' ? 'Saved' : 'Saved to Photos', preset: 'done', duration: 2 });
    } catch {
      showMessage('Couldn’t make the picture', 'Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  const roomW = Math.min(window.width - 2 * gutter, WIDEST);
  const roomH = Math.max(160, stageH ?? window.height - insets.top - insets.bottom - CHROME);
  let body;
  if (data.failed) body = <PencilState kind="error" title="Couldn’t draw the poster" detail="Check your connection and try again." action={{ label: 'Try again', onPress: data.retry }} />;
  else if (data.empty) body = <PencilState kind="empty" title={data.empty} />;
  else if (!data.page) body = <PencilState kind="loading" title="Drawing the poster…" />;
  else {
    const unit = PAGE_POINTS / data.page.w;
    const scale = Math.min(roomW / PAGE_POINTS, roomH / (data.page.h * unit));
    body = (
      <View style={[styles.preview, { width: PAGE_POINTS * scale, height: data.page.h * unit * scale }]}>
        <View style={{ transform: [{ scale }], transformOrigin: 'left top' }}>
          <PaperPage ref={page} page={data.page} unit={unit} sketches={data.sketches} onPainted={setPainted} />
        </View>
      </View>
    );
  }

  const off = !data.ready || !painted || !!busy;
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg }]}>
      <View style={[styles.bar, { paddingHorizontal: gutter }]}>
        <GlassButton icon="xmark" accessibilityLabel="Close" onPress={close} />
        <Headline role="heading" style={styles.title}>
          Share
        </Headline>
        <View style={styles.balance} />
      </View>
      <View style={[styles.column, { width: roomW }]}>
        <Segmented variant="pill" stretch accessibilityLabel="Size" options={SIZES} value={size} onChange={onSize} />
        <View style={styles.stage} onLayout={(e) => setStageH(e.nativeEvent.layout.height)}>
          {body}
        </View>
        <View style={styles.actions}>
          <Button label="Save" icon="square.and.arrow.down" variant="secondary" size="lg" onPress={() => void send('save')} disabled={off} style={styles.flex} />
          <Button label="Share" icon="square.and.arrow.up" variant="ink" size="lg" onPress={() => void send('share')} disabled={off} style={styles.flex} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', gap: space.lg },
  bar: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  title: { flex: 1, textAlign: 'center' },
  balance: { width: layout.minTapTarget },
  column: { flex: 1, gap: space.lg },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  preview: { borderRadius: radius.card, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
