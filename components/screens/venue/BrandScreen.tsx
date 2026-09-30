import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Field, GlassButton, Headline, Segmented, Title, useDs, useGutter } from '@/components/ds';
import { DEFAULT_ACCENT, displayFaces, GROUND_TINTS, space, type DisplayFace } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { pickBrandImage, useSaveVenueBrand, useVenueBrand, type VenueBrandRow } from '@/hooks/useVenueBrand';
import { brandProblems, faceFromDb, faceToDb, normalizeHex, usableGroundTint } from '@/lib/brand';

import { BrandPreview, Swatches } from './BrandPreview';

const FACES = (Object.keys(displayFaces) as DisplayFace[]).map((f) => ({ value: f, label: displayFaces[f].label }));

function BrandEditor({ row, canEdit }: { row: VenueBrandRow; canEdit: boolean }) {
  const [logoUrl, setLogoUrl] = useState(row.logo_url);
  const [iconUrl, setIconUrl] = useState(row.icon_url);
  const [accent, setAccent] = useState(row.primary_color ?? '');
  const [face, setFace] = useState<DisplayFace>(faceFromDb(row.display_face));
  const [tint, setTint] = useState(row.ground_tint ?? '');
  const [shortName, setShortName] = useState(row.short_name ?? '');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [busy, setBusy] = useState<'logo' | 'icon' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const save = useSaveVenueBrand(row.id);

  const problems = brandProblems({ accent, groundTint: tint, shortName });
  const patch = {
    logo_url: logoUrl,
    icon_url: iconUrl,
    primary_color: normalizeHex(accent),
    display_face: faceToDb(face),
    ground_tint: normalizeHex(tint),
    short_name: shortName.trim() || null,
  };
  const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => (patch[k] ?? null) !== (row[k] ?? null));

  const accentOptions = useMemo(() => {
    const named = [
      ...suggested.map((hex) => ({ label: 'From logo', hex })),
      { label: 'Current', hex: row.primary_color },
      { label: 'Second colour', hex: row.secondary_color },
      { label: 'App default', hex: DEFAULT_ACCENT },
    ];
    const seen = new Set<string>();
    return named.flatMap((o) => {
      const hex = o.hex ? normalizeHex(o.hex) : null;
      if (!hex || seen.has(hex)) return [];
      seen.add(hex);
      return [{ label: o.label, hex }];
    });
  }, [suggested, row.primary_color, row.secondary_color]);

  const upload = async (kind: 'logo' | 'icon') => {
    setBusy(kind);
    setMessage(null);
    try {
      const picked = await pickBrandImage(row.id, kind === 'logo');
      if (!picked) return;
      if (kind === 'logo') {
        setLogoUrl(picked.url);
        setSuggested(picked.colors.map((c) => c.toUpperCase()));
      } else setIconUrl(picked.url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The image didn’t upload. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const look = {
    id: row.id,
    name: row.name,
    logoUrl,
    iconUrl,
    shortName,
    accent: normalizeHex(accent),
    displayFace: face,
    groundTint: usableGroundTint(normalizeHex(tint)),
  };

  return (
    <View style={styles.body}>
      <BrandPreview look={look} />
      {!canEdit ? <Body tone="muted">Only venue admins can change the brand.</Body> : null}

      <View style={styles.section} pointerEvents={canEdit ? 'auto' : 'none'} aria-disabled={!canEdit}>
        <Headline role="heading">Logo and accent</Headline>
        <Button
          label={busy === 'logo' ? 'Uploading…' : logoUrl ? 'Change logo' : 'Add a logo'}
          icon="photo"
          variant="secondary"
          disabled={!!busy}
          onPress={() => upload('logo')}
          style={styles.start}
        />
        <Swatches label="Accent colour" options={accentOptions} value={normalizeHex(accent)} onChange={(hex) => setAccent(hex ?? '')} />
        <Field label="Accent (hex)" value={accent} onChangeText={setAccent} autoCapitalize="characters" autoCorrect={false} error={problems.accent} hint="Light mode uses a deeper shade automatically, so text stays readable." />

        <Headline role="heading">Display face</Headline>
        <Segmented options={FACES} value={face} onChange={setFace} accessibilityLabel="Display face" />

        <Headline role="heading">Dark mode ground</Headline>
        <Swatches
          label="Dark mode ground"
          options={[{ label: 'Standard', hex: null }, ...GROUND_TINTS.map((t) => ({ label: t.label, hex: t.hex }))]}
          value={normalizeHex(tint)}
          onChange={(hex) => setTint(hex ?? '')}
        />
        <Field label="Ground tint (hex, optional)" value={tint} onChangeText={setTint} autoCapitalize="characters" autoCorrect={false} error={problems.groundTint} />

        <Headline role="heading">Home screen</Headline>
        <Field label="Short name" value={shortName} onChangeText={setShortName} maxLength={16} error={problems.shortName} hint="Shown under the icon when staff add the venue's link to their home screen." />
        <View style={styles.row}>
          <Button label={busy === 'icon' ? 'Uploading…' : 'Upload an icon'} icon="photo" variant="secondary" disabled={!!busy} onPress={() => upload('icon')} />
          {iconUrl ? <Button label="Use the logo" variant="ghost" onPress={() => setIconUrl(null)} /> : null}
        </View>
      </View>

      {canEdit ? (
        <View style={styles.section}>
          <Button
            label={save.isPending ? 'Saving…' : 'Save brand'}
            size="lg"
            disabled={!changed || Object.keys(problems).length > 0 || save.isPending || !!busy}
            onPress={() => save.mutate(patch, { onSuccess: () => setMessage('Saved. Everyone at the venue sees it next time the app loads.'), onError: (e) => setMessage(e.message) })}
          />
          {message ? <Caption aria-live="polite">{message}</Caption> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Brand settings for a venue, with a live preview. Admins edit; others can look. */
export function BrandScreen({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const brand = useVenueBrand(barId);
  const capabilities = useCapabilities(barId);
  const canEdit = (capabilities.data ?? []).includes('brand');
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxxl }}>
        <View style={styles.top}>
          <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings' as never))} />
        </View>
        <Title>Brand</Title>
        <Caption tone="muted">{brand.data ? `How ${brand.data.name} looks in the app, for everyone at the venue.` : ' '}</Caption>
        {brand.error ? <Body tone="muted">Couldn’t load this venue’s brand. Try again in a moment.</Body> : null}
        {brand.data ? <BrandEditor key={brand.data.id} row={brand.data} canEdit={canEdit} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', marginBottom: space.md },
  body: { gap: space.xl, marginTop: space.xl, maxWidth: 760, width: '100%' },
  section: { gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  start: { alignSelf: 'flex-start' },
});
