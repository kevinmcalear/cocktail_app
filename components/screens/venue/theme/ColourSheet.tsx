import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandProvider, Caption, DsText, Field, LogoImage, PressableScale, Segmented, Sheet, SheetScrollView, useDs } from '@/components/ds';
import { ColourWheel } from '@/components/ds/ColourWheelLazy';
import { SectionHeading, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BAR_COLOURS, backbar, font, radius, space } from '@/constants/tokens';
import type { LogoColours } from '@/hooks/useLogoColours';
import { normalizeHex } from '@/lib/brand';
import { withAlpha } from '@/lib/color';
import { colourName } from '@/lib/brandColours';
import { useLogoEdge } from '@/lib/logoEdge';
import { logoRect } from '@/lib/logoPins';
import { groundTintFor, neutralsFor, type Ground } from '@/lib/palette';
import { isGrey, notForButton, themeFor } from '@/lib/theme';

import { FlowHead } from './FlowHead';

export type ColourSource = 'logo' | 'own';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The colour now, or null for none yet (the app's own). */
  accent: string | null;
  ground: Ground;
  logoUrl: string | null;
  /** The logo's colours, most of it first, and where each sits in it (useLogoColours). */
  logo: LogoColours;
  onPhoto: () => Promise<string[] | null>;
  onUse: (accent: string) => void;
}

/**
 * Colour (canvas Theme-flow-3, 4 and mono): from your logo, with a pin where
 * each of its colours sits and a tile per colour showing the button on paper
 * and at night, then the six bar colours; or your own on the wheel, with how
 * it reads in both modes and what the rails moved. A black and white logo
 * offers ink, or a colour from a photo of the room. Closing it with a new
 * colour not kept asks "Discard changes?" first.
 */
export function ColourSheet({ visible, onClose, accent, ground, logoUrl, logo, onPhoto, onUse }: Props) {
  const [pick, setPick] = useState(accent);
  const [text, setText] = useState(accent ?? '');
  const [source, setSource] = useState<ColourSource>('logo');
  const [photo, setPhoto] = useState<string[]>([]);
  const own = normalizeHex(text);
  const chosen = source === 'own' ? own : pick;
  const reset = () => {
    setPick(accent);
    setText(accent ?? '');
    setSource(accent && !logo.colours.includes(accent) && !BAR_COLOURS.some((c) => c.hex === accent) ? 'own' : 'logo');
  };
  return (
    <Sheet visible={visible} onClose={onClose} onShow={reset} accessibilityLabel="Colour" kind="flow" keyboard ground phoneFull dirty={chosen !== accent}>
      <BrandProvider accent={chosen ?? undefined}>
        <FlowHead title="Colour" canDone={!!chosen} onDone={() => chosen && onUse(chosen)} />
      </BrandProvider>
      <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Segmented
          variant="pill"
          choice
          stretch
          accessibilityLabel="Colour from"
          options={[{ value: 'logo', label: logoUrl ? 'From your logo' : 'Bar colours' }, { value: 'own', label: 'Your own' }]}
          value={source}
          onChange={setSource}
        />
        {source === 'logo' ? (
          <FromLogo {...{ logoUrl, logo, photo, pick, ground }} onPick={setPick} onPhoto={async () => setPhoto((await onPhoto()) ?? photo)} />
        ) : (
          <YourOwn text={text} onText={setText} hex={own} ground={ground} />
        )}
      </SheetScrollView>
    </Sheet>
  );
}

