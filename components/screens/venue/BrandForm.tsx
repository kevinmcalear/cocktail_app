import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field, useDs } from '@/components/ds';
import { SectionHeading, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { space, type DisplayFace } from '@/constants/tokens';
import type { VenueBrandRow } from '@/hooks/useVenueBrand';
import { normalizeHex, usableGroundTint } from '@/lib/brand';
import { colourName } from '@/lib/brandColours';
import { palettesFor, type Palette } from '@/lib/palette';

import { ColourPicker } from './BrandColours';
import { IconChoices, type IconBackground } from './BrandIcon';
import { FaceChoices, LogoRow } from './BrandSections';

export const SHORT_NAME_MAX = 12;

export interface BrandDraftState {
  logoUrl: string | null;
  iconUrl: string | null;
  accent: string;
  face: DisplayFace;
  tint: string;
  shortName: string;
  iconBackground: IconBackground | null;
}

/** The logo's colours: fresh from an upload, else the one saved from it; none without a logo. */
export function logoColoursFor(row: VenueBrandRow, logoUrl: string | null, suggested: string[]): string[] {
  // A fresh upload's colours replace the saved logo colour, which came from the old logo.
  return logoUrl ? (suggested.length ? suggested : [row.secondary_color]).flatMap((hex) => normalizeHex(hex ?? '') ?? []) : [];
}

/** The palettes on offer: the logo's colours first, then the bar colours. */
export function brandPalettes(row: VenueBrandRow, logoUrl: string | null, suggested: string[]): Palette[] {
  return palettesFor(logoColoursFor(row, logoUrl, suggested), colourName);
}

/** Colours (Kevin, 28 Oct, option B) with any problem saving them. */
export function ColoursPart({ row, draft, set, suggested, problems }: Pick<FormProps, 'row' | 'draft' | 'set' | 'suggested' | 'problems'>) {
  return (
    <>
      <ColourPicker
        accent={normalizeHex(draft.accent)}
        tint={normalizeHex(draft.tint)}
        palettes={brandPalettes(row, draft.logoUrl, suggested)}
        onChange={(c) => {
          set('accent')(c.accent);
          set('tint')(c.tint ?? '');
        }}
      />
      {problems.accent || problems.groundTint ? <Caption tone="accent" role="alert">{problems.accent ?? problems.groundTint}</Caption> : null}
    </>
  );
}

interface FormProps {
  row: VenueBrandRow;
  draft: BrandDraftState;
  set: <K extends keyof BrandDraftState>(key: K) => (value: BrandDraftState[K]) => void;
  suggested: string[];
  busy: 'logo' | 'icon' | 'background' | null;
  problems: Partial<Record<'accent' | 'groundTint' | 'shortName', string>>;
  onUpload: (kind: 'logo' | 'icon') => void;
  onRemoveBackground: () => void;
}

/** Venue setup's Look step on wide screens (canvas make-venue-look): Logo, Colours, Font. The home-screen icon is on Theme. */
export function BrandForm({ row, draft, set, suggested, busy, problems, onUpload, onRemoveBackground }: FormProps) {
  return (
    <>
      <SettingsSection title="Logo" note="A photo, a PNG or an SVG. We suggest colours from it.">
        <LogoRow
          venue={{ id: row.id, name: row.name, accent: normalizeHex(draft.accent) }}
          logoUrl={draft.logoUrl}
          busy={busy}
          onPick={() => onUpload('logo')}
          onRemoveBackground={onRemoveBackground}
          onRemove={() => set('logoUrl')(null)}
          onUseOriginal={set('logoUrl')}
        />
      </SettingsSection>

      <SettingsSection title="Colours" note="Your colour goes on the one main button, the active tab and what’s selected. The background tints everything else, in dark and light mode.">
        <ColoursPart {...{ row, draft, set, suggested, problems }} />
      </SettingsSection>

      {/* Setup draws the faces straight on the page, no card around them (canvas make-venue-look). */}
      <View style={styles.section}>
        <SectionHeading>Font</SectionHeading>
        <FaceChoices setup name={row.name} value={draft.face} onChange={set('face')} />
        <Caption tone="muted" style={styles.note}>For drink names, menu names and big titles like Tonight. Body text, specs and numbers stay fixed.</Caption>
      </View>
    </>
  );
}

/** The home-screen icon (Theme's Logo and icon): a background for the logo unless there's an icon of its own, its name, and an icon of its own. */
export function IconPart({ row, draft, set, busy, problems, onUpload }: Pick<FormProps, 'row' | 'draft' | 'set' | 'busy' | 'problems' | 'onUpload'>) {
  const ds = useDs();
  const shortCount = draft.shortName.trim().length;
  return (
    <View style={styles.fields}>
      {draft.iconUrl ? null : (
        <IconChoices
          look={{ name: row.name, logoUrl: draft.logoUrl, accent: normalizeHex(draft.accent), groundTint: usableGroundTint(normalizeHex(draft.tint)), displayFace: draft.face }}
          value={draft.iconBackground}
          onChange={set('iconBackground')}
        />
      )}
      <Field
        label="Home-screen name"
        value={draft.shortName}
        onChangeText={set('shortName')}
        placeholder={row.name.slice(0, SHORT_NAME_MAX)}
        maxLength={SHORT_NAME_MAX}
        error={problems.shortName}
        hint={`${shortCount} of ${SHORT_NAME_MAX} characters. iOS cuts names off at about ${SHORT_NAME_MAX} characters.`}
      />
      <View style={styles.row}>
        <Button
          label={busy === 'icon' ? 'Uploading…' : draft.iconUrl ? 'Replace your icon' : 'Upload your own icon'}
          icon="photo"
          variant="secondary"
          disabled={!!busy}
          onPress={() => onUpload('icon')}
        />
        {draft.iconUrl ? <Button label="Use the logo" variant="ghost" onPress={() => set('iconUrl')(null)} /> : null}
      </View>
      {draft.iconUrl ? null : <Caption color={ds.c.muted}>Without an icon of its own, the logo is used.</Caption>}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.md },
  // Matches SettingsSection's spacing for the one group setup draws without a card.
  section: { gap: space.sm },
  note: { paddingHorizontal: space.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
