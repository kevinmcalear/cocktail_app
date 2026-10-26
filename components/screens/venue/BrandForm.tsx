import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field, useDs } from '@/components/ds';
import { SectionHeading, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { DEFAULT_ACCENT, GROUND_TINTS, space, type DisplayFace } from '@/constants/tokens';
import type { VenueBrandRow } from '@/hooks/useVenueBrand';
import { normalizeHex, usableGroundTint } from '@/lib/brand';
import { colourName, contrastLines, type AccentInk } from '@/lib/brandColours';

import { AccentCards, AccentInkChoice, ContrastCheck, type AccentOption } from './BrandColours';
import { IconChoices, type IconBackground } from './BrandIcon';
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
  iconBackground: IconBackground | null;
}

/** The accent cards: the current accent, colours from the logo, and the app's default, each once. */
export function accentOptions(row: VenueBrandRow, suggested: string[], withDefault: boolean): AccentOption[] {
  const named = [
    { hex: row.primary_color, source: 'Accent' },
    ...suggested.map((hex) => ({ hex, source: 'From your logo' })),
    { hex: row.secondary_color, source: 'From your logo' },
    ...(withDefault ? [{ hex: DEFAULT_ACCENT, source: 'App default' }] : []),
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
 * check, Font, and the home-screen name and icon.
 */
export function BrandForm({ row, draft, set, suggested, busy, problems, effectiveInk, onUpload, onRemoveBackground, setup }: {
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
  /**
   * Venue setup's Look step (canvas make-venue-look): Logo, Colours, Display
   * face, then Ground tint; the app default, Text on accent and the
   * home-screen icon stay on Brand.
   */
  setup?: boolean;
}) {
  const ds = useDs();
  const options = accentOptions(row, suggested, !setup);
  const accent = normalizeHex(draft.accent);
  const custom = draft.custom || (!!draft.accent.trim() && !options.some((o) => o.hex === accent));
  const tint = usableGroundTint(normalizeHex(draft.tint));
  const shortCount = draft.shortName.trim().length;

  const tintSection = (
    <SettingsSection title="Ground tint" note={setup ? 'A tint behind everything in dark mode.' : 'A tint behind everything in dark mode. Tints too light for text are refused.'}>
      <View style={styles.fields}>
        <Swatches
          label="Ground tint"
          options={[{ label: 'Standard', hex: null }, ...GROUND_TINTS.map((t) => ({ label: t.label, hex: t.hex }))]}
          value={normalizeHex(draft.tint)}
          onChange={(hex) => set('tint')(hex ?? '')}
        />
        {problems.groundTint ? <Caption tone="accent" role="alert">{problems.groundTint}</Caption> : null}
        {accent && !setup ? <ContrastCheck lines={contrastLines(accent, tint, draft.ink)} /> : null}
      </View>
    </SettingsSection>
  );

  return (
    <>
      <SettingsSection title="Logo" note={setup ? 'A photo, a PNG or an SVG. We suggest colours from it.' : 'Picking a logo suggests colours from it.'}>
        <LogoRow
          venue={{ id: row.id, name: row.name, accent }}
          logoUrl={draft.logoUrl}
          busy={busy}
          onPick={() => onUpload('logo')}
          onRemoveBackground={onRemoveBackground}
          onRemove={() => set('logoUrl')(null)}
          onUseOriginal={set('logoUrl')}
        />
      </SettingsSection>

      <SettingsSection
        title="Colours from your logo"
        note={
          setup
            ? 'The accent goes on the one main button, the active tab and what’s selected, nowhere else. Colours too light for text are refused.'
            : 'The accent goes on the one main button, the active tab and what’s selected, nowhere else. Light mode uses a deeper shade when it needs one.'
        }
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
        {setup ? null : <AccentInkChoice value={draft.ink ?? effectiveInk} accent={accent} onChange={set('ink')} />}
      </SettingsSection>

      {setup ? null : tintSection}

      {setup ? (
        // Setup draws the faces straight on the page, no card around them (canvas make-venue-look).
        <View style={styles.section}>
          <SectionHeading>Font</SectionHeading>
          <FaceChoices setup name={row.name} value={draft.face} onChange={set('face')} />
          <Caption tone="muted" style={styles.note}>For drink names, menu names and big titles like Tonight. Body text, specs and numbers stay fixed.</Caption>
        </View>
      ) : (
        <SettingsSection
          title="Font"
          note="For drink names, menu names and big titles like Tonight. Body text, specs and numbers stay fixed so they stay readable."
        >
          <FaceChoices name={row.name} value={draft.face} onChange={set('face')} />
        </SettingsSection>
      )}

      {setup ? tintSection : (
        <SettingsSection title="Home-screen icon" note="What staff see when they add your staff link to their home screen.">
          <View style={styles.fields}>
            {draft.iconUrl ? null : (
              <IconChoices
                look={{ name: row.name, logoUrl: draft.logoUrl, accent, groundTint: tint, displayFace: draft.face }}
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
        </SettingsSection>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.md, paddingVertical: space.md },
  // Matches SettingsSection's spacing for the one group setup draws without a card.
  section: { gap: space.sm },
  note: { paddingHorizontal: space.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
