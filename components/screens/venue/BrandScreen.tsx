import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Field, GlassButton, Surface, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { SectionHeading, SettingsSection, UnsavedBar } from '@/components/screens/settings/SettingsParts';
import { WebHead } from '@/components/WebHead';
import { DEFAULT_ACCENT, GROUND_TINTS, layout, space, type DisplayFace } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { pickBrandImage, useSaveVenueBrand, useVenueBrand, type VenueBrandRow } from '@/hooks/useVenueBrand';
import { brandProblems, faceFromDb, faceToDb, normalizeHex, usableGroundTint } from '@/lib/brand';
import { confirmDiscardChanges } from '@/lib/dialogs';

import { BrandPreview, Swatches } from './BrandPreview';
import { FaceChoices, LogoRow } from './BrandSections';

const PREVIEW_WIDTH = 380;
// The preview column stays in view while the settings beside it scroll (web).
const sticky = Platform.OS === 'web' ? ({ position: 'sticky', top: space.lg } as unknown as ViewStyle) : null;

function draftFrom(row: VenueBrandRow) {
  return {
    logoUrl: row.logo_url,
    iconUrl: row.icon_url,
    accent: row.primary_color ?? '',
    face: faceFromDb(row.display_face) as DisplayFace,
    tint: row.ground_tint ?? '',
    shortName: row.short_name ?? '',
  };
}

function BrandEditor({ row, canEdit, header }: { row: VenueBrandRow; canEdit: boolean; header: (dirty: boolean) => ReactNode }) {
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const [draft, setDraft] = useState(() => draftFrom(row));
  const set = <K extends keyof typeof draft>(key: K) => (value: (typeof draft)[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const [suggested, setSuggested] = useState<string[]>([]);
  const [busy, setBusy] = useState<'logo' | 'icon' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const save = useSaveVenueBrand(row.id);

  const problems = brandProblems({ accent: draft.accent, groundTint: draft.tint, shortName: draft.shortName });
  const patch = {
    logo_url: draft.logoUrl,
    icon_url: draft.iconUrl,
    primary_color: normalizeHex(draft.accent),
    display_face: faceToDb(draft.face),
    ground_tint: normalizeHex(draft.tint),
    short_name: draft.shortName.trim() || null,
  };
  const changed = canEdit && (Object.keys(patch) as (keyof typeof patch)[]).some((k) => (patch[k] ?? null) !== (row[k] ?? null));

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
        set('logoUrl')(picked.url);
        setSuggested(picked.colors.map((c) => c.toUpperCase()));
      } else set('iconUrl')(picked.url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The image didn’t upload. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const look = {
    id: row.id,
    name: row.name,
    logoUrl: draft.logoUrl,
    iconUrl: draft.iconUrl,
    shortName: draft.shortName,
    accent: normalizeHex(draft.accent),
    displayFace: draft.face,
    groundTint: usableGroundTint(normalizeHex(draft.tint)),
  };

  const settings = (
    <View style={styles.form} pointerEvents={canEdit ? 'auto' : 'none'} aria-disabled={!canEdit}>
      <SettingsSection title="Logo" note="Picking a logo suggests accent colours from it.">
        <LogoRow venue={{ id: row.id, name: row.name, accent: look.accent }} logoUrl={draft.logoUrl} busy={busy === 'logo'} onPick={() => void upload('logo')} />
      </SettingsSection>

      <SettingsSection title="Accent colour" note="Buttons, links and highlights. Light mode uses a deeper shade automatically so text stays readable.">
        <View style={styles.fields}>
          <Swatches label="Accent colour" options={accentOptions} value={normalizeHex(draft.accent)} onChange={(hex) => set('accent')(hex ?? '')} />
          <Field label="Hex" value={draft.accent} onChangeText={set('accent')} placeholder="e.g. #D0643B" autoCapitalize="characters" autoCorrect={false} error={problems.accent} />
        </View>
      </SettingsSection>

      <SettingsSection title="Display face" note="The typeface for big titles, like your venue’s name and Tonight.">
        <FaceChoices name={row.name} value={draft.face} onChange={set('face')} />
      </SettingsSection>

      <SettingsSection title="Dark mode" note="A tint behind everything in dark mode. Tints too light for text to read on are refused.">
        <View style={styles.fields}>
          <Swatches
            label="Dark mode ground"
            options={[{ label: 'Standard', hex: null }, ...GROUND_TINTS.map((t) => ({ label: t.label, hex: t.hex }))]}
            value={normalizeHex(draft.tint)}
            onChange={(hex) => set('tint')(hex ?? '')}
          />
          <Field label="Hex (optional)" value={draft.tint} onChangeText={set('tint')} placeholder="e.g. #1A1410" autoCapitalize="characters" autoCorrect={false} error={problems.groundTint} />
        </View>
      </SettingsSection>

      <SettingsSection title="Home screen" note="What staff see when they add your staff link to their phone’s home screen.">
        <View style={styles.fields}>
          <Field label="Short name" value={draft.shortName} onChangeText={set('shortName')} placeholder={row.name} maxLength={16} error={problems.shortName} hint="Shown under the icon. Up to 12 characters." />
          <View style={styles.row}>
            <Button label={busy === 'icon' ? 'Uploading…' : draft.iconUrl ? 'Change icon' : 'Upload an icon'} icon="photo" variant="secondary" disabled={!!busy} onPress={() => void upload('icon')} />
            {draft.iconUrl ? <Button label="Use the logo" variant="ghost" onPress={() => set('iconUrl')(null)} /> : null}
          </View>
          {draft.iconUrl ? null : <Caption tone="muted">Without an icon of its own, the logo is used.</Caption>}
        </View>
      </SettingsSection>
      {message ? <Caption role="status">{message}</Caption> : null}
    </View>
  );

  const preview = (
    <View style={[styles.preview, wide && styles.previewSide, wide && sticky]}>
      <SectionHeading>Preview</SectionHeading>
      <Surface>
        <BrandPreview look={look} stacked={wide} />
      </Surface>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxxl }}
      >
        <View style={[styles.page, wide && styles.pageWide]}>
          {header(changed)}
          {canEdit ? null : <Body tone="muted">Only venue Admins can change the brand.</Body>}
          <View style={[styles.columns, wide && styles.columnsWide]}>
            {wide ? null : preview}
            {settings}
            {wide ? preview : null}
          </View>
        </View>
      </ScrollView>
      {changed ? (
        <UnsavedBar
          maxWidth={wide ? 1040 : 680}
          saving={save.isPending}
          canSave={Object.keys(problems).length === 0 && !busy}
          onDiscard={() => {
            setDraft(draftFrom(row));
            setSuggested([]);
            setMessage(null);
          }}
          onSave={() => save.mutate(patch, { onSuccess: () => setMessage('Saved. Everyone at the venue sees it next time the app loads.'), onError: (e) => setMessage(e.message) })}
        />
      ) : null}
    </View>
  );
}

