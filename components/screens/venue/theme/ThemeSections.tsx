import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, Segmented, Sheet, SheetScrollView, useDisplayFaces, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { ControlRow, RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { faceInfo } from '@/constants/faceInfo';
import { DEFAULT_ACCENT, nameStyle, radius, space, type } from '@/constants/tokens';
import { useLogoColours } from '@/hooks/useLogoColours';
import { pickPhotoColours, type VenueBrandRow } from '@/hooks/useVenueBrand';
import { normalizeHex } from '@/lib/brand';
import { colourName } from '@/lib/brandColours';
import { groundOf, groundTintFor, type Ground } from '@/lib/palette';
import { BAR_COLOURS } from '@/constants/barColours';

import { IconPart, logoColoursFor, SHORT_NAME_MAX, type BrandDraftState } from '../BrandForm';
import type { BrandLook } from '../BrandPreview';
import { LogoRow } from '../BrandSections';
import { ColourSheet } from './ColourSheet';
import { TypeSheet } from './TypeSheet';

export const GROUNDS: { value: Ground; label: string }[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'hint', label: 'A hint' },
  { value: 'rich', label: 'Rich' },
];

export interface ThemePartProps {
  row: VenueBrandRow;
  draft: BrandDraftState;
  set: <K extends keyof BrandDraftState>(key: K) => (value: BrandDraftState[K]) => void;
  suggested: string[];
  busy: 'logo' | 'icon' | 'background' | null;
  problems: Partial<Record<'accent' | 'groundTint' | 'shortName', string>>;
  onUpload: (kind: 'logo' | 'icon') => void;
  onRemoveBackground: () => void;
  /** The draft as the previews draw it. */
  look: BrandLook;
}

/** Colour's parts, for the phone's section and Android's rows: the colour, where it came from, Background, and its sheet. */
export function useColourPart({ row, draft, set, suggested, problems }: ThemePartProps) {
  const [open, setOpen] = useState(false);
  const accent = normalizeHex(draft.accent);
  const current = accent ?? DEFAULT_ACCENT;
  const ground = groundOf(current, normalizeHex(draft.tint));
  // The logo's colours and where each sits in it, read from its pixels.
  const logo = useLogoColours(draft.logoUrl, logoColoursFor(row, draft.logoUrl, suggested));
  const bar = BAR_COLOURS.find((c) => c.hex === accent);
  return {
    current,
    ground,
    name: accent ? (bar?.name ?? colourName(accent)) : 'Not picked yet',
    from: !accent ? 'The app’s own amber until you pick one' : logo.colours.includes(accent) ? 'From your logo' : bar ? 'A bar colour' : 'Your own',
    note: `${accent ? (bar?.name ?? colourName(accent)) : 'Your colour'} goes on the one main button and on what’s selected. Drink pages keep each drink’s own colour.`,
    // A grey can't tint anything, so it only gets Neutral.
    grounds: groundTintFor(current, 'hint') ? GROUNDS : GROUNDS.slice(0, 1),
    setGround: (g: Ground) => set('tint')(groundTintFor(current, g) ?? ''),
    problem: problems.accent ?? problems.groundTint,
    open: () => setOpen(true),
    sheet: (
      <ColourSheet
        visible={open}
        onClose={() => setOpen(false)}
        accent={accent}
        ground={ground ?? 'hint'}
        logoUrl={draft.logoUrl}
        logo={logo}
        onPhoto={() => pickPhotoColours(row.id)}
        onUse={(hex) => {
          setOpen(false);
          set('accent')(hex);
          set('tint')(groundTintFor(hex, ground ?? 'hint') ?? '');
        }}
      />
    ),
  };
}

/** Colour (canvas Theme-flow-2): the one colour and where it came from, opening the Colour sheet, then Background. */
export function ColourSection(props: ThemePartProps) {
  const c = useColourPart(props);
  return (
    <SettingsSection title="Colour" note={c.note}>
      <SettingsRow label={c.name} detail={c.from} leading={<View style={[styles.swatch, { backgroundColor: c.current }]} />} onPress={c.open} />
      <RowDivider />
      <ControlRow label="Background" detail={c.ground ? undefined : 'An older tint. Pick one to change it.'}>
        <Segmented variant="pill" choice accessibilityLabel="Background" options={c.grounds} value={c.ground ?? ('' as Ground)} onChange={c.setGround} />
      </ControlRow>
      {c.problem ? <Caption tone="accent" role="alert" style={styles.pad}>{c.problem}</Caption> : null}
      {c.sheet}
    </SettingsSection>
  );
}

