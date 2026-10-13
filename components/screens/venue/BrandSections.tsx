import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space, type DisplayFace } from '@/constants/tokens';

const LOGO = 56;
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

/** The logo as it is now, its file and size, and Replace, Remove background and Remove. */
export function LogoRow({ venue, logoUrl, busy, onPick, onRemoveBackground, onRemove }: {
  /** For the lettered mark shown while there's no logo. */
  venue: { id: string; name: string; accent: string | null };
  logoUrl: string | null;
  busy: 'logo' | 'icon' | 'background' | null;
  onPick: () => void;
  onRemoveBackground: () => void;
  onRemove: () => void;
}) {
  const ds = useDs();
  const [size, setSize] = useState<{ url: string; width: number; height: number } | null>(null);
  const known = size && size.url === logoUrl ? size : null;
  const shape = known ? `${known.width === known.height ? 'Square' : 'Not square'}, ${known.width} × ${known.height}` : 'Square images work best.';
  return (
    <View style={styles.logoRow}>
      <View style={styles.logoHead}>
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={[styles.logo, { borderColor: ds.c.line }]}
            contentFit="cover"
            accessibilityIgnoresInvertColors
            onLoad={(e) => setSize({ url: logoUrl, width: e.source.width, height: e.source.height })}
          />
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
            <Button label={busy === 'background' ? 'Removing…' : 'Remove background'} variant="ghost" disabled={!!busy} onPress={onRemoveBackground} />
            <Button label="Remove" variant="ghost" disabled={!!busy} onPress={onRemove} />
          </>
        ) : null}
      </View>
    </View>
  );
}

/** The display faces, each showing the venue's name set in it. */
/** `setup`: venue setup's Look step draws bigger names and an ink ring (canvas make-venue-look). */
export function FaceChoices({ name, value, onChange, setup }: { name: string; value: DisplayFace; onChange: (face: DisplayFace) => void; setup?: boolean }) {
  const ds = useDs();
  const ring = setup ? ds.c.ink : ds.accentText;
  return (
    <View role="radiogroup" accessibilityLabel="Display face" style={[styles.faces, setup && styles.bare]}>
      {FACES.map((face) => {
        const selected = face === value;
        return (
          <PressableScale
            key={face}
            role="radio"
            aria-checked={selected}
            accessibilityLabel={displayFaces[face].label}
            onPress={() => onChange(face)}
            style={[styles.face, { borderColor: selected ? ring : ds.c.line, borderWidth: selected ? 2 : 1, backgroundColor: ds.c.ground }]}
          >
            <View style={styles.flex}>
              <DsText variant={setup ? 'title' : 'headline'} numberOfLines={1} style={{ fontFamily: displayFaces[face].regular }}>
                {name}
              </DsText>
              <Caption tone="muted">{displayFaces[face].label}</Caption>
            </View>
            {selected ? <IconSymbol name="checkmark" size={18} color={ring} /> : null}
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
  logo: { width: LOGO, height: LOGO, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth },
  faces: { gap: space.sm, paddingVertical: space.md },
  bare: { paddingVertical: 0 },
  face: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
});
