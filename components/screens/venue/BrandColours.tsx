import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, BrandProvider, Button, Caption, DsText, Field, PressableScale, Sheet, SheetScrollView, useDs } from '@/components/ds';
import { ColourWheel } from '@/components/ds/ColourWheelLazy';
import { DEFAULT_ACCENT, fontFamilies, radius, space } from '@/constants/tokens';
import { normalizeHex } from '@/lib/brand';
import { colourName } from '@/lib/brandColours';
import { groundOf, groundTintFor, neutralsFor, shadeNotes, type Ground, type Palette } from '@/lib/palette';

const GROUNDS: { id: Ground; label: string; note: string }[] = [
  { id: 'neutral', label: 'Neutral', note: 'Warm grey' },
  { id: 'hint', label: 'A hint', note: 'Tinted' },
  { id: 'rich', label: 'Rich', note: 'Deep tint' },
];

/** A venue's colour and its saved dark ground (bars.primary_color, bars.ground_tint). */
export interface ColourChoice {
  accent: string;
  tint: string | null;
}

/**
 * Colours as Kevin picked them (28 Oct, option B): palettes first, each a
 * colour and a background together; Make your own colour opens the wheel in
 * a sheet and adds a Your own colour tile; then Background, Neutral, A hint
 * or Rich, built from whichever colour is picked. Notes show only when a
 * mode shifts the colour so text stays readable.
 */
export function ColourPicker({ accent, tint, palettes, onChange }: { accent: string | null; tint: string | null; palettes: Palette[]; onChange: (c: ColourChoice) => void }) {
  const ds = useDs();
  const current = accent ?? DEFAULT_ACCENT;
  const ground = groundOf(current, tint);
  const picked = palettes.find((p) => p.accent === current);
  const name = picked?.name ?? colourName(current);
  // A grey can't tint anything, so it only gets Neutral.
  const grounds = groundTintFor(current, 'hint') ? GROUNDS : GROUNDS.slice(0, 1);
  const [sheet, setSheet] = useState(false);

  return (
    <View style={styles.wrap}>
      <View role="radiogroup" aria-label="Palettes" style={styles.grid}>
        {palettes.map((p) => {
          const look = neutralsFor(ds.scheme, groundTintFor(p.accent, p.ground));
          const selected = p === picked;
          return (
            <PressableScale
              key={p.accent}
              role="radio"
              aria-checked={selected}
              accessibilityLabel={`${p.name} palette`}
              onPress={() => onChange({ accent: p.accent, tint: groundTintFor(p.accent, p.ground) })}
              style={[styles.palette, { backgroundColor: look.ground, borderColor: selected ? ds.c.ink : look.line, borderWidth: selected ? 2 : 1 }]}
            >
              <View style={styles.bars}>
                {[p.accent, look.surface, look.raised].map((c, i) => (
                  <View key={i} style={[styles.bar, { backgroundColor: c }]} />
                ))}
              </View>
              <Body color={look.ink} numberOfLines={1} style={styles.bold}>{p.name}</Body>
            </PressableScale>
          );
        })}
      </View>

      {picked ? (
        <Button label="Make your own colour" icon="plus" variant="secondary" onPress={() => setSheet(true)} />
      ) : (
        <PressableScale
          role="radio"
          aria-checked
          accessibilityLabel={`Your own colour, ${current}. Edit`}
          onPress={() => setSheet(true)}
          style={[styles.own, { borderColor: ds.c.ink, backgroundColor: ds.c.raised }]}
        >
          <View style={[styles.ownSwatch, { backgroundColor: current, borderColor: ds.c.line }]} />
          <View style={styles.flex}>
            <Body style={styles.bold}>Your own colour</Body>
            <DsText variant="caption" tone="muted" style={styles.mono}>{current}</DsText>
          </View>
          <Body style={styles.bold}>Edit</Body>
        </PressableScale>
      )}

      <Caption tone="muted" role="heading" style={styles.kicker}>BACKGROUND</Caption>
      <View role="radiogroup" aria-label="Background" style={styles.grounds}>
        {grounds.map((g) => {
          const look = neutralsFor(ds.scheme, groundTintFor(current, g.id));
          const selected = ground === g.id;
          return (
            <PressableScale
              key={g.id}
              role="radio"
              aria-checked={selected}
              accessibilityLabel={`${g.label}, ${g.note}`}
              onPress={() => onChange({ accent: current, tint: groundTintFor(current, g.id) })}
              style={[styles.groundChoice, grounds.length === 1 && styles.oneGround]}
            >
              <View style={[styles.groundSwatch, { backgroundColor: look.ground, borderColor: selected ? ds.c.ink : ds.c.line, borderWidth: selected ? 2 : 1 }]}>
                <View style={[styles.groundCard, { backgroundColor: look.surface }]} />
                <View style={[styles.groundPill, { backgroundColor: current }]} />
              </View>
              <Body style={styles.bold}>{g.label}</Body>
              <Caption tone="muted">{g.note}</Caption>
            </PressableScale>
          );
        })}
      </View>
      {grounds.length === 1 ? <Caption tone="muted">Greys keep a neutral background. Pick a colour to tint it.</Caption> : null}
      {ground ? null : <Caption tone="muted">Your background is an older tint. Pick one of these to change it.</Caption>}
      {shadeNotes(current, tint, name).map((n) => (
        <Caption key={n} tone="muted">{n}</Caption>
      ))}

      <OwnColourSheet
        visible={sheet}
        start={current}
        onClose={() => setSheet(false)}
        onUse={(hex) => {
          setSheet(false);
          onChange({ accent: hex, tint: groundTintFor(hex, ground ?? 'hint') });
        }}
      />
    </View>
  );
}

