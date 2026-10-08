import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  BackbarTheme,
  BrandProvider,
  Button,
  Caption,
  Display,
  DsText,
  Headline,
  PressableScale,
  Segmented,
  Tag,
  useBreakpoint,
  useDs,
} from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueSwitcher';
import { radius, space, type DisplayFace } from '@/constants/tokens';

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
}

const SCHEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

/** A small screen in one scheme, drawn with the real components so it matches the app. */
function MiniScreen({ look }: { look: BrandLook }) {
  const ds = useDs();
  const venue = { ...look, roleLevel: 40 };
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, borderColor: ds.c.line }]}>
      <View style={styles.header}>
        <VenueMark venue={venue} size={24} />
        <Headline numberOfLines={1} style={styles.flex}>
          {look.name}
        </Headline>
      </View>
      <Display numberOfLines={1}>Tonight</Display>
      <Caption tone="muted">Autumn menu · 8 drinks</Caption>
      <View style={styles.row}>
        <Button label="Start prep" />
        <Tag label="New" tone="accent" />
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
  const brand = { accent: look.accent ?? undefined, displayFace: look.displayFace, groundTint: look.groundTint ?? undefined };
  const schemes = wide ? (['light', 'dark'] as const) : [only];
  return (
    <View accessibilityLabel="Preview of your brand" style={styles.wrap}>
      {wide ? null : <Segmented options={SCHEMES} value={only} onChange={setOnly} accessibilityLabel="Preview scheme" />}
      <View style={[styles.schemes, wide && !stacked && styles.schemesWide]}>
        {schemes.map((scheme) => (
          <BackbarTheme key={scheme} scheme={scheme}>
            <BrandProvider {...brand}>
              <View style={styles.flex}>
                {wide ? <Caption tone="muted">{scheme === 'light' ? 'Light' : 'Dark'}</Caption> : null}
                <MiniScreen look={look} />
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  icon: { alignItems: 'center', gap: space.xs, width: 84 },
  iconTile: { width: 60, height: 60, borderRadius: radius.control },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { alignItems: 'center', gap: space.xs, minWidth: 56 },
  ring: { padding: 3, borderRadius: radius.pill, borderWidth: 2 },
  dot: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1 },
});