function FromLogo({ logoUrl, logo, photo, pick, ground, onPick, onPhoto }: { logoUrl: string | null; logo: LogoColours; photo: string[]; pick: string | null; ground: Ground; onPick: (hex: string) => void; onPhoto: () => void }) {
  const ds = useDs();
  const logoColours = logo.colours;
  const mono = !!logoUrl && logoColours.length > 0 && logoColours.every(isGrey);
  const found = [...new Set([...(mono ? logoColours.filter((c) => !notForButton(c)) : logoColours), ...photo])].slice(0, 3);
  const pale = found.find((c) => notForButton(c) === 'Too pale for a button');
  return (
    <View style={styles.part}>
      {logoUrl ? (
        <>
          {/* A black and white logo has no colour to pin (Theme-flow-mono). */}
          <LogoPins uri={logoUrl} logo={logo} shown={mono ? [] : found} />
          <SectionHeading>{mono ? 'Your logo is black and white' : 'From your logo'}</SectionHeading>
          <View role="radiogroup" aria-label="Colours from your logo" style={styles.tiles}>
            {found.map((hex, i) => (
              <LogoTile key={hex} hex={hex} ground={ground} selected={hex === pick} why={notForButton(hex) ?? (isGrey(hex) ? 'Buttons in ink, cream in dark' : i === 0 ? 'The most of your logo' : '')} onPress={() => onPick(hex)} />
            ))}
          </View>
          {mono ? <SettingsRow icon="camera" label="From a photo of your bar" detail="The room, the bar top, the neon sign" role="button" onPress={onPhoto} /> : null}
          <Caption tone="muted">
            {mono
              ? 'There’s no colour in it to pick, so buttons go in ink (cream in dark mode). Or take a colour from a photo of the room.'
              : `We found ${found.length} ${found.length === 1 ? 'colour' : 'colours'}. Each tile shows the button on paper and at night.${pale ? ` ${colourName(pale)} is kept for backgrounds: a button in it would vanish on the paper.` : ''}`}
          </Caption>
        </>
      ) : null}
      <SectionHeading>Bar colours</SectionHeading>
      <View role="radiogroup" aria-label="Bar colours" style={styles.dots}>
        {BAR_COLOURS.map((c) => (
          <PressableScale key={c.hex} role="radio" aria-checked={pick === c.hex} accessibilityLabel={c.name} onPress={() => onPick(c.hex)} style={[styles.dotRing, { borderColor: pick === c.hex ? ds.c.ink : 'transparent' }]}>
            <View style={[styles.dot, { backgroundColor: c.hex }]} />
          </PressableScale>
        ))}
      </View>
      <Caption tone="muted">{logoUrl ? 'Or start from a bar’s colours.' : 'Colours from a bar, to start from. Add a logo to take a colour from it.'}</Caption>
    </View>
  );
}

/** The logo on its card, 180 in a 240 square, with the pins (canvas Theme-flow-3): the logo's main colour larger, each where it sits. */
const CARD = 240;
const LOGO = 180;
const PIN = { main: 30, other: 22, ring: 3 };

function LogoPins({ uri, logo, shown }: { uri: string; logo: LogoColours; shown: string[] }) {
  const ds = useDs();
  const edge = useLogoEdge(uri);
  const rect = logoRect(edge?.kind ?? null, LOGO, logo.aspect);
  const pins = shown.flatMap((hex, i) => {
    const pin = logo.pins.find((p) => p.hex === hex);
    if (!pin) return [];
    const x = rect.left + pin.x * rect.width;
    const y = rect.top + pin.y * rect.height;
    // A cropped (busy) logo can hide a colour's place; no pin off the logo.
    return x < 0 || y < 0 || x > LOGO || y > LOGO ? [] : [{ hex, x, y, size: i === 0 ? PIN.main : PIN.other }];
  });
  return (
    <View role="img" aria-label={pins.length ? `Your logo, with where ${pins.map((p) => colourName(p.hex)).join(', ')} ${pins.length === 1 ? 'sits' : 'sit'} in it` : 'Your logo'} style={[styles.logoCard, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.logoAt}>
        <LogoImage uri={uri} size={LOGO} radius={radius.card} />
        {pins.map((p) => (
          <View key={p.hex} style={[styles.pin, { left: p.x - p.size / 2, top: p.y - p.size / 2, width: p.size, height: p.size, backgroundColor: p.hex }]} />
        ))}
      </View>
    </View>
  );
}

/** A logo colour as the button on paper and at night; a colour that can't be a button is offered faded, with why. */
function LogoTile({ hex, ground, selected, why, onPress }: { hex: string; ground: Ground; selected: boolean; why: string; onPress: () => void }) {
  const ds = useDs();
  const blocked = !!notForButton(hex);
  const tint = groundTintFor(hex, ground);
  const t = themeFor(hex, tint, colourName(hex));
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      aria-disabled={blocked}
      disabled={blocked}
      accessibilityLabel={`${colourName(hex)}${why ? `, ${why}` : ''}`}
      onPress={onPress}
      style={[styles.tile, { borderColor: selected ? ds.c.ink : ds.c.line, borderWidth: selected ? 2 : StyleSheet.hairlineWidth, opacity: blocked ? 0.55 : 1 }]}
    >
      {(['light', 'dark'] as const).map((mode) => (
        <View key={mode} style={[styles.half, { backgroundColor: neutralsFor(mode, tint).ground }]}>
          <View style={[styles.mini, { backgroundColor: blocked ? 'transparent' : t[mode].fill, borderColor: blocked ? neutralsFor(mode, tint).lineStrong : 'transparent' }]}>
            <Caption color={blocked ? neutralsFor(mode, tint).muted : t[mode].onFill} numberOfLines={1}>Rank it</Caption>
          </View>
        </View>
      ))}
      <View style={styles.tileText}>
        <View style={styles.nameRow}>
          {selected ? <IconSymbol name="checkmark" size={14} color={ds.c.ink} /> : null}
          <Caption style={styles.strong} numberOfLines={1}>{colourName(hex)}</Caption>
        </View>
        {why ? <Caption tone="muted" numberOfLines={2}>{why}</Caption> : null}
      </View>
    </PressableScale>
  );
}

