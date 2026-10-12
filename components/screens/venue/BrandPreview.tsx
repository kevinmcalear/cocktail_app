import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  BackbarTheme,
  BrandProvider,
  Caption,
  Display,
  DsText,
  PressableScale,
  Segmented,
  Tag,
  useBreakpoint,
  useDs,
} from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { displayFaces, radius, space, type DisplayFace } from '@/constants/tokens';

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
  /** Text on accent buttons, or null for the automatic pick. */
  accentText?: 'cream' | 'ink' | null;
}

const SCHEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const;

/** Sample drinks for the preview: the same three the canvas draws. */
const SAMPLE = [
  { name: 'House Martini', line: 'Gin · dry vermouth', price: '18', isNew: false },
  { name: 'Bolo Tie', line: 'Rye · amaro · orange', price: '19', isNew: true },
  { name: 'Champ Stamp', line: 'Bourbon · strawberry · smoke', price: '20', isNew: false },
];
const TABS = ['Tonight', 'Library', 'Discover'];

/** Tonight in one scheme, in the draft brand, drawn with the real components so it matches the app. */
function MiniScreen({ look }: { look: BrandLook }) {
  const ds = useDs();
  const venue = { ...look, roleLevel: 40 };
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, borderColor: ds.c.line }]}>
      <VenueMark venue={venue} size={28} />
      <View>
        <Display numberOfLines={1}>Tonight</Display>
        <Caption tone="muted" numberOfLines={1}>Thu 9 Oct · Autumn menu · 8 drinks</Caption>
      </View>
      <View style={[styles.banner, { backgroundColor: ds.c.raised }]}>
        <Caption style={styles.flex}>2 new drinks go on at 6.</Caption>
        <View style={[styles.cta, { backgroundColor: ds.accentFill.fill }]}>
          <Caption color={ds.accentFill.text}>See them</Caption>
        </View>
      </View>
      {SAMPLE.map((d) => (
        <View key={d.name} style={styles.drink}>
          <View style={[styles.tile, { backgroundColor: ds.c.paper }]} />
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
      <View style={[styles.tabs, { borderTopColor: ds.c.line }]}>
        {TABS.map((t, i) => (
          <Caption key={t} color={i === 0 ? ds.accentText : ds.c.muted}>{t}</Caption>
        ))}
      </View>
    </View>
  );
}

/** The home-screen icon as a phone shows it, with the short name under it. */
function HomeIcon({ look }: { look: BrandLook }) {
  const ds = useDs();
  const src = look.iconUrl ?? look.logoUrl;
  return (
    <View style={styles.icon}>
      {src ? (
        <Image source={{ uri: src }} style={styles.iconTile} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <VenueMark venue={{ ...look, roleLevel: 40 }} size={60} />
      )}
      <Caption numberOfLines={1} color={ds.c.ink}>
        {look.shortName.trim() || look.name}
      </Caption>
    </View>
  );
}

/**
 * The live preview on the brand screen: the draft brand in light and dark
 * (one at a time on phones), plus the home-screen icon. `stacked` puts the
 * two schemes one above the other, for a narrow side column.
 */
export function BrandPreview({ look, stacked = false }: { look: BrandLook; stacked?: boolean }) {
  const wide = useBreakpoint() !== 'phone';
  // Phones show one scheme at a time, so the controls stay close to the preview.
  const [only, setOnly] = useState<'light' | 'dark'>('dark');
  const brand = { accent: look.accent ?? undefined, displayFace: look.displayFace, groundTint: look.groundTint ?? undefined, accentText: look.accentText ?? undefined };
  const schemes = wide ? (['dark', 'light'] as const) : [only];
  return (
    <View aria-label="Live preview" style={styles.wrap}>
      {wide ? null : <Segmented options={SCHEMES} value={only} onChange={setOnly} accessibilityLabel="Preview scheme" />}
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
      <HomeIcon look={look} />
    </View>
  );
}

/** A row of colour choices, each named, with the chosen one heavily ringed. */
export function Swatches({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; hex: string | null }[];
  value: string | null;
  onChange: (hex: string | null) => void;
}) {
  const ds = useDs();
  return (
    <View role="radiogroup" accessibilityLabel={label} style={styles.swatches}>
      {options.map((o) => {
        const selected = (o.hex ?? null) === (value ?? null);
        return (
          <PressableScale
            key={o.label}
            role="radio"
            aria-checked={selected}
            accessibilityLabel={o.hex ? `${o.label}, ${o.hex}` : o.label}
            onPress={() => onChange(o.hex)}
            style={styles.swatch}
          >
            {/* The ring sits outside the dot, with a gap, so it shows on dark swatches too. */}
            <View style={[styles.ring, { borderColor: selected ? ds.c.ink : 'transparent' }]}>
              <View style={[styles.dot, { backgroundColor: o.hex ?? ds.c.raised, borderColor: ds.c.line }]} />
            </View>
            <DsText variant="caption" numberOfLines={1}>
              {o.label}
            </DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  schemes: { gap: space.md },
  schemesWide: { flexDirection: 'row' },
  flex: { flex: 1, gap: space.xs },
  screen: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.control },
  cta: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tile: { width: 36, height: 36, borderRadius: radius.control },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  icon: { alignItems: 'center', gap: space.xs, width: 84 },
  iconTile: { width: 60, height: 60, borderRadius: radius.control },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { alignItems: 'center', gap: space.xs, minWidth: 56 },
  ring: { padding: 3, borderRadius: radius.pill, borderWidth: 2 },
  dot: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1 },
});
