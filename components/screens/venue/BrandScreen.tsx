import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { Body, Caption } from '@/components/ds';
import { usePageFrame } from '@/components/nav/PageFrame';
import { SetupPage } from '@/components/screens/onboarding/SetupPage';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import { useVenueBrand, type VenueBrandRow } from '@/hooks/useVenueBrand';

import { BrandForm } from './BrandForm';
import { BrandPreview } from './BrandPreview';
import { SetupLook, type LookPage } from './BrandSetupPager';
import { useBrandDraft } from './useBrandDraft';

/** Venue setup's preview column on wide web: one phone (canvas make-venue-desktop). */
const SETUP_PREVIEW_WIDTH = 260;
// The preview column stays in view while the settings beside it scroll (web).
// ponytail: position sticky is web-only CSS that RN's ViewStyle doesn't list.
const sticky = Platform.OS === 'web' ? ({ position: 'sticky', top: space.lg } as unknown as ViewStyle) : null;

/** Venue setup's Look step (canvas make-venue-look): this editor, saved by the step's Continue. On a phone, `page` walks its parts (E34). */
export interface BrandSetupMode {
  footer: (s: { save: (then: () => void) => void; saving: boolean; ok: boolean; page?: LookPage }) => ReactNode;
}

/**
 * The Look step's editor: the preview above the settings on phones, beside
 * them on wide web (canvas make-venue-desktop). Settings › Theme is
 * components/screens/venue/theme/ThemeScreen.
 */
function BrandEditor({ row, setup }: { row: VenueBrandRow; setup: BrandSetupMode }) {
  const frame = usePageFrame('text');
  const d = useBrandDraft(row, true);
  const saveThen = (then: () => void) => (d.changed ? d.save.mutate(d.patch, { onSuccess: d.saved('', then), onError: (e) => d.setMessage(e.message) }) : then());

  if (!frame.wide) {
    return (
      <SetupLook
        {...{ row, look: d.look, draft: d.draft, set: d.set, suggested: d.suggested, busy: d.busy, problems: d.problems, message: d.message }}
        onUpload={() => void d.upload('logo')}
        onRemoveBackground={() => void d.removeBackground()}
        footer={(page) => setup.footer({ save: saveThen, saving: d.save.isPending, ok: d.ok, page })}
      />
    );
  }
  return (
    <SetupPage footer={setup.footer({ save: saveThen, saving: d.save.isPending, ok: d.ok })}>
      <View style={styles.columns}>
        <View style={styles.form}>
          <BrandForm
            row={row}
            draft={d.draft}
            set={d.set}
            suggested={d.suggested}
            busy={d.busy}
            problems={d.problems}
            onUpload={(kind) => void d.upload(kind)}
            onRemoveBackground={() => void d.removeBackground()}
          />
          {d.message ? <Caption role="status">{d.message}</Caption> : null}
        </View>
        <View style={[styles.preview, sticky]}>
          <SectionHeading>Preview</SectionHeading>
          <BrandPreview look={d.look} />
        </View>
      </View>
    </SetupPage>
  );
}

/** The Look step of venue setup: the theme editor without the page around it or the home-screen icon (that stays on Theme). */
export function BrandSetup({ barId, setup }: { barId: string; setup: BrandSetupMode }) {
  const brand = useVenueBrand(barId);
  if (!brand.data) return <SetupPage>{brand.error ? <Body tone="muted">Couldn’t load this venue’s theme. Try again in a moment.</Body> : null}</SetupPage>;
  return <BrandEditor key={brand.data.id} row={brand.data} setup={setup} />;
}

const styles = StyleSheet.create({
  columns: { gap: space.xl, flexDirection: 'row', alignItems: 'flex-start' },
  form: { flex: 1, gap: space.xl, minWidth: 0 },
  preview: { gap: space.sm, width: SETUP_PREVIEW_WIDTH },
});
