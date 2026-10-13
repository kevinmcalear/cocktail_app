import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Surface, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { SetupPage } from '@/components/screens/onboarding/SetupPage';
import { SectionHeading, UnsavedBar } from '@/components/screens/settings/SettingsParts';
import { WebHead } from '@/components/WebHead';
import { DEFAULT_ACCENT, space, type DisplayFace } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useViewAs } from '@/hooks/useViewAs';
import { pickBrandImage, removeLogoBackground, useSaveVenueBrand, useVenueBrand, type VenueBrandRow } from '@/hooks/useVenueBrand';
import { brandProblems, faceFromDb, faceToDb, normalizeHex, usableGroundTint } from '@/lib/brand';
import { ACCENT_INK, type AccentInk } from '@/lib/brandColours';
import { accentFill } from '@/lib/color';
import { confirmDiscardChanges } from '@/lib/dialogs';

import { BrandForm, type BrandDraftState } from './BrandForm';
import { BrandPreview } from './BrandPreview';

const PREVIEW_WIDTH = 380;
/** Venue setup's preview column on wide web: one phone (canvas make-venue-desktop). */
const SETUP_PREVIEW_WIDTH = 260;
/** Preview as staff shows the app as a Bartender sees it. */
const STAFF_PREVIEW = 30;
// The preview column stays in view while the settings beside it scroll (web).
const sticky = Platform.OS === 'web' ? ({ position: 'sticky', top: space.lg } as unknown as ViewStyle) : null;

function draftFrom(row: VenueBrandRow): BrandDraftState {
  return {
    logoUrl: row.logo_url,
    iconUrl: row.icon_url,
    accent: row.primary_color ?? '',
    custom: false,
    ink: row.accent_text,
    face: faceFromDb(row.display_face) as DisplayFace,
    tint: row.ground_tint ?? '',
    shortName: row.short_name ?? '',
  };
}

/** Venue setup's Look step (canvas make-venue-look): this editor, saved by the step's Continue. */
export interface BrandSetupMode {
  footer: (s: { save: (then: () => void) => void; saving: boolean; ok: boolean }) => ReactNode;
}

