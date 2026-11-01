import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Segmented, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { WebHead } from '@/components/WebHead';
import { space, type BackbarScheme } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useViewAs } from '@/hooks/useViewAs';
import { useVenueBrand, type VenueBrandRow } from '@/hooks/useVenueBrand';
import { confirmDiscardChanges } from '@/lib/dialogs';

import { useBrandDraft } from '../useBrandDraft';
import { ColourSection, LogoSection, TypeSection } from './ThemeSections';
import { MINIS, ThemeMini, ThemeMiniStrip, type MiniKind } from './ThemeMinis';

const SCHEMES: { value: BackbarScheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
/** Preview as staff shows the app as a Bartender sees it. */
const STAFF_PREVIEW = 30;
/** The desktop preview column (canvas Theme-desk): one page, large. */
const PREVIEW_WIDTH = 340;
// The preview stays in view while the settings beside it scroll (web).
// ponytail: position sticky is web-only CSS that RN's ViewStyle doesn't list.
const sticky = Platform.OS === 'web' ? ({ position: 'sticky', top: space.lg } as unknown as ViewStyle) : null;

/**
 * Settings › Theme (canvas GWBCX "themes", Theme-flow-2; Kevin, 31 Oct:
 * renamed from Brand, Admins only): the bar's own pages small on top in Light
 * or Dark, then Colour with Background, Type, Logo and icon, and one Save.
 * Wide screens put one page large beside the settings (Theme-desk).
 */
function ThemeEditor({ row, canEdit, header }: { row: VenueBrandRow; canEdit: boolean; header: (s: { dirty: boolean; save: ReactNode }) => ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const frame = usePageFrame(wide ? 'wide' : 'text');
  const d = useBrandDraft(row, canEdit);
  const [scheme, setScheme] = useState<BackbarScheme>('light');
  const [page, setPage] = useState<MiniKind>('bar');
  const parts = { row, draft: d.draft, set: d.set, suggested: d.suggested, busy: d.busy, problems: d.problems, onUpload: (k: 'logo' | 'icon') => void d.upload(k), onRemoveBackground: () => void d.removeBackground() };
  const save = canEdit ? (
    <Button
      label={d.save.isPending ? 'Saving…' : 'Save'}
      size="sm"
      disabled={!d.changed || !d.ok || d.save.isPending}
      onPress={() => d.save.mutate(d.patch, { onSuccess: d.saved('Saved. Everyone at the venue sees it next time the app loads.'), onError: (e) => d.setMessage(e.message) })}
    />
  ) : null;
  // The app as a Bartender sees it, with the banner to come back (until a preview opens full size with Guest | Staff, Theme-flow-6).
  const { setViewAsRoleLevel, isSaving } = useViewAs();
  const staff =
    canEdit && !d.changed ? (
      <Button
        label="Preview as staff"
        icon="eye"
        variant="ghost"
        size="sm"
        disabled={isSaving}
        onPress={async () => {
          await setViewAsRoleLevel(STAFF_PREVIEW);
          router.navigate('/');
        }}
      />
    ) : null;
  const schemeSwitch = <Segmented variant="pill" choice accessibilityLabel="Preview in" options={SCHEMES} value={scheme} onChange={setScheme} />;

  const settings = (
    <View style={styles.form} pointerEvents={canEdit ? 'auto' : 'none'} aria-disabled={!canEdit}>
      <ColourSection {...parts} />
      <TypeSection {...parts} />
      <LogoSection {...parts} />
      {d.message ? <Caption role="status">{d.message}</Caption> : null}
    </View>
  );

  return (
    <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: frame.top, paddingBottom: insets.bottom + space.xxxl }}>
      <View style={[frame.column, styles.page]}>
        {header({ dirty: d.changed, save })}
        {canEdit ? null : <Body tone="muted">Only Admins change the theme.</Body>}
        {wide ? (
          <View style={styles.columns}>
            {settings}
            <View style={[styles.side, sticky]}>
              <SectionHeading>Preview</SectionHeading>
              <Segmented variant="pill" choice stretch accessibilityLabel="Page" options={MINIS.filter((m) => m.kind !== 'photo').map((m) => ({ value: m.kind, label: m.label.replace('Drink, drawn', 'Drink') }))} value={page} onChange={setPage} />
              {schemeSwitch}
              <ThemeMini kind={page} look={d.look} scheme={scheme} width={PREVIEW_WIDTH} />
              {staff}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.center}>{schemeSwitch}</View>
            <ThemeMiniStrip look={d.look} scheme={scheme} />
            {staff}
            {settings}
          </>
        )}
      </View>
    </ScrollView>
  );
}

/** Theme for a venue. Only Admins (the brand permission) have the row; anyone else opening it can look. */
export function ThemeScreen({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const frame = usePageFrame('text');
  const brand = useVenueBrand(barId);
  const canEdit = (useCapabilities(barId).data ?? []).includes('brand');
  const header = ({ dirty, save }: { dirty: boolean; save: ReactNode }) => (
    <SubPageHead
      title="Theme"
      subtitle={brand.data ? `How ${brand.data.name} looks to guests and staff` : ' '}
      crumbs={[{ label: 'Venue settings', href: `/settings/bar/${barId}` as Href }]}
      trailing={save}
      onBack={async () => {
        if (!(await confirmDiscardChanges(dirty))) return;
        if (router.canGoBack()) router.back();
        else router.replace(`/settings/bar/${barId}` as Href);
      }}
    />
  );
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Theme</title>
      </WebHead>
      {brand.data ? (
        <ThemeEditor key={brand.data.id} row={brand.data} canEdit={canEdit} header={header} />
      ) : (
        <View style={[frame.column, styles.page, { paddingHorizontal: gutter, paddingTop: frame.top }]}>
          {header({ dirty: false, save: null })}
          {brand.error ? <Body tone="muted">Couldn’t load this venue’s theme. Try again in a moment.</Body> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.xl },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  form: { flex: 1, gap: space.xl, minWidth: 0 },
  side: { width: PREVIEW_WIDTH, gap: space.md },
  center: { alignItems: 'center' },
});
