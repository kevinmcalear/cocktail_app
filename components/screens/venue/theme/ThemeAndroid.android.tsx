import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space, type BackbarScheme } from '@/constants/tokens';
import type { Ground } from '@/lib/palette';

import type { MiniKind } from './ThemeMinis';
import { ThemeCarousel } from './ThemeCarousel';
import { useColourPart, useLogoPart, useTypePart, type ThemePartProps } from './ThemeSections';

const SCHEMES: { value: BackbarScheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export interface ThemeAndroidProps {
  parts: ThemePartProps;
  canEdit: boolean;
  /** The full-screen dialog's bar: X, Theme, and Save as text. */
  bar: ReactNode;
  scheme: BackbarScheme;
  onScheme: (scheme: BackbarScheme) => void;
  onOpen: (kind: MiniKind) => void;
  message: string | null;
}

/**
 * Theme on Android (canvas Theme-and): a full-screen dialog with Light and
 * Dark as a Material 3 connected button group, the pages as a multi-browse
 * carousel, then grouped rows (Colour with Background, Type for names, Logo)
 * under labels in the bar's colour. The tonal colours come from the bar's
 * colour, not the phone's wallpaper. The same sheets as the phone's.
 */
export function ThemeAndroid({ parts, canEdit, bar, scheme, onScheme, onOpen, message }: ThemeAndroidProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const c = useColourPart(parts);
  const t = useTypePart(parts);
  const l = useLogoPart(parts);
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <View style={styles.pad}>
          <Connected label="Preview in" options={SCHEMES} value={scheme} onChange={onScheme} />
        </View>
        <ThemeCarousel look={parts.look} scheme={scheme} onOpen={onOpen} />
        <View style={styles.groups} pointerEvents={canEdit ? 'auto' : 'none'} aria-disabled={!canEdit}>
          {canEdit ? null : <Body tone="muted">Only Admins change the theme.</Body>}
          <Label>Colour</Label>
          <PressableScale role="button" accessibilityLabel={`Colour, ${c.name}, ${c.from}`} onPress={c.open} style={[styles.row, styles.first, { backgroundColor: ds.c.surface }]}>
            <View style={[styles.swatch, { backgroundColor: c.current }]} />
            <View style={styles.flex}>
              <Body>{c.name}</Body>
              <Caption tone="muted">{c.from}</Caption>
            </View>
          </PressableScale>
          <View style={[styles.block, styles.last, { backgroundColor: ds.c.surface }]}>
            <Body>Background</Body>
            <Connected label="Background" options={c.grounds} value={c.ground ?? ('' as Ground)} onChange={c.setGround} stretch />
          </View>
          {c.problem ? <Caption tone="accent" role="alert">{c.problem}</Caption> : null}
          <Label>Type for names</Label>
          <PressableScale role="button" accessibilityLabel={t.label} onPress={t.open} style={[styles.block, styles.first, { backgroundColor: ds.c.surface }]}>
            <DsText variant="title" numberOfLines={1} style={t.nameStyle}>{parts.row.name}</DsText>
            <Caption tone="muted">{t.line}</Caption>
          </PressableScale>
          <PressableScale role="button" accessibilityLabel="Logo, colours come from it" onPress={() => l.open('logo')} style={[styles.row, styles.middle, { backgroundColor: ds.c.surface }]}>
            {l.mark(40)}
            <View style={styles.flex}>
              <Body>Logo</Body>
              <Caption tone="muted">Colours come from it</Caption>
            </View>
          </PressableScale>
          <PressableScale role="button" accessibilityLabel={`Home-screen icon, ${l.iconName}`} onPress={() => l.open('icon')} style={[styles.row, styles.last, { backgroundColor: ds.c.surface }]}>
            <View style={styles.flex}>
              <Body>Home-screen icon</Body>
              <Caption tone="muted">{l.iconName}</Caption>
            </View>
          </PressableScale>
          {message ? <Caption role="status">{message}</Caption> : null}
        </View>
      </ScrollView>
      {c.sheet}
      {t.sheet}
      {l.sheets}
    </View>
  );
}

/** A group's label, in the bar's colour (Theme-and). */
function Label({ children }: { children: string }) {
  const ds = useDs();
  return <DsText variant="label" color={ds.accentText} style={[styles.medium, styles.label]}>{children}</DsText>;
}

/**
 * Material 3's connected button group: the chosen one fills with the bar's
 * colour, rounds fully and takes a check; the others sit on a tonal grey,
 * rounded on the outside only.
 */
function Connected<T extends string>({ label, options, value, onChange, stretch }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; stretch?: boolean }) {
  const ds = useDs();
  const n = options.length;
  return (
    <View role="radiogroup" aria-label={label} style={styles.connected}>
      {options.map((o, i) => {
        const on = o.value === value;
        const corner = on ? styles.round : n === 1 ? styles.round : i === 0 ? styles.outerLeft : i === n - 1 ? styles.outerRight : styles.inner;
        return (
          <PressableScale key={o.value} role="radio" aria-checked={on} accessibilityLabel={o.label} hitSlop={space.xs} onPress={() => onChange(o.value)} style={[styles.segment, corner, stretch && styles.flex, { backgroundColor: on ? ds.accentFill.fill : ds.c.raised }]}>
            {on ? <IconSymbol name="checkmark" size={16} color={ds.accentFill.text} /> : null}
            <DsText variant="label" color={on ? ds.accentFill.text : ds.c.ink} style={styles.medium}>{o.label}</DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** The connected group's inner corners (6dp), and the list's (4dp) between rows of a group. */
const INNER = radius.chip - 2;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pad: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg },
  groups: { gap: 2, paddingHorizontal: space.lg, paddingTop: space.xl },
  label: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  medium: { ...font.medium },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  block: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md + 2 },
  first: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderBottomLeftRadius: radius.mark, borderBottomRightRadius: radius.mark },
  middle: { borderRadius: radius.mark },
  last: { borderTopLeftRadius: radius.mark, borderTopRightRadius: radius.mark, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  swatch: { width: 40, height: 40, borderRadius: radius.pill },
  connected: { flexDirection: 'row', gap: 2 },
  segment: { height: 40, paddingHorizontal: space.lg + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs + 2 },
  round: { borderRadius: radius.pill },
  outerLeft: { borderTopLeftRadius: radius.pill, borderBottomLeftRadius: radius.pill, borderTopRightRadius: INNER, borderBottomRightRadius: INNER },
  outerRight: { borderTopLeftRadius: INNER, borderBottomLeftRadius: INNER, borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
  inner: { borderRadius: INNER },
});
