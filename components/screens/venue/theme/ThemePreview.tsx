import { useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, BrandProvider, DsText, GlassSurface, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { backbar, DEFAULT_ACCENT, font, layout, radius, space, type BackbarScheme } from '@/constants/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { withAlpha } from '@/lib/color';

import type { BrandLook } from '../BrandPreview';
import { MINIS, type MiniKind } from './ThemeMinis';
import { ThemePage } from './ThemePages';
import { StaffTabs } from './ThemeStaffPage';

type Who = 'guest' | 'staff';
const MODES: { value: BackbarScheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const WHO: { value: Who; label: string }[] = [
  { value: 'guest', label: 'Guest' },
  { value: 'staff', label: 'Staff' },
];
/** The floating bar's height (canvas Theme-flow-6: 40 tall controls in 6 of padding). */
const BAR = 52;
/** The bar is dark glass with cream controls in either mode, so it reads over any page. */
const CREAM = backbar.light.ground;
const INK = backbar.light.ink;

interface Props {
  /** The page tapped, or null when the preview is shut. */
  page: MiniKind | null;
  look: BrandLook;
  /** Light or Dark: the Theme screen's own switch, so the two stay as one. */
  scheme: BackbarScheme;
  onScheme: (scheme: BackbarScheme) => void;
  onClose: () => void;
}

/**
 * A preview opened full size (canvas Theme-flow-6: "Tap a preview: the real
 * page, full size"): the page in the draft theme, with a floating bar for
 * Light or Dark, Guest or Staff, and Done. Staff is the staff phone, their
 * whole app in the theme. Nothing is saved here; the Theme screen's Save does
 * that. On a wide screen the page keeps a phone's width in the middle.
 */
export function ThemePreview({ page, look, scheme, onScheme, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const wide = useBreakpoint() !== 'phone';
  const [who, setWho] = useState<Who>('guest');
  const kind = who === 'staff' ? 'staff' : (page ?? 'drawn');
  const close = () => {
    setWho('guest');
    onClose();
  };
  const name = who === 'staff' ? 'The staff phone' : (MINIS.find((m) => m.kind === page)?.label ?? '');
  return (
    // Android: drawn under the status and navigation bars, so the page's own insets place it, as on iOS.
    <Modal visible={!!page} animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={close} statusBarTranslucent navigationBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      {/* The photo decides its own mode (Decided), so its page is the night page in either. */}
      <BackbarTheme scheme={kind === 'photo' ? 'dark' : scheme}>
        <BrandProvider accent={look.accent ?? DEFAULT_ACCENT} groundTint={look.groundTint} displayFace={look.displayFace}>
          <Frame wide={wide}>
            <ScrollView aria-label={`Preview: ${name} at ${look.name}, ${scheme === 'dark' ? 'Dark' : 'Light'}, as ${who === 'staff' ? 'staff' : 'a guest'} sees it`} contentContainerStyle={{ paddingBottom: insets.bottom + BAR + space.xxl }}>
              <ThemePage kind={kind} look={look} top={wide ? space.lg : insets.top} onBack={close} />
            </ScrollView>
            {kind === 'staff' ? <View style={[styles.dock, { bottom: insets.bottom + space.lg + BAR + space.md }]}><StaffTabs /></View> : null}
          </Frame>
        </BrandProvider>
      </BackbarTheme>
      <View style={[styles.dockWrap, { bottom: insets.bottom + space.lg }]} pointerEvents="box-none">
        <GlassSurface scheme="dark" style={styles.bar}>
          <Choice label="Mode" options={MODES} value={scheme} onChange={onScheme} />
          <Choice label="Seen by" options={WHO} value={who} onChange={setWho} />
          <View style={styles.flex} />
          <PressableScale role="button" accessibilityLabel="Done" onPress={close} style={styles.done}>
            <DsText variant="label" color={INK} style={styles.strong}>Done</DsText>
          </PressableScale>
        </GlassSurface>
      </View>
    </Modal>
  );
}

/** The page on its own ground; on a wide screen, a phone's width in the middle of the window. */
function Frame({ wide, children }: { wide: boolean; children: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.flex, { backgroundColor: wide ? ds.c.raised : ds.c.ground }]}>
      <View style={[styles.flex, wide && styles.column, { backgroundColor: ds.c.ground, borderColor: ds.c.line }]}>{children}</View>
    </View>
  );
}

/** A two-way switch in the dark bar: the chosen one cream, the other cream text on the glass. */
function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View role="radiogroup" aria-label={label} style={styles.track}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale key={o.value} role="radio" aria-checked={on} accessibilityLabel={o.label} hitSlop={space.xs} onPress={() => onChange(o.value)} style={[styles.choice, on && { backgroundColor: CREAM }]}>
            <DsText variant="label" color={on ? INK : CREAM} style={styles.strong}>{o.label}</DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.phoneFrame, alignSelf: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  dock: { position: 'absolute', left: space.lg, right: space.lg },
  dockWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.lg },
  bar: { width: '100%', maxWidth: layout.phoneFrame - space.xl, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.xs + 2, borderRadius: radius.pill },
  track: { flexDirection: 'row', padding: 2, borderRadius: radius.pill, backgroundColor: withAlpha(CREAM, 0.1) },
  choice: { height: 36, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.pill },
  done: { height: 40, paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: CREAM },
  strong: { ...font.semiBold },
});
