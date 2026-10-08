import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueSwitcher';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space, type DisplayFace } from '@/constants/tokens';

const LOGO = 56;
const FACES = Object.keys(displayFaces) as DisplayFace[];

/** The logo as it is now, and the button to change it. */
export function LogoRow({ venue, logoUrl, busy, onPick }: {
  /** For the lettered mark shown while there's no logo. */
  venue: { id: string; name: string; accent: string | null };
  logoUrl: string | null;
  busy: boolean;
  onPick: () => void;
}) {
  const ds = useDs();
  return (
    <View style={styles.logoRow}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={[styles.logo, { borderColor: ds.c.line }]} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <VenueMark venue={{ ...venue, logoUrl: null, displayFace: 'instrument', groundTint: null, roleLevel: 40 }} size={LOGO} />
      )}
      <View style={styles.flex}>
        <Body>{logoUrl ? 'Your logo' : 'No logo yet'}</Body>
        <Caption tone="muted">Square images work best.</Caption>
      </View>
      <Button label={busy ? 'Uploading…' : logoUrl ? 'Change' : 'Add a logo'} icon="photo" variant="secondary" disabled={busy} onPress={onPick} />
    </View>
  );
}

/** The display faces, each showing the venue's name set in it. */
export function FaceChoices({ name, value, onChange }: { name: string; value: DisplayFace; onChange: (face: DisplayFace) => void }) {
  const ds = useDs();
  return (
    <View role="radiogroup" accessibilityLabel="Display face" style={styles.faces}>
      {FACES.map((face) => {
        const selected = face === value;
        return (
          <PressableScale
            key={face}
            role="radio"
            aria-checked={selected}
            accessibilityLabel={displayFaces[face].label}
            onPress={() => onChange(face)}
            style={[styles.face, { borderColor: selected ? ds.accentText : ds.c.line, borderWidth: selected ? 2 : 1, backgroundColor: ds.c.ground }]}
          >
            <View style={styles.flex}>
              <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[face].regular }}>
                {name}
              </DsText>
              <Caption tone="muted">{displayFaces[face].label}</Caption>
            </View>
            {selected ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2, minWidth: 0 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth },
  faces: { gap: space.sm, paddingVertical: space.md },
  face: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
});
