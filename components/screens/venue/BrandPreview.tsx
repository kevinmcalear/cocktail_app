import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, BrandProvider, Caption, DrinkImage, DsText, PressableScale, Tag, Title, useDs, type IconName } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { type DisplayFace, displayFaces, font, radius, space } from '@/constants/tokens';
import { BRAND_SAMPLE as SAMPLE } from '@/lib/brandSample';
import { withAlpha } from '@/lib/color';

import type { IconBackground } from './BrandIcon';

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
  { label: 'Drinks', icon: 'place.library' },
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
        <Caption tone="muted" numberOfLines={1}>{`${today()} · Autumn menu · 8 drinks`}</Caption>
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

/**
 * Venue setup's live preview (canvas make-venue-look): Tonight in the draft
 * look, one scheme at a time, with Dark and Light as chips under it.
 */
export function BrandPreview({ look }: { look: BrandLook }) {
  const [only, setOnly] = useState<'light' | 'dark'>('dark');
  return (
    <View aria-label="Live preview" style={styles.wrap}>
      <BackbarTheme scheme={only}>
        <BrandProvider accent={look.accent ?? undefined} displayFace={look.displayFace} groundTint={look.groundTint}>
          <View role="img" aria-label={`Tonight at ${look.name} in ${only} mode, with the new theme`}>
            <MiniScreen look={look} />
          </View>
        </BrandProvider>
      </BackbarTheme>
      <View role="radiogroup" accessibilityLabel="Preview scheme" style={styles.chips}>
        {SCHEMES.map((o) => (
          <SchemeChip key={o.value} label={o.label} selected={only === o.value} onPress={() => setOnly(o.value)} />
        ))}
      </View>
      <Caption tone="muted">Tonight, as your staff will see it. Changes as you pick.</Caption>
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
  flex: { flex: 1, gap: space.xs },
  chips: { flexDirection: 'row', gap: space.sm },
  scheme: { minHeight: 40, minWidth: 64, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  picked: { ...font.semiBold },
  screen: { gap: space.sm, padding: space.md, borderRadius: radius.sheet - space.md, borderCurve: 'continuous', borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  round: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabPill: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', padding: space.xs, borderRadius: radius.pill, borderWidth: 1 },
  tab: { alignItems: 'center', gap: 2, paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: radius.pill },
  tabLabel: { ...font.medium },
  search: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.control },
  cta: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tile: { width: 40 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
});

/** Today as Tonight's header writes it ("Tue 3 Nov"), so the sample never shows a stale date. */
const today = () => new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
