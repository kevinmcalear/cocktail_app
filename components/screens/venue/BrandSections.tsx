import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, LogoImage, PressableScale, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, displayFaces, radius, space, type, type DisplayFace } from '@/constants/tokens';
import { useLogoEdge } from '@/lib/logoEdge';
import { logoWithBackground } from '@/supabase/functions/_shared/logoEdge';

const LOGO = 56;
const COMPARE = 72;
const FACES = Object.keys(displayFaces) as DisplayFace[];

/** "little-rye-logo.png" from the stored URL, without the query string. */
function fileName(url: string): string {
  const last = url.split('?')[0].split('/').filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(last) || 'Your logo';
  } catch {
    return last || 'Your logo';
  }
}

/**
 * The logo as it is now, its file and size, and Replace, Remove background
 * (Use original once it's gone, with the two side by side on dark and light)
 * and Remove.
 */
export function LogoRow({ venue, logoUrl, busy, onPick, onRemoveBackground, onRemove, onUseOriginal }: {
  /** For the lettered mark shown while there's no logo. */
  venue: { id: string; name: string; accent: string | null };
  logoUrl: string | null;
  busy: 'logo' | 'icon' | 'background' | null;
  onPick: () => void;
  onRemoveBackground: () => void;
  onRemove: () => void;
  onUseOriginal: (url: string) => void;
}) {
  const ds = useDs();
  const original = logoUrl ? logoWithBackground(logoUrl) : null;
  // Nothing to take out of a transparent logo; an unknown one (older, on a phone) may still have a background.
  const clear = useLogoEdge(logoUrl)?.kind === 'clear';
  const [size, setSize] = useState<{ url: string; width: number; height: number } | null>(null);
  const known = size && size.url === logoUrl ? size : null;
  const shape = known ? `${known.width === known.height ? 'Square' : 'Not square'}, ${known.width} × ${known.height}` : 'Square images work best.';
  return (
    <View style={styles.logoRow}>
      <View style={styles.logoHead}>
        {logoUrl ? (
          <LogoImage uri={logoUrl} size={LOGO} radius={radius.control} style={[styles.logo, { borderColor: ds.c.line }]} onLoad={(s) => setSize({ url: logoUrl, ...s })} />
        ) : (
          <VenueMark venue={{ ...venue, logoUrl: null, displayFace: 'instrument', groundTint: null, roleLevel: 40 }} size={LOGO} />
        )}
        <View style={styles.flex}>
          <Body numberOfLines={1}>{logoUrl ? fileName(logoUrl) : 'No logo yet'}</Body>
          <Caption tone="muted">{logoUrl ? shape : 'Square images work best.'}</Caption>
        </View>
      </View>
      <View style={styles.logoActions}>
        <Button label={busy === 'logo' ? 'Uploading…' : logoUrl ? 'Replace' : 'Add a logo'} icon="photo" variant="secondary" disabled={!!busy} onPress={onPick} />
        {logoUrl ? (
          <>
            {original ? (
              <Button label="Use original" variant="ghost" disabled={!!busy} onPress={() => onUseOriginal(original)} />
            ) : clear ? null : (
              <Button label={busy === 'background' ? 'Removing…' : 'Remove background'} variant="ghost" disabled={!!busy} onPress={onRemoveBackground} />
            )}
            <Button label="Remove" variant="ghost" disabled={!!busy} onPress={onRemove} />
          </>
        ) : null}
      </View>
      {original && logoUrl ? <BeforeAfter before={original} after={logoUrl} /> : null}
    </View>
  );
}

/** The original and the cut-out side by side, each on the dark and the light ground, so a fringe shows before it's saved. */
function BeforeAfter({ before, after }: { before: string; after: string }) {
  const ds = useDs();
  return (
    <View style={styles.compare} aria-label="The logo before and after removing its background, on dark and light">
      {[
        { label: 'Before', uri: before },
        { label: 'After', uri: after },
      ].map(({ label, uri }) => (
        <View key={label} style={styles.compareCol}>
          <Caption tone="muted">{label}</Caption>
          <View style={styles.compareRow}>
            {[backbar.dark.ground, backbar.light.ground].map((ground) => (
              <View key={ground} style={[styles.compareTile, { backgroundColor: ground, borderColor: ds.c.line }]}>
                <Image source={{ uri }} style={styles.compareLogo} contentFit="contain" accessibilityIgnoresInvertColors />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** How each face sets the sample, as tools-brand-desktop draws them: Fraunces in its italic, Bricolage a step smaller. */
const FACE_SAMPLE: Record<DisplayFace, { italic?: boolean; scale?: number }> = { instrument: {}, fraunces: { italic: true }, bricolage: { scale: 28 / 32 } };

/** The display faces side by side, each a card with the venue's name set large in it; the picked one is ringed in ink with a tick. */
/** `setup`: venue setup's Look step (canvas make-venue-look), which draws the same cards. */
export function FaceChoices({ name, value, onChange, setup }: { name: string; value: DisplayFace; onChange: (face: DisplayFace) => void; setup?: boolean }) {
  const ds = useDs();
  return (
    <View role="radiogroup" accessibilityLabel="Display face" style={[styles.faces, setup && styles.bare]}>
      {FACES.map((face) => {
        const selected = face === value;
        const look = FACE_SAMPLE[face];
        return (
          <PressableScale
            key={face}
            role="radio"
            aria-checked={selected}
            accessibilityLabel={displayFaces[face].label}
            onPress={() => onChange(face)}
            style={[styles.face, { borderColor: selected ? ds.c.ink : ds.c.line, borderWidth: selected ? 2 : 1, backgroundColor: ds.c.ground }]}
          >
            {selected ? (
              <View style={styles.tick}>
                <IconSymbol name="checkmark" size={16} color={ds.c.ink} />
              </View>
            ) : null}
            <DsText
              variant="headline"
              numberOfLines={1}
              style={[styles.sample, look.scale ? { fontSize: styles.sample.fontSize * look.scale } : null, { fontFamily: look.italic ? displayFaces[face].italic : displayFaces[face].regular }]}
            >
              {name}
            </DsText>
            <Caption tone="muted">{displayFaces[face].label}</Caption>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2, minWidth: 0 },
  logoRow: { gap: space.md, paddingVertical: space.md },
  logoHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  logo: { borderWidth: StyleSheet.hairlineWidth },
  compare: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  compareCol: { gap: space.xs },
  compareRow: { flexDirection: 'row', gap: space.xs },
  compareTile: { width: COMPARE, height: COMPARE, borderRadius: radius.control, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  compareLogo: { width: COMPARE - space.lg, height: COMPARE - space.lg },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.md },
  face: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0, gap: space.sm, padding: space.lg, borderRadius: radius.control + 4, borderCurve: 'continuous' },
  tick: { position: 'absolute', top: space.md, right: space.md },
  sample: { fontSize: type.headline.fontSize * 1.6, lineHeight: 36, paddingRight: space.lg },
  bare: { paddingVertical: 0 },
});
