import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { BarSection, LinkRow, RowDivider } from '@/components/bar/BarParts';
import { Caption, Field, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { useBarEditor } from '@/hooks/useBarEditor';

type Editor = ReturnType<typeof useBarEditor>;

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** A colour swatch; on web it opens the browser's colour picker. */
function Swatch({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ds = useDs();
  const display = HEX.test(value) ? value : ds.c.faint;
  return (
    <View style={[styles.swatch, { backgroundColor: display, borderColor: ds.c.lineStrong, opacity: disabled ? 0.5 : 1 }]}>
      {Platform.OS === 'web' && !disabled ? (
        <input
          type="color"
          value={display}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pick color"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0, margin: 0 }}
        />
      ) : null}
    </View>
  );
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <View style={styles.colorRow}>
      <Swatch value={value} onChange={onChange} disabled={disabled} />
      <View style={styles.fill}>
        <Field label={label} value={value} onChangeText={onChange} placeholder="#RRGGBB" autoCapitalize="none" autoCorrect={false} readOnly={disabled} />
      </View>
    </View>
  );
}

/** The venue's logo and name. Picking a logo also suggests brand colours from it. */
export function VenueIdentity({ editor }: { editor: Editor }) {
  const ds = useDs();
  const logo = editor.localLogoUri || editor.logoUrl;
  return (
    <BarSection title="Venue">
      <View style={styles.logoRow}>
        <PressableScale
          onPress={editor.pickLogo}
          disabled={!editor.canEdit}
          aria-disabled={!editor.canEdit}
          accessibilityLabel={logo ? 'Change the logo' : 'Upload a logo'}
          style={[styles.logo, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.raised }]}
        >
          {logo ? (
            <Image source={{ uri: logo, cacheKey: logo }} style={styles.logoImage} contentFit="cover" />
          ) : (
            <IconSymbol name="building.2.fill" size={32} color={ds.c.muted} />
          )}
        </PressableScale>
        <View style={styles.fill}>
          {editor.canEdit ? (
            <Caption tone="muted">{editor.extractingColors ? 'Analyzing logo colors…' : logo ? 'Tap the logo to change it' : 'Tap to upload logo'}</Caption>
          ) : (
            <Caption tone="muted">{logo ? 'Logo' : 'No logo'}</Caption>
          )}
        </View>
      </View>
      <Field label="Venue name" value={editor.name} onChangeText={editor.setName} readOnly={!editor.canEdit} />
    </BarSection>
  );
}

/** Primary and secondary colours, and the link to the full brand screen. */
export function BrandColors({ editor, barId }: { editor: Editor; barId: string }) {
  const router = useRouter();
  const { primaryColor, secondaryColor } = editor;
  return (
    <BarSection title="Brand colors">
      <ColorField label="Primary" value={primaryColor} onChange={editor.setPrimaryColor} disabled={!editor.canEdit} />
      <ColorField label="Secondary" value={secondaryColor} onChange={editor.setSecondaryColor} disabled={!editor.canEdit} />
      {primaryColor || secondaryColor ? (
        <View style={styles.preview}>
          {primaryColor ? <View style={[styles.previewBar, { backgroundColor: primaryColor }]} /> : null}
          {secondaryColor ? <View style={[styles.previewBar, { backgroundColor: secondaryColor }]} /> : null}
        </View>
      ) : null}
      <RowDivider />
      <LinkRow
        icon="paintpalette.fill"
        label="Brand and look"
        detail="Accent, display face, dark ground and home-screen icon"
        onPress={() => router.push(`/settings/bar/${barId}/brand` as never)}
      />
    </BarSection>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  colorRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  swatch: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.control, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  logo: { width: 96, height: 96, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: '100%', height: '100%' },
  preview: { flexDirection: 'row', gap: space.sm },
  previewBar: { flex: 1, height: space.sm, borderRadius: radius.mark },
});
