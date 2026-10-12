import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Field, PressableScale, useDs } from '@/components/ds';
import { ChoiceChips } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { radius, space } from '@/constants/tokens';
import type { AccentInk, ContrastLine } from '@/lib/brandColours';

export interface AccentOption {
  name: string;
  hex: string;
  /** Where it came from: "Accent" (the current one), "From your logo", "App default". */
  source: string;
}

const SWATCH = 40;
const INKS = [
  { id: 'cream', label: 'Cream' },
  { id: 'ink', label: 'Ink' },
] as const;

function Card({ selected, label, onPress, children }: { selected: boolean; label: string; onPress: () => void; children: React.ReactNode }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.card, { borderColor: selected ? ds.accentText : ds.c.line, borderWidth: selected ? 2 : 1, backgroundColor: ds.c.ground }]}
    >
      {children}
    </PressableScale>
  );
}

/**
 * Colours from your logo: a card per colour with its name, hex and where it
 * came from, then Custom, which opens a hex field. `custom` is true while the
 * accent isn't one of the cards.
 */
export function AccentCards({ options, value, custom, hexDraft, hexError, onPick, onCustom, onHex }: {
  options: AccentOption[];
  value: string | null;
  custom: boolean;
  hexDraft: string;
  hexError?: string;
  onPick: (hex: string) => void;
  onCustom: () => void;
  onHex: (text: string) => void;
}) {
  const ds = useDs();
  return (
    <View style={styles.wrap}>
      <View role="radiogroup" accessibilityLabel="Accent colour" style={styles.cards}>
        {options.map((o) => (
          <Card key={o.hex} selected={!custom && o.hex === value} label={`${o.name}, ${o.hex}, ${o.source}`} onPress={() => onPick(o.hex)}>
            <View style={[styles.swatch, { backgroundColor: o.hex, borderColor: ds.c.line }]} />
            <Body numberOfLines={1}>{o.name}</Body>
            <DsText variant="caption" tone="muted" numberOfLines={1}>{o.hex}</DsText>
            <Caption tone="muted" numberOfLines={1}>{o.source}</Caption>
          </Card>
        ))}
        <Card selected={custom} label="Custom, Any hex" onPress={onCustom}>
          <View style={[styles.swatch, styles.customSwatch, { borderColor: ds.c.lineStrong }]}>
            <IconSymbol name="plus" size={16} color={ds.c.muted} />
          </View>
          <Body numberOfLines={1}>Custom</Body>
          <Caption tone="muted" numberOfLines={1}>Pick a colour</Caption>
          <Caption tone="muted" numberOfLines={1}>Any hex</Caption>
        </Card>
      </View>
      {custom ? (
        <Field label="Hex" value={hexDraft} onChangeText={onHex} placeholder="e.g. #D0643B" autoCapitalize="characters" autoCorrect={false} error={hexError} />
      ) : null}
    </View>
  );
}

/** Text on accent: Cream or Ink for button labels and the active tab. `value` is the pick, or what the app picks on its own. */
export function AccentInkChoice({ value, onChange }: { value: AccentInk; onChange: (ink: AccentInk) => void }) {
  return (
    <View style={styles.ink}>
      <View style={styles.flex}>
        <Body>Text on accent</Body>
        <Caption tone="muted">Button labels and the active tab</Caption>
      </View>
      <ChoiceChips label="Text on accent" options={INKS} value={value} onChange={onChange} />
    </View>
  );
}

/** The contrast check under Ground tint: one line per pairing, each with Passes or what the app does instead. */
export function ContrastCheck({ lines }: { lines: ContrastLine[] }) {
  const ds = useDs();
  return (
    <View style={styles.wrap}>
      <Caption tone="muted" role="heading" style={styles.kicker}>CONTRAST CHECK</Caption>
      <View role="list" aria-label="Contrast check">
        {lines.map((l) => (
          <View key={l.label} role="listitem" style={[styles.line, { borderBottomColor: ds.c.line }]}>
            <DsText variant="spec" style={styles.ratio}>{l.ratio}</DsText>
            <View style={styles.flex}>
              <Body>{l.label}</Body>
              <Caption color={l.passes ? ds.c.muted : STATUS.warning}>{l.verdict}</Caption>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingVertical: space.sm },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { flexBasis: 140, flexGrow: 1, maxWidth: 200, gap: 2, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: radius.control, borderWidth: 1, marginBottom: space.sm },
  customSwatch: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  ink: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  flex: { flex: 1, minWidth: 160, gap: 2 },
  kicker: { letterSpacing: 0.8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  ratio: { width: 72 },
});
