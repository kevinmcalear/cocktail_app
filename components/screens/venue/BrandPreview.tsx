import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, BrandProvider, Caption, DrinkImage, DsText, PressableScale, Tag, Title, useBreakpoint, useDs, type IconName } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, layout, radius, space, type DisplayFace } from '@/constants/tokens';
import { BRAND_SAMPLE as SAMPLE } from '@/lib/brandSample';
import { withAlpha } from '@/lib/color';

import { IconTile, type IconBackground } from './BrandIcon';

export interface BrandLook {
  id: string;
  name: string;
  logoUrl: string | null;
  iconUrl: string | null;
  shortName: string;
  accent: string | null;
  displayFace: DisplayFace;
  /** Only a readable tint (lib/brand usableGroundTint), or null. */
  groundTint: string | null;
  /** The home-screen icon's background, or null for the logo's own. */
  iconBackground?: IconBackground | null;
}

export const SCHEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const;

const TABS: { label: string; icon: IconName }[] = [
  { label: 'Tonight', icon: 'place.tonight' },
  { label: 'Library', icon: 'place.library' },
  { label: 'Discover', icon: 'place.discover' },
];

/** Tonight in one scheme, in the draft brand, drawn with the real components so it matches the app. `compact`: its top, one drink and no tab bar (setup's pinned preview, E34). */
export function MiniScreen({ look, compact }: { look: BrandLook; compact?: boolean }) {
  const ds = useDs();
  const venue = { ...look, roleLevel: 40 };
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, borderColor: ds.c.lineStrong }]}>
      {/* The header as the app draws it: the mark that switches, then New and You. */}
      <View style={styles.header}>
        <VenueMark venue={venue} size={24} />
        <IconSymbol name="chevron.down" size={10} color={ds.c.muted} />
        <View style={styles.flex} />
        <View style={[styles.round, { borderColor: ds.c.lineStrong }]}>
          <IconSymbol name="plus" size={12} color={ds.c.ink} />
        </View>
        <View style={[styles.round, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]} />
      </View>
      <View>
        <Title numberOfLines={1}>Tonight</Title>
        <Caption tone="muted" numberOfLines={1}>Thu 9 Oct · Autumn menu · 8 drinks</Caption>
      </View>
      <View style={[styles.banner, { backgroundColor: ds.c.raised }]}>
        <Caption style={styles.flex}>2 new drinks go on at 6.</Caption>
        <View style={[styles.cta, { backgroundColor: ds.accentFill.fill }]}>
          <Caption color={ds.accentFill.text}>See them</Caption>
        </View>
      </View>
      {(compact ? SAMPLE.slice(0, 1) : SAMPLE).map((d) => (
        <View key={d.name} style={styles.drink}>
          <View style={styles.tile}>
            <DrinkImage thumb sketchDetail="thumb" sketch={d.sketch} itemId={d.name} accessibilityLabel={d.name} radius="control" />
          </View>
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <DsText variant="body" numberOfLines={1} style={{ fontFamily: displayFaces[look.displayFace].regular }}>
                {d.name}
              </DsText>
              {d.isNew ? <Tag label="New" tone="accent" /> : null}
            </View>
            <Caption tone="muted" numberOfLines={1}>{d.line}</Caption>
          </View>
          <DsText variant="spec">{d.price}</DsText>
        </View>
      ))}
      {/* The glass tab bar and its search circle. */}
      {compact ? null : (
        <View style={styles.tabs}>
          <View style={[styles.tabPill, { backgroundColor: ds.c.glass, borderColor: ds.c.glassBorder }]}>
            {TABS.map((t, i) => (
              <View key={t.label} style={[styles.tab, i === 0 && { backgroundColor: ds.c.raised }]}>
                <IconSymbol name={t.icon} size={12} color={i === 0 ? ds.accentText : ds.c.muted} />
                <Caption color={i === 0 ? ds.accentText : ds.c.muted} style={styles.tabLabel}>
                  {t.label}
                </Caption>
              </View>
            ))}
          </View>
          <View style={[styles.search, { backgroundColor: ds.c.glass, borderColor: ds.c.glassBorder }]}>
            <IconSymbol name="magnifyingglass" size={14} color={ds.c.ink} />
          </View>
        </View>
      )}
    </View>
  );
}