/** Type's parts: the face's line and its sheet. */
export function useTypePart({ draft, set, look }: ThemePartProps) {
  const [open, setOpen] = useState(false);
  const family = useDisplayFaces([draft.face]);
  const f = faceInfo[draft.face];
  return {
    nameStyle: { ...nameStyle(draft.face, type.title), fontFamily: family(draft.face) },
    line: `${f.style} · ${f.label} · ${f.by}`,
    label: `Type, ${f.label}`,
    open: () => setOpen(true),
    sheet: (
      <TypeSheet
        visible={open}
        onClose={() => setOpen(false)}
        look={look}
        value={draft.face}
        onUse={(face) => {
          setOpen(false);
          set('face')(face);
        }}
      />
    ),
  };
}

/** Type (Theme-flow-2): the bar's name in its face, opening the faces. */
export function TypeSection(props: ThemePartProps) {
  const ds = useDs();
  const t = useTypePart(props);
  return (
    <SettingsSection title="Type" note="For names: your bar, its drinks and its menus. Amounts, allergens and buttons stay in the app’s type.">
      <PressableScale role="button" accessibilityLabel={t.label} onPress={t.open} style={styles.typeRow}>
        <View style={styles.flex}>
          <DsText variant="title" numberOfLines={1} style={t.nameStyle}>{props.row.name}</DsText>
          <Caption tone="muted">{t.line}</Caption>
        </View>
        <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
      </PressableScale>
      {t.sheet}
    </SettingsSection>
  );
}

/** Logo and icon's sheets: the logo with Replace, and the home-screen icon with its name. */
export function useLogoPart({ row, draft, set, busy, problems, onUpload, onRemoveBackground }: ThemePartProps) {
  const [open, setOpen] = useState<'logo' | 'icon' | null>(null);
  const close = () => setOpen(null);
  const accent = normalizeHex(draft.accent);
  return {
    mark: (size: number) => <VenueMark venue={{ id: row.id, name: row.name, logoUrl: draft.logoUrl, accent, displayFace: draft.face, groundTint: null, roleLevel: 40 }} size={size} />,
    iconName: draft.shortName.trim() || row.name.slice(0, SHORT_NAME_MAX),
    open: setOpen,
    sheets: (
      <>
        <Sheet visible={open === 'logo'} onClose={close} accessibilityLabel="Logo">
          <SheetScrollView contentContainerStyle={styles.sheet}>
            <DsText variant="title">Logo</DsText>
            <LogoRow
              venue={{ id: row.id, name: row.name, accent }}
              logoUrl={draft.logoUrl}
              busy={busy}
              onPick={() => onUpload('logo')}
              onRemoveBackground={onRemoveBackground}
              onRemove={() => set('logoUrl')(null)}
              onUseOriginal={set('logoUrl')}
            />
            <Button label="Done" onPress={close} />
          </SheetScrollView>
        </Sheet>
        <Sheet visible={open === 'icon'} onClose={close} accessibilityLabel="Home-screen icon" keyboard>
          <SheetScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
            <DsText variant="title">Home-screen icon</DsText>
            <Caption tone="muted">What staff see when they add your staff link to their home screen.</Caption>
            <IconPart {...{ row, draft, set, busy, problems, onUpload }} />
            <Button label="Done" onPress={close} disabled={!!problems.shortName} />
          </SheetScrollView>
        </Sheet>
      </>
    ),
  };
}

/** Logo and icon (Theme-flow-2): the logo with Replace, and the home-screen icon with its name, each opening its sheet. */
export function LogoSection(props: ThemePartProps) {
  const l = useLogoPart(props);
  return (
    <SettingsSection title="Logo and icon">
      <SettingsRow label="Logo" leading={l.mark(32)} trailing={<Body tone="muted">{props.draft.logoUrl ? 'Replace' : 'Add'}</Body>} onPress={() => l.open('logo')} />
      <RowDivider />
      <SettingsRow label="Home-screen icon" value={l.iconName} onPress={() => l.open('icon')} />
      {l.sheets}
    </SettingsSection>
  );
}

const SWATCH = 28;

const styles = StyleSheet.create({
  swatch: { width: SWATCH, height: SWATCH, borderRadius: radius.pill },
  pad: { paddingHorizontal: space.lg, paddingBottom: space.md },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  flex: { flex: 1, minWidth: 0 },
  sheet: { gap: space.lg, padding: space.lg, paddingBottom: space.xxxl },
});