/** Brand settings for a venue, with a live preview. Admins edit; others can look. */
export function BrandScreen({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const brand = useVenueBrand(barId);
  const capabilities = useCapabilities(barId);
  const canEdit = (capabilities.data ?? []).includes('brand');

  const header = (dirty: boolean) => (
    <View style={styles.head}>
      <GlassButton
        accessibilityLabel="Back"
        icon="chevron.left"
        onPress={async () => {
          if (!(await confirmDiscardChanges(dirty))) return;
          if (router.canGoBack()) router.back();
          else router.replace('/settings' as never);
        }}
      />
      <View style={styles.title}>
        <Title>Brand</Title>
        <Caption tone="muted" numberOfLines={1}>
          {brand.data ? `${brand.data.name} · seen by everyone at the venue` : ' '}
        </Caption>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Brand</title>
      </WebHead>
      {brand.data ? (
        <BrandEditor key={brand.data.id} row={brand.data} canEdit={canEdit} header={header} />
      ) : (
        <View style={[styles.page, { paddingHorizontal: gutter, paddingTop: insets.top + space.sm }]}>
          {header(false)}
          {brand.error ? <Body tone="muted">Couldn’t load this venue’s brand. Try again in a moment.</Body> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: space.xl },
  pageWide: { maxWidth: 1040 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  title: { flex: 1, gap: 2, minWidth: 0 },
  columns: { gap: space.xl },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  form: { flex: 1, gap: space.xl, minWidth: 0 },
  fields: { gap: space.md, paddingVertical: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  preview: { gap: space.sm },
  previewSide: { width: PREVIEW_WIDTH },
});
