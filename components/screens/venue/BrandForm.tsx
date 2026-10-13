import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field, useDs } from '@/components/ds';
import { SettingsSection } from '@/components/screens/settings/SettingsParts';
import { DEFAULT_ACCENT, GROUND_TINTS, space, type DisplayFace } from '@/constants/tokens';
import type { VenueBrandRow } from '@/hooks/useVenueBrand';
import { normalizeHex, usableGroundTint } from '@/lib/brand';
import { colourName, contrastLines, type AccentInk } from '@/lib/brandColours';

import { AccentCards, AccentInkChoice, ContrastCheck, type AccentOption } from './BrandColours';
import { Swatches } from './BrandPreview';
import { FaceChoices, LogoRow } from './BrandSections';

export const SHORT_NAME_MAX = 12;

export interface BrandDraftState {
  logoUrl: string | null;
  iconUrl: string | null;
  accent: string;
  /** The person tapped Custom: the hex field shows even when the accent matches a card. */
  custom: boolean;
  ink: AccentInk | null;
  face: DisplayFace;
  tint: string;
  shortName: string;
}

/** The accent cards: the current accent, colours from the logo, and the app's default, each once. */
function accentOptions(row: VenueBrandRow, suggested: string[]): AccentOption[] {
  const named = [
    { hex: row.primary_color, source: 'Accent' },
    ...suggested.map((hex) => ({ hex, source: 'From your logo' })),
    { hex: row.secondary_color, source: 'From your logo' },
    { hex: DEFAULT_ACCENT, source: 'App default' },
  ];
  const seen = new Set<string>();
  return named.flatMap((o) => {
    const hex = o.hex ? normalizeHex(o.hex) : null;
    if (!hex || seen.has(hex)) return [];
    seen.add(hex);
    return [{ name: colourName(hex), hex, source: o.source }];
  });
}

/**
 * The brand settings as the canvas draws them (tools-brand-desktop): Logo,
 * Colours from your logo with Text on accent, Ground tint with the contrast
 * check, Display face, and the home-screen name and icon.
 */
export function BrandForm({ row, draft, set, suggested, busy, problems, effectiveInk, onUpload, onRemoveBackground, hideIcon }: {
  row: VenueBrandRow;
  draft: BrandDraftState;
  set: <K extends keyof BrandDraftState>(key: K) => (value: BrandDraftState[K]) => void;
  suggested: string[];
  busy: 'logo' | 'icon' | 'background' | null;
  problems: Partial<Record<'accent' | 'groundTint' | 'shortName', string>>;
  /** What buttons use now: the pick, or the app's own choice. */
  effectiveInk: AccentInk;
  onUpload: (kind: 'logo' | 'icon') => void;
  onRemoveBackground: () => void;
  /** Venue setup's Look step leaves the home-screen icon to Brand. */
  hideIcon?: boolean;
}) {
  const ds = useDs();
  const options = accentOptions(row, suggested);
  const accent = normalizeHex(draft.accent);
  const custom = draft.custom || (!!draft.accent.trim() && !options.some((o) => o.hex === accent));
  const tint = usableGroundTint(normalizeHex(draft.tint));
  const shortCount = draft.shortName.trim().length;

  return (
    <>
      <SettingsSection title="Logo" note="Picking a logo suggests colours from it.">
        <LogoRow
          venue={{ id: row.id, name: row.name, accent }}
          logoUrl={draft.logoUrl}
          busy={busy}
          onPick={() => onUpload('logo')}
          onRemoveBackground={onRemoveBackground}
          onRemove={() => set('logoUrl')(null)}
        />
      </SettingsSection>

      <SettingsSection
        title="Colours from your logo"
        note="The accent goes on the one main button, the active tab and what’s selected, nowhere else. Light mode uses a deeper shade when it needs one."
      >
        <AccentCards
          options={options}
          value={accent}
          custom={custom}
          hexDraft={draft.accent}
          hexError={problems.accent}
          onPick={(hex) => {
            set('custom')(false);
            set('accent')(hex);
          }}
          onCustom={() => set('custom')(true)}
          onHex={set('accent')}
        />
        <AccentInkChoice value={draft.ink ?? effectiveInk} accent={accent} onChange={set('ink')} />
      </SettingsSection>

      <SettingsSection title="Ground tint" note="A tint behind everything in dark mode. Tints too light for text are refused.">
        <View style={styles.fields}>
          <Swatches
            label="Ground tint"
            options={[{ label: 'Standard', hex: null }, ...GROUND_TINTS.map((t) => ({ label: t.label, hex: t.hex }))]}
            value={normalizeHex(draft.tint)}
            onChange={(hex) => set('tint')(hex ?? '')}
          />
          {problems.groundTint ? <Caption tone="accent" role="alert">{problems.groundTint}</Caption> : null}
          {accent ? <ContrastCheck lines={contrastLines(accent, tint, draft.ink)} /> : null}
        </View>
      </SettingsSection>

      <SettingsSection title="Display face" note="For drink names, menu names and big titles like Tonight. Body text, specs and numbers stay fixed so they stay readable.">
        <FaceChoices name={row.name} value={draft.face} onChange={set('face')} />
      </SettingsSection>

      {hideIcon ? null : (
        <SettingsSection title="Home-screen icon" note="What staff see when they add your staff link to their home screen.">
          <View style={styles.fields}>
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
        </SettingsSection>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.md, paddingVertical: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
