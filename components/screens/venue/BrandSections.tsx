import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space, type, type DisplayFace } from '@/constants/tokens';

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

/** How each face sets the sample, as tools-brand-desktop draws them: Fraunces in its italic, Bricolage a step smaller. */
const FACE_SAMPLE: Record<DisplayFace, { italic?: boolean; scale?: number }> = { instrument: {}, fraunces: { italic: true }, bricolage: { scale: 28 / 32 } };

/** The display faces side by side, each a card with the venue's name set large in it; the picked one is ringed in ink with a tick. */
export function FaceChoices({ name, value, onChange }: { name: string; value: DisplayFace; onChange: (face: DisplayFace) => void }) {
  const ds = useDs();
  return (
    <View role="radiogroup" accessibilityLabel="Display face" style={styles.faces}>
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
  logo: { width: LOGO, height: LOGO, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.md },
  face: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0, gap: space.sm, padding: space.lg, borderRadius: radius.control + 4, borderCurve: 'continuous' },
  tick: { position: 'absolute', top: space.md, right: space.md },
  sample: { fontSize: type.headline.fontSize * 1.6, lineHeight: 36, paddingRight: space.lg },
});