function BrandEditor({ row, canEdit, header, setup }: { row: VenueBrandRow; canEdit: boolean; header: (dirty: boolean) => ReactNode; setup?: BrandSetupMode }) {
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  // In setup the preview sits above the settings on phones, and beside them on wide web (canvas make-venue-desktop).
  const frameText = usePageFrame('text');
  const notPhone = useBreakpoint() !== 'phone';
  const wide = setup ? frameText.wide : notPhone;
  const frame = usePageFrame(wide && !setup ? 'wide' : 'text');
  const [draft, setDraft] = useState(() => draftFrom(row));
  const set = <K extends keyof BrandDraftState>(key: K) => (value: BrandDraftState[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const [suggested, setSuggested] = useState<string[]>([]);
  const [busy, setBusy] = useState<'logo' | 'icon' | 'background' | null>(null);
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
    accent_text: draft.ink,
  };
  const changed = canEdit && (Object.keys(patch) as (keyof typeof patch)[]).some((k) => (patch[k] ?? null) !== (row[k] ?? null));

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

  const removeBackground = async () => {
    if (!draft.logoUrl) return;
    setBusy('background');
    setMessage(null);
    try {
      const url = await removeLogoBackground(row.id, draft.logoUrl);
      if (url) set('logoUrl')(url);
      else setMessage('Background removal isn’t available yet. For now, upload a PNG with a transparent background.');
    } finally {
      setBusy(null);
    }
  };

  const accent = normalizeHex(draft.accent);
  const look = {
    id: row.id,
    name: row.name,
    logoUrl: draft.logoUrl,
    iconUrl: draft.iconUrl,
    shortName: draft.shortName,
    accent,
    accentText: draft.ink,
    displayFace: draft.face,
    groundTint: usableGroundTint(normalizeHex(draft.tint)),
  };
  // What buttons use when the venue hasn't picked: whichever ink reads better.
  const autoInk: AccentInk = accentFill(accent ?? DEFAULT_ACCENT, ACCENT_INK.ink, ACCENT_INK.cream).text === ACCENT_INK.ink ? 'ink' : 'cream';

  const settings = (
    <View style={styles.form} pointerEvents={canEdit ? 'auto' : 'none'} aria-disabled={!canEdit}>
      <BrandForm
        row={row}
        draft={draft}
        set={set}
        suggested={suggested}
        busy={busy}
        problems={problems}
        effectiveInk={autoInk}
        onUpload={(kind) => void upload(kind)}
        onRemoveBackground={() => void removeBackground()}
        setup={!!setup}
      />
      {message ? <Caption role="status">{message}</Caption> : null}
    </View>
  );

  const preview = setup ? (
    <View style={[styles.preview, wide && styles.setupSide, wide && sticky]}>
      {wide ? <SectionHeading>Live preview</SectionHeading> : null}
      <BrandPreview look={look} setup />
    </View>
  ) : (
    <View style={[styles.preview, wide && styles.previewSide, wide && sticky]}>
      <SectionHeading>Live preview</SectionHeading>
      <Surface>
        <BrandPreview look={look} stacked={wide} />
      </Surface>
    </View>
  );

  if (setup) {
    const ok = Object.keys(problems).length === 0 && !busy;
    const saveThen = (then: () => void) => (changed ? save.mutate(patch, { onSuccess: then, onError: (e) => setMessage(e.message) }) : then());
    return (
      <SetupPage footer={setup.footer({ save: saveThen, saving: save.isPending, ok })}>
        {wide ? (
          <View style={[styles.columns, styles.columnsWide]}>
            {settings}
            {preview}
          </View>
        ) : (
          <>
            {preview}
            {settings}
          </>
        )}
      </SetupPage>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: frame.top, paddingBottom: insets.bottom + space.xxxl }}
      >
        <View style={[frame.column, styles.page]}>
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
          maxWidth={frame.column.maxWidth as number}
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

/** The Look step of venue setup: the brand editor without the page around it or the home-screen icon (that stays on Brand). */
export function BrandSetup({ barId, setup }: { barId: string; setup: BrandSetupMode }) {
  const brand = useVenueBrand(barId);
  if (!brand.data) return <SetupPage>{brand.error ? <Body tone="muted">Couldn’t load this venue’s brand. Try again in a moment.</Body> : null}</SetupPage>;
  return <BrandEditor key={brand.data.id} row={brand.data} canEdit header={() => null} setup={setup} />;
}

/** Brand settings for a venue, with a live preview. Admins edit; others can look. */
export function BrandScreen({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const frame = usePageFrame('text');
  const brand = useVenueBrand(barId);
  const capabilities = useCapabilities(barId);
  const canEdit = (capabilities.data ?? []).includes('brand');

  // Wide web: the "Venue settings" crumb over the title instead of Back (the sidebar is there).
  const { setViewAsRoleLevel, isSaving } = useViewAs();
  // Preview as staff: the app as a Bartender sees it, with the banner to come back.
  const previewAsStaff = async () => {
    await setViewAsRoleLevel(STAFF_PREVIEW);
    router.navigate('/');
  };
  const header = (dirty: boolean) => (
    <SubPageHead
      title="Brand"
      subtitle={brand.data ? `${brand.data.name} · seen by everyone at the venue` : ' '}
      crumbs={[{ label: 'Venue settings', href: `/settings/bar/${barId}` as Href }]}
      trailing={canEdit && !dirty ? <Button label="Preview as staff" icon="eye" variant="secondary" disabled={isSaving} onPress={() => void previewAsStaff()} /> : null}
      onBack={async () => {
        if (!(await confirmDiscardChanges(dirty))) return;
        if (router.canGoBack()) router.back();
        else router.replace('/settings' as never);
      }}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Brand</title>
      </WebHead>
      {brand.data ? (
        <BrandEditor key={brand.data.id} row={brand.data} canEdit={canEdit} header={header} />
      ) : (
        <View style={[frame.column, styles.page, { paddingHorizontal: gutter, paddingTop: frame.top }]}>
          {header(false)}
          {brand.error ? <Body tone="muted">Couldn’t load this venue’s brand. Try again in a moment.</Body> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.xl },
  columns: { gap: space.xl },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  form: { flex: 1, gap: space.xl, minWidth: 0 },
  preview: { gap: space.sm },
  previewSide: { width: PREVIEW_WIDTH },
  setupSide: { width: SETUP_PREVIEW_WIDTH },
});