/** Your own (Theme-flow-4): the wheel and hex, then how it reads in light and dark, with what the rails moved. */
function YourOwn({ text, onText, hex, ground }: { text: string; onText: (t: string) => void; hex: string | null; ground: Ground }) {
  const tint = hex ? groundTintFor(hex, ground) : null;
  const t = hex ? themeFor(hex, tint, colourName(hex)) : null;
  return (
    <View style={styles.part}>
      <ColourWheel value={hex} onChange={onText} />
      <Field label="Hex" value={text} onChangeText={onText} placeholder="e.g. #D0643B" autoCapitalize="characters" autoCorrect={false} error={text.trim() && !hex ? 'Use a hex colour like #D0643B.' : undefined} />
      {t ? (
        <>
          <SectionHeading>How it reads</SectionHeading>
          <View style={styles.reads}>
            {(['light', 'dark'] as const).map((mode) => {
              const c = neutralsFor(mode, tint);
              return (
                <View key={mode} style={[styles.read, { backgroundColor: c.ground, borderColor: c.line }]}>
                  <Caption color={c.muted}>{mode === 'light' ? 'Light' : 'Dark'}</Caption>
                  <View style={[styles.readButton, { backgroundColor: t[mode].fill }]}>
                    <DsText variant="label" color={t[mode].onFill} style={styles.strong}>Rank it</DsText>
                  </View>
                  <Caption color={t[mode].text} style={styles.strong}>Selected · a link</Caption>
                  <Caption color={c.muted} style={styles.figures}>{`Label ${t[mode].fillRatio.toFixed(1)}:1 · text ${t[mode].textRatio.toFixed(1)}:1`}</Caption>
                </View>
              );
            })}
          </View>
          {t.notes.map((n) => (
            <Caption key={n} tone="muted">{n}</Caption>
          ))}
        </>
      ) : null}
    </View>
  );
}

const DOT = 40;

const styles = StyleSheet.create({
  body: { gap: space.lg, padding: space.lg, paddingBottom: space.xxxl },
  part: { gap: space.md },
  logoCard: { alignSelf: 'center', width: CARD, height: CARD, alignItems: 'center', justifyContent: 'center', borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  logoAt: { width: LOGO, height: LOGO },
  pin: { position: 'absolute', borderRadius: radius.pill, borderWidth: PIN.ring, borderColor: backbar.light.surface, boxShadow: `0 2px 8px ${withAlpha(backbar.dark.ground, 0.35)}`, pointerEvents: 'none' },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minWidth: 0, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
  half: { padding: space.sm, alignItems: 'center' },
  mini: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%' },
  tileText: { padding: space.sm, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  strong: { ...font.semiBold },
  figures: { ...font.figures },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dotRing: { padding: 3, borderWidth: 2, borderRadius: radius.pill },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: backbar.light.line },
  reads: { flexDirection: 'row', gap: space.sm },
  read: { flex: 1, minWidth: 0, gap: space.sm, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  readButton: { alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.pill },
});