/** The home-screen icon as a phone shows it, with the short name under it, and what it is. */
function HomeIcon({ look }: { look: BrandLook }) {
  const ds = useDs();
  const src = look.iconUrl ?? look.logoUrl;
  return (
    <View style={[styles.iconCard, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.icon}>
        {look.iconBackground && !look.iconUrl ? (
          <IconTile bg={look.iconBackground} look={look} size={44} />
        ) : src ? (
          <Image source={{ uri: src }} style={styles.iconTile} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : (
          <VenueMark venue={{ ...look, roleLevel: 40 }} size={44} />
        )}
        <Caption numberOfLines={1} color={ds.c.ink}>
          {look.shortName.trim() || look.name}
        </Caption>
      </View>
      <Caption tone="muted" style={styles.flex}>
        How it sits on a phone’s home screen once staff add your staff link.
      </Caption>
    </View>
  );
}

/**
 * The live preview on the brand screen: the draft brand in light and dark
 * (one at a time on phones), plus the home-screen icon. `stacked` puts the
 * two schemes one above the other, for a narrow side column.
 */
export function BrandPreview({ look, stacked = false, setup = false }: { look: BrandLook; stacked?: boolean; setup?: boolean }) {
  const notPhone = useBreakpoint() !== 'phone';
  // Venue setup's Look step: one phone at a time, Dark and Light as chips under it, no home-screen icon (canvas make-venue-look).
  const wide = notPhone && !setup;
  // Phones show one scheme at a time, so the controls stay close to the preview.
  const [only, setOnly] = useState<'light' | 'dark'>('dark');
  const brand = { accent: look.accent ?? undefined, displayFace: look.displayFace, groundTint: look.groundTint ?? undefined };
  const schemes = wide ? (['dark', 'light'] as const) : [only];
  return (
    <View aria-label="Live preview" style={styles.wrap}>
      {wide || setup ? null : <SchemeSwitch value={only} onChange={setOnly} />}
      <View style={[styles.schemes, wide && !stacked && styles.schemesWide]}>
        {schemes.map((scheme) => (
          <BackbarTheme key={scheme} scheme={scheme}>
            <BrandProvider {...brand}>
              <View style={styles.flex}>
                {wide ? <Caption tone="muted">{scheme === 'light' ? 'Light' : 'Dark'}</Caption> : null}
                <View role="img" aria-label={`Tonight at ${look.name} in ${scheme} mode, with the new brand`}>
                  <MiniScreen look={look} />
                </View>
              </View>
            </BrandProvider>
          </BackbarTheme>
        ))}
      </View>
      {setup ? (
        <>
          <View role="radiogroup" accessibilityLabel="Preview scheme" style={styles.chips}>
            {SCHEMES.map((o) => (
              <SchemeChip key={o.value} label={o.label} selected={only === o.value} onPress={() => setOnly(o.value)} />
            ))}
          </View>
          <Caption tone="muted">Tonight, as your staff will see it. Changes as you pick.</Caption>
        </>
      ) : (
        <HomeIcon look={look} />
      )}
    </View>
  );
}

/** Dark | Light, a segmented pill (phones show one scheme at a time). */
function SchemeSwitch({ value, onChange }: { value: 'dark' | 'light'; onChange: (v: 'dark' | 'light') => void }) {
  const ds = useDs();
  return (
    <View role="radiogroup" accessibilityLabel="Preview scheme" style={[styles.switch, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      {SCHEMES.map((o) => (
        <PressableScale
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          accessibilityLabel={o.label}
          onPress={() => onChange(o.value)}
          style={[styles.switchItem, value === o.value && { backgroundColor: ds.c.ink }]}
        >
          <Caption color={value === o.value ? ds.c.ground : ds.c.ink} style={styles.tabLabel}>
            {o.label}
          </Caption>
        </PressableScale>
      ))}
    </View>
  );
}

/** Dark or Light under the setup preview: the picked one ringed in the accent over a faint accent wash (canvas make-venue-look). */
export function SchemeChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.scheme,
        { borderColor: selected ? ds.accentText : ds.c.lineStrong, backgroundColor: selected ? withAlpha(ds.accentText, 0.16) : 'transparent' },
      ]}
    >
      <Caption style={selected ? styles.picked : null}>{label}</Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  chips: { flexDirection: 'row', gap: space.sm },
  scheme: { minHeight: 40, minWidth: 64, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  picked: { fontFamily: fontFamilies.bodySemiBold },
  schemes: { gap: space.md },
  schemesWide: { flexDirection: 'row' },
  flex: { flex: 1, gap: space.xs },
  screen: { gap: space.sm, padding: space.md, borderRadius: radius.sheet - space.md, borderCurve: 'continuous', borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  round: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabPill: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', padding: space.xs, borderRadius: radius.pill, borderWidth: 1 },
  tab: { alignItems: 'center', gap: 2, paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: radius.pill },
  tabLabel: { fontFamily: fontFamilies.bodyMedium },
  search: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  switch: { flexDirection: 'row', padding: space.xs, borderRadius: radius.pill, borderWidth: 1 },
  switchItem: { flex: 1, minHeight: layout.minTapTarget - space.sm, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.lg, borderRadius: radius.pill },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.control },
  cta: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tile: { width: 40 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  iconCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1 },
  icon: { alignItems: 'center', gap: space.xs, width: 64 },
  iconTile: { width: 44, height: 44, borderRadius: radius.control },
});
