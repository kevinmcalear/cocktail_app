import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, PressableScale, TextLink, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, fontFamilies, layout, radius, space } from '@/constants/tokens';

import { EDITOR_STATUS, MenuCoverEdit, MenuNameInput } from './EditorParts';
import { usePourBounce } from './GuestPreview';
import type { LayoutEditor } from './useLayoutEditor';

/**
 * The top of the phone editor, on paper like the add-drink wizard's band:
 * back, where the menu stands, the way to the guest card, the menu's
 * pictures (its cover, or its drinks drawn side by side) and its name. It
 * scrolls away with the page; a paper strip stays under the status bar.
 */
export function PhoneBand({ editor }: { editor: LayoutEditor }) {
  return (
    <BackbarTheme scheme="light">
      <Band editor={editor} />
    </BackbarTheme>
  );
}

function Band({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const ink = ds.c.sketchInk;
  const count = editor.layout.sections.reduce((n, s) => n + s.drinks.length, 0);
  const bounce = usePourBounce(count);
  const status = `${EDITOR_STATUS[editor.status]} · ${editor.changed ? 'unsaved changes' : 'saved'}`;
  return (
    <View style={[styles.band, { backgroundColor: ds.c.paper, paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
      <View style={styles.controls}>
        <PressableScale onPress={editor.leave} accessibilityLabel="Back" style={[styles.back, { backgroundColor: backbar.light.glass }]}>
          <IconSymbol name="chevron.left" size={18} color={ink} />
        </PressableScale>
        <Caption color={ink} style={styles.status} numberOfLines={1}>
          {status.toUpperCase()}
        </Caption>
        <TextLink label="Guest card" onPress={() => router.push(`/menus/${editor.menu.id}/card`)} />
      </View>
      <Animated.View style={bounce}>
        <MenuCoverEdit editor={editor} height={128} />
      </Animated.View>
      <MenuNameInput editor={editor} />
    </View>
  );
}

/**
 * Paper under the status bar while the band scrolls away, so its dark icons
 * stay readable in both themes.
 */
export function PaperLip() {
  const insets = useSafeAreaInsets();
  return (
    <BackbarTheme scheme="light">
      <StatusBar style="dark" />
      <Lip height={insets.top} />
    </BackbarTheme>
  );
}

function Lip({ height }: { height: number }) {
  const ds = useDs();
  if (!height) return null;
  return <View style={[styles.lip, { height, backgroundColor: ds.c.paper }]} />;
}

const styles = StyleSheet.create({
  band: { gap: space.md, paddingBottom: space.lg, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, borderCurve: 'continuous' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  status: { flex: 1, fontFamily: fontFamilies.monoMedium, letterSpacing: 0.6 },
  lip: { position: 'absolute', top: 0, left: 0, right: 0 },
});
