import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { DEFAULT_ACCENT, displayFaces, GROUND_TINTS, radius, space, type DisplayFace } from '@/constants/tokens';
import { ACCENT_INK, colourName, iconFill, type IconBackground } from '@/lib/brandColours';

export type { IconBackground };

const BACKGROUNDS: IconBackground[] = ['accent', 'ground', 'cream'];
const TILE = 64;

interface IconLook {
  name: string;
  logoUrl: string | null;
  accent: string | null;
  groundTint: string | null;
  displayFace: DisplayFace;
}

/** The pick's name under its tile: the accent's colour name, the ground's tint name, or Cream. */
function labelFor(bg: IconBackground, look: IconLook): string {
  if (bg === 'accent') return colourName(look.accent ?? DEFAULT_ACCENT);
  if (bg === 'ground') return GROUND_TINTS.find((t) => t.hex === look.groundTint)?.label ?? 'Dark';
  return 'Cream';
}

/** The home-screen icon on one background: the logo, or the venue's initial in its display italic. */
export function IconTile({ bg, look, size = TILE }: { bg: IconBackground; look: IconLook; size?: number }) {
  const fill = iconFill(bg, look);
  // The initial in the accent, except on the accent itself, where it's cream.
  const ink = bg === 'accent' ? ACCENT_INK.cream : (look.accent ?? DEFAULT_ACCENT);
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size / 4, backgroundColor: fill }]} aria-hidden>
      {look.logoUrl ? (
        <Image source={{ uri: look.logoUrl }} style={styles.logo} contentFit="contain" accessibilityIgnoresInvertColors />
      ) : (
        <DsText variant="headline" color={ink} style={{ fontFamily: displayFaces[look.displayFace].italic, fontSize: size * 0.6, lineHeight: size * 0.75 }}>
          {look.name.charAt(0).toUpperCase()}
        </DsText>
      )}
    </View>
  );
}

/**
 * Home-screen icon: three backgrounds to put the logo on (tools-brand-desktop's
 * Rust, Walnut and Cream), the picked one ringed in ink. None picked keeps the
 * logo on its own colour.
 */
export function IconChoices({ look, value, onChange }: { look: IconLook; value: IconBackground | null; onChange: (bg: IconBackground) => void }) {
  const ds = useDs();
  return (
    <View role="radiogroup" accessibilityLabel="Home-screen icon" style={styles.row}>
      {BACKGROUNDS.map((bg) => {
        const selected = value === bg;
        const label = labelFor(bg, look);
        return (
          <PressableScale key={bg} role="radio" aria-checked={selected} accessibilityLabel={label} onPress={() => onChange(bg)} style={styles.choice}>
            <View style={[styles.ring, { borderColor: selected ? ds.c.ink : 'transparent' }]}>
              <IconTile bg={bg} look={look} />
            </View>
            <Caption tone="muted">{label}</Caption>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, paddingVertical: space.md },
  choice: { alignItems: 'center', gap: space.sm },
  ring: { padding: 2, borderWidth: 2, borderRadius: radius.control + 8 },
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: '80%', height: '80%' },
});
