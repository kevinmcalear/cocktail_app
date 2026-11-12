import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthMessage } from '@/components/auth/AuthShell';
import { BackbarTheme, Body, Button, Head, useDs, useGutter } from '@/components/ds';
import { DrinkDrawing } from '@/components/ds/DrinkDrawing';
import { DrawingTrio } from '@/components/ds/DrawingTrio';
import { TintSky } from '@/components/ds/TintSky';
import { WELCOME_HERO, WELCOME_SKY } from '@/constants/firstRun';
import { space } from '@/constants/tokens';
import { readClipboard } from '@/lib/clipboardPeek';
import { readSketchInputs, type SketchInputs } from '@/lib/sketch/types';
import { staffLinkHref } from '@/lib/staffDoor';

/** The three drinks over Welcome, from the catalog's drawing inputs carried in constants/firstRun. */
export const HERO = WELCOME_HERO.flatMap(({ seed, raw }) => {
  const inputs = readSketchInputs(raw);
  return inputs ? [{ seed, inputs }] : [];
});
const BY_SEED = new Map<string, SketchInputs>(HERO.map((h) => [h.seed, h.inputs]));

/** The board's places: the Martini 230 in the middle, higher and in front; the other two 170, 80 lower, bleeding off the sides. */
const TRIO = { x: [0, 122, 292], y: [80, 0, 80], s: [170, 230, 170] } as const;

/**
 * Welcome (Prod-first 1): what a signed-out person meets first. Three drinks
 * under their sky, "Every drink, and who made it.", then Continue with email
 * (the email step) or I have a link from my bar, which opens a copied staff
 * link (the same reading as the places menu's "Join a bar with a link") and
 * otherwise says where the link is.
 */
export function Welcome({ onEmail }: { onEmail: () => void }) {
  return (
    <BackbarTheme>
      <Frame onEmail={onEmail} />
    </BackbarTheme>
  );
}

function Frame({ onEmail }: { onEmail: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const [linkHelp, setLinkHelp] = useState(false);
  const [reading, setReading] = useState(false);

  const barLink = async () => {
    if (reading) return;
    setReading(true);
    // Read on the tap: iOS and the browser may ask first.
    const clip = await readClipboard();
    setReading(false);
    const href = staffLinkHref(clip ?? '');
    if (href) router.push(href as never);
    else setLinkHelp(true);
  };

  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <TintSky tints={WELCOME_SKY} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter, paddingTop: insets.top, paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.column}>
          <View style={styles.hero}>
            <DrawingTrio ids={HERO.map((h) => h.seed)} layout={TRIO} draw={(id, size) => <DrinkDrawing inputs={BY_SEED.get(id)!} seed={id} size={size} />} />
          </View>
          <View style={styles.head}>
            <Head align="center" aria-level={1}>
              Every drink, and who made it.
            </Head>
            <Body tone="muted" align="center" style={styles.sub}>
              Find the best drinks near you, keep the ones you love, and make them at home.
            </Body>
          </View>
          <View style={styles.spacer} />
          {linkHelp ? (
            <AuthMessage tone="info">Open the link your bar sent you, in its email or message, on this device. Or copy the link and tap again.</AuthMessage>
          ) : null}
          <View style={styles.buttons}>
            <Button label="Continue with email" icon="envelope" variant="ink" size="lg" onPress={onEmail} />
            <Button label="I have a link from my bar" variant="plain" onPress={() => void barLink()} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  column: { flex: 1, width: '100%', maxWidth: 420, alignSelf: 'center' },
  // The board's hero block: 330 tall, the trio 40 from its top, bleeding past the screen's sides.
  hero: { height: 330, paddingTop: 40, alignItems: 'center', overflow: 'visible' },
  head: { gap: space.md, alignItems: 'center' },
  sub: { maxWidth: 320 },
  // The board's 150 between the words and the buttons (H - 104 - 330 - 260), not pinned to the bottom.
  spacer: { height: 150 },
  buttons: { gap: space.sm, marginTop: space.md },
});
