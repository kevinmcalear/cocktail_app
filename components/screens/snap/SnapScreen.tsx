import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, DsText, GlassButton, GlassSurface, PressableScale, useDs } from '@/components/ds';
import { useAddActions } from '@/components/nav/useAddActions';
import { font, layout, radius, space, STATUS, type } from '@/constants/tokens';
import { useDictation } from '@/hooks/useDictation';

import type { CameraState, LiveCameraHandle } from './cameraTypes';
import { LiveCamera } from './LiveCamera';

const OFF = Platform.OS === 'web' ? 'The camera is blocked for this site. Allow it from the address bar, or choose a photo.' : 'Camera access is off. Turn it on in Settings, or choose a photo.';

/**
 * Snap (Prod-add-flow, step 1): the live camera, dark in either theme, with
 * Paste and Say it either side of the shutter. A photo goes to Bring in,
 * which reads it and shows what's ready and what needs a look (step 2). A
 * pasted picture or text, or what's said, goes the same way Add sends it.
 */
export function SnapScreen() {
  return (
    <BackbarTheme scheme="dark">
      <Snap />
    </BackbarTheme>
  );
}

function Snap() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const add = useAddActions(() => {}, { replace: true });
  const camera = useRef<LiveCameraHandle>(null);
  const [state, setState] = useState<CameraState>('starting');
  const [canTorch, setCanTorch] = useState(false);
  const [torch, setTorch] = useState(false);
  const [taking, setTaking] = useState(false);
  const [missed, setMissed] = useState(false);
  const [heard, setHeard] = useState('');
  const voice = useDictation((text, final) => {
    setHeard(text);
    if (final && text.trim()) add.submit(text);
  });

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const shoot = async () => {
    if (taking || state !== 'live') return;
    setTaking(true);
    setMissed(false);
    try {
      const file = await camera.current?.snap();
      if (file) await add.photo(file);
      else setMissed(true);
    } catch {
      setMissed(true);
    } finally {
      setTaking(false);
    }
  };
  const say = () => {
    if (voice.listening) return voice.stop();
    setHeard('');
    void voice.start();
  };

  const error = voice.error ?? add.error ?? (missed ? 'Couldn’t take the photo. Try again.' : null);
  const caption = voice.listening ? heard || 'Listening…' : error ?? (taking ? 'Keep still' : state === 'live' ? 'Point at a menu, a bottle or a recipe' : state === 'starting' ? 'Opening the camera' : null);
  const android = Platform.OS === 'android';

  return (
    <View style={[styles.root, { backgroundColor: ds.c.ground, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
      <StatusBar style="light" />
      <View style={styles.column}>
        <View style={styles.top}>
          <GlassButton icon={android ? 'arrow.left' : 'xmark'} accessibilityLabel={android ? 'Back' : 'Close'} onPress={close} />
          <DsText role="heading" style={styles.title}>
            Add
          </DsText>
          <View style={styles.side}>
            <GlassButton icon="photo" accessibilityLabel="Choose a photo" onPress={add.choose} />
            {canTorch ? <GlassButton icon={torch ? 'bolt.fill' : 'bolt'} accessibilityLabel={torch ? 'Turn the flash off' : 'Turn the flash on'} onPress={() => setTorch((on) => !on)} /> : null}
          </View>
        </View>

        <View style={[styles.finder, { backgroundColor: ds.c.surface }]}>
          <LiveCamera
            ref={camera}
            torch={torch}
            onState={(next, torchable) => {
              setState(next);
              setCanTorch(torchable);
            }}
          />
          {state === 'off' || state === 'failed' ? (
            <View style={styles.off}>
              <Body style={styles.center}>{state === 'off' ? OFF : 'Couldn’t open the camera. Choose a photo instead.'}</Body>
              {state === 'off' && Platform.OS !== 'web' ? <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} /> : null}
              <Button label="Choose a photo" icon="photo" variant="ink" onPress={add.choose} />
            </View>
          ) : null}
          {caption ? (
            <GlassSurface style={styles.caption}>
              <View style={styles.captionRow} aria-live="polite">
                {state === 'live' && !error ? <View style={[styles.dot, { backgroundColor: STATUS.success }]} /> : null}
                <DsText variant="caption" numberOfLines={2} style={{ ...font.semiBold }}>
                  {caption}
                </DsText>
              </View>
            </GlassSurface>
          ) : null}
        </View>

        <View style={styles.shutterRow}>
          <GlassButton icon="doc.on.clipboard" size={56} accessibilityLabel="Paste" onPress={() => void add.paste()} />
          <PressableScale
            accessibilityLabel="Take the photo"
            aria-disabled={state !== 'live' || taking}
            disabled={state !== 'live' || taking}
            onPress={() => void shoot()}
            style={[styles.shutter, { borderColor: ds.c.ink, opacity: state === 'live' ? 1 : 0.4 }]}
          >
            <View style={[styles.shutterDisc, { backgroundColor: ds.c.ink }]} />
          </PressableScale>
          {voice.available ? <GlassButton icon="mic" size={56} accessibilityLabel={voice.listening ? 'Stop listening' : 'Say it'} onPress={say} /> : <View style={styles.roundSpace} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  // Phone width on a desktop window: the viewfinder stays a viewfinder, not a wall.
  column: { flex: 1, width: '100%', maxWidth: 560, paddingHorizontal: space.xs },
  top: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  title: { position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', ...type.body, ...font.semiBold },
  side: { flexDirection: 'row', gap: space.sm },
  finder: { flex: 1, borderRadius: radius.card + space.sm, overflow: 'hidden', marginTop: space.sm },
  off: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  center: { textAlign: 'center' },
  caption: { position: 'absolute', bottom: space.lg, alignSelf: 'center', maxWidth: '90%', borderRadius: radius.pill, paddingVertical: space.sm + 2, paddingHorizontal: space.md + 2 },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: space.sm, height: space.sm, borderRadius: radius.pill },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg + 2, paddingTop: space.xl - 2, minHeight: layout.minTapTarget },
  shutter: { width: 78, height: 78, borderRadius: radius.pill, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterDisc: { width: 62, height: 62, borderRadius: radius.pill },
  roundSpace: { width: 56 },
});
