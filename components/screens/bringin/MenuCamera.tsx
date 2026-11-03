import { StatusBar } from 'expo-status-bar';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, DsText, GlassButton, GlassSurface, PressableScale, Title, useDs } from '@/components/ds';
import { LiveCamera } from '@/components/screens/snap/LiveCamera';
import type { CameraState, LiveCameraHandle } from '@/components/screens/snap/cameraTypes';
import { font, radius, space, STATUS, type } from '@/constants/tokens';
import { menuRows, pageMarks, type MatchData } from '@/lib/bringInMatch';
import { pickReadFiles, sourcesFromFiles, type ReadFile } from '@/lib/readAnything';
import type { BringInJob } from '@/store/useBringIn';

import { PagePicture } from './PagePicture';
import { useStartBringIn } from './useStartBringIn';

const OFF = Platform.OS === 'web' ? 'The camera is blocked for this site. Allow it from the address bar, or choose a photo.' : 'Camera access is off. Turn it on in Settings, or choose a photo.';

/** How long the found drinks stay outlined before the check opens. */
const SHOW_FOUND_MS = 1200;

/** "Found 4 drinks": the menu's drinks once read. */
function foundLine(job: BringInJob, data: MatchData | null): string {
  if (job.status !== 'ready' || !job.reading || !data) return 'Reading your menu';
  const n = menuRows(job.reading, data.library, {}).length;
  return `Found ${n} ${n === 1 ? 'drink' : 'drinks'}`;
}

/**
 * Tonight's menu (board Prod-first-owner, step 3): the owner's first menu
 * opens straight into the camera, dark in either theme. A snap (or a photo
 * chosen) is read as a menu, and the drinks found are outlined on it, with
 * "Found N drinks", before the check opens. Photos, Paste and Type sit under
 * the shutter. ponytail: the outlines come from the photo's read after the
 * snap, not live in the viewfinder; live outlining needs on-device text
 * recognition, a native module this app doesn't have.
 */
export function MenuCamera(props: { barId: string | null; job: BringInJob | null; data: MatchData | null; onClose: () => void; onReady: () => void; onPaste: () => void; onType: () => void }) {
  return (
    <BackbarTheme scheme="dark">
      <Finder {...props} />
    </BackbarTheme>
  );
}

function Finder({ barId, job, data, onClose, onReady, onPaste, onType }: { barId: string | null; job: BringInJob | null; data: MatchData | null; onClose: () => void; onReady: () => void; onPaste: () => void; onType: () => void }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const start = useStartBringIn();
  const camera = useRef<LiveCameraHandle>(null);
  const [state, setState] = useState<CameraState>('starting');
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async (files: ReadFile[]) => {
    if (files.length) start(await sourcesFromFiles(files), { barId, hint: 'menu' });
  };
  const shoot = async () => {
    if (taking || state !== 'live') return;
    setTaking(true);
    setError(null);
    try {
      const file = await camera.current?.snap();
      if (file) await read([file]);
      else setError('Couldn’t take the photo. Try again.');
    } catch {
      setError('Couldn’t take the photo. Try again.');
    } finally {
      setTaking(false);
    }
  };
  const choose = async () => {
    setError(null);
    try {
      await read(await pickReadFiles());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t open your photos.');
    }
  };

  // Read and matched: the drinks stay outlined a beat, then the check.
  const ready = job?.status === 'ready' && !!job.reading && !!data;
  const moveOn = useEffectEvent(onReady);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => moveOn(), SHOW_FOUND_MS);
    return () => clearTimeout(t);
  }, [ready]);

  const file = job?.source.files[0] ?? null;
  const marks = job?.reading && data ? pageMarks(job.reading, data, 0) : [];
  const live = !job && state === 'live';
  const caption = job ? foundLine(job, data) : (error ?? (taking ? 'Keep still' : live ? 'Point at your menu' : state === 'starting' ? 'Opening the camera' : null));
  const finderWidth = Math.min(width, 560) - space.xs * 2;

  return (
    <View style={[styles.root, { backgroundColor: ds.c.ground, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
      <StatusBar style="light" />
      <View style={styles.column}>
        <View style={styles.top}>
          <GlassButton icon="xmark" accessibilityLabel="Close" onPress={onClose} />
          <DsText role="heading" style={styles.title}>
            Tonight’s menu
          </DsText>
        </View>

        <View style={[styles.finder, { backgroundColor: ds.c.surface }]}>
          {job ? (
            <View style={styles.still}>
              <PagePicture file={file} text={job.source.url ?? job.source.text} width={finderWidth - space.xl * 2} maxHeight={height * 0.5} marks={marks} />
            </View>
          ) : (
            <LiveCamera ref={camera} torch={false} onState={(next) => setState(next)} />
          )}
          {!job && (state === 'off' || state === 'failed') ? (
            <View style={styles.off}>
              <Body style={styles.center}>{state === 'off' ? OFF : 'This camera can’t open here. Choose a photo of your menu instead.'}</Body>
              {state === 'off' && Platform.OS !== 'web' ? <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} /> : null}
              <Button label="Choose a photo" icon="photo" variant="ink" onPress={() => void choose()} />
            </View>
          ) : null}
          {caption ? (
            <GlassSurface style={styles.caption}>
              <View style={styles.captionRow} aria-live="polite">
                {live || ready ? <View style={[styles.dot, { backgroundColor: STATUS.success }]} /> : null}
                <DsText variant="caption" numberOfLines={2} style={{ ...font.semiBold }}>
                  {caption}
                </DsText>
              </View>
            </GlassSurface>
          ) : null}
        </View>

        <Title style={styles.last}>Last step: your menu</Title>

        {job ? null : (
          <View style={styles.controls}>
            <PressableScale
              accessibilityLabel="Take the photo"
              aria-disabled={!live || taking}
              disabled={!live || taking}
              onPress={() => void shoot()}
              style={[styles.shutter, { borderColor: ds.c.ink, opacity: live ? 1 : 0.4 }]}
            >
              <View style={[styles.shutterDisc, { backgroundColor: ds.c.ink }]} />
            </PressableScale>
            <View style={styles.ways}>
              <GlassButton icon="photo" label="Photos" accessibilityLabel="Choose photos of your menu" onPress={() => void choose()} />
              <GlassButton icon="doc.on.clipboard" label="Paste" accessibilityLabel="Paste your menu" onPress={onPaste} />
              <GlassButton icon="pencil" label="Type" accessibilityLabel="Type your menu" onPress={onType} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  // Phone width on a desktop window: the viewfinder stays a viewfinder, not a wall.
  column: { flex: 1, width: '100%', maxWidth: 560, paddingHorizontal: space.xs },
  top: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md },
  title: { position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', ...type.body, ...font.semiBold },
  finder: { flex: 1, borderRadius: radius.card + space.sm, overflow: 'hidden', marginTop: space.sm },
  still: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  off: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  center: { textAlign: 'center' },
  caption: { position: 'absolute', bottom: space.lg, alignSelf: 'center', maxWidth: '90%', borderRadius: radius.pill, paddingVertical: space.sm + 2, paddingHorizontal: space.md + 2 },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: space.sm, height: space.sm, borderRadius: radius.pill },
  last: { textAlign: 'center', marginTop: space.lg },
  controls: { alignItems: 'center', gap: space.lg, paddingTop: space.lg },
  shutter: { width: 78, height: 78, borderRadius: radius.pill, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterDisc: { width: 62, height: 62, borderRadius: radius.pill },
  ways: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, flexWrap: 'wrap' },
});