/**
 * Make your own colour: the wheel, brightness and hex (from option A), then
 * Use this colour, drawn in the colour being picked. It scrolls, so the
 * button can be reached above the keyboard.
 */
function OwnColourSheet({ visible, start, onClose, onUse }: { visible: boolean; start: string; onClose: () => void; onUse: (hex: string) => void }) {
  const [text, setText] = useState(start);
  const hex = normalizeHex(text);
  return (
    <Sheet visible={visible} onClose={onClose} onShow={() => setText(start)} accessibilityLabel="Your own colour" keyboard>
      <SheetScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <DsText variant="title">Your own colour</DsText>
        <ColourWheel value={hex} onChange={setText} />
        <Field
          label="Hex"
          value={text}
          onChangeText={setText}
          placeholder="e.g. #D0643B"
          autoCapitalize="characters"
          autoCorrect={false}
          error={text.trim() && !hex ? 'Use a hex colour like #D0643B.' : undefined}
        />
        <BrandProvider accent={hex ?? start}>
          <Button label="Use this colour" disabled={!hex} onPress={() => hex && onUse(hex)} />
        </BrandProvider>
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingVertical: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  palette: { flexBasis: '30%', flexGrow: 1, minWidth: 0, gap: space.sm, padding: space.sm + 2, borderRadius: radius.control + 2, borderCurve: 'continuous' },
  bars: { flexDirection: 'row', gap: space.xs },
  bar: { flex: 1, height: 22, borderRadius: radius.mark + 1 },
  bold: { fontFamily: fontFamilies.bodySemiBold },
  mono: { fontFamily: fontFamilies.mono },
  own: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm + 2, borderWidth: 2, borderRadius: radius.control + 2, borderCurve: 'continuous' },
  ownSwatch: { width: 40, height: 40, borderRadius: radius.control - 2, borderWidth: 1 },
  flex: { flex: 1, minWidth: 0 },
  kicker: { letterSpacing: 0.8, marginTop: space.sm },
  grounds: { flexDirection: 'row', gap: space.sm },
  groundChoice: { flex: 1, minWidth: 0, gap: 2 },
  oneGround: { flex: 0, width: '32%' },
  groundSwatch: { height: 64, borderRadius: radius.control + 2, borderCurve: 'continuous', padding: space.sm, justifyContent: 'space-between', marginBottom: space.xs },
  groundCard: { height: 18, borderRadius: radius.mark + 2 },
  groundPill: { width: '55%', height: 12, borderRadius: radius.pill },
  sheet: { gap: space.lg, padding: space.lg },
});
