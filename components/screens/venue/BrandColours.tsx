import { StyleSheet, View } from 'react-native';

import { Body, Caption, ColourWheel, DsText, Field, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { ACCENT_INK, type AccentInk, type ContrastLine } from '@/lib/brandColours';

export interface AccentOption {
  name: string;
  hex: string;
  /** Where it came from: "Accent" (the current one), "From your logo", "App default". */
  source: string;
}

const SWATCH = 44;
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
      // Picked: ringed in ink, so the ring never fights the colours it frames.
      style={[styles.card, { borderColor: selected ? ds.c.ink : ds.c.line, borderWidth: selected ? 2 : 1, backgroundColor: ds.c.raised }]}
    >
      {children}
    </PressableScale>
  );
}

/**
 * Colours from your logo: a card per colour with its name, hex and where it
 * came from, then Custom, which opens a colour wheel and a hex field.
 * `custom` is true while the accent isn't one of the cards.
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
            <Body numberOfLines={1} style={styles.name}>{o.name}</Body>
            <DsText variant="caption" tone="muted" numberOfLines={1} style={styles.mono}>{o.hex}</DsText>
            <Caption tone="muted" numberOfLines={1}>{o.source}</Caption>
          </Card>
        ))}
        <Card selected={custom} label="Custom, Any hex" onPress={onCustom}>
          {custom && value ? (
            <View style={[styles.swatch, { backgroundColor: value, borderColor: ds.c.line }]} />
          ) : (
            <View style={[styles.swatch, styles.customSwatch, { borderColor: ds.c.lineStrong }]}>
              <IconSymbol name="plus" size={16} color={ds.c.muted} />
            </View>
          )}
          <Body numberOfLines={1} style={styles.name}>Custom</Body>
          <Caption tone="muted" numberOfLines={1} style={styles.mono}>{custom && value ? value : 'Pick a colour'}</Caption>
          <Caption tone="muted" numberOfLines={1}>Any hex</Caption>
        </Card>
      </View>
      {custom ? (
        <>
          <ColourWheel value={value} onChange={onHex} />
          <Field label="Hex" value={hexDraft} onChangeText={onHex} placeholder="e.g. #D0643B" autoCapitalize="characters" autoCorrect={false} error={hexError} />
        </>
      ) : null}
    </View>
  );
}

/** Text on accent: Cream or Ink, each shown as a button on the accent; the pick is ringed in ink. `value` is the pick, or what the app picks on its own. */
export function AccentInkChoice({ value, accent, onChange }: { value: AccentInk; accent: string | null; onChange: (ink: AccentInk) => void }) {
  const ds = useDs();
  return (
    <View style={[styles.ink, { borderTopColor: ds.c.line }]}>
      <View style={styles.flex}>
        <Body>Text on accent</Body>
        <Caption tone="muted">Button labels and the active tab</Caption>
      </View>
      <View role="radiogroup" aria-label="Text on accent" style={styles.inkChoices}>
        {INKS.map((o) => {
          const selected = value === o.id;
          return (
            <PressableScale
              key={o.id}
              role="radio"
              aria-checked={selected}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.id)}
              style={[styles.inkPill, { backgroundColor: accent ?? ds.accentFill.fill, borderColor: selected ? ds.c.ink : 'transparent' }]}
            >
              <Caption color={ACCENT_INK[o.id]} style={styles.name}>
                {o.label}
              </Caption>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** The contrast check under Ground tint: one line per pairing, its ratio in a green or amber pill, then Passes or what the app does instead. */
export function ContrastCheck({ lines }: { lines: ContrastLine[] }) {
  const ds = useDs();
  return (
    <View style={styles.wrap}>
      <Caption tone="muted" role="heading" style={styles.kicker}>CONTRAST CHECK</Caption>
      <View role="list" aria-label="Contrast check">
        {lines.map((l) => (
          <View key={l.label} role="listitem" style={[styles.line, { borderBottomColor: ds.c.line }]}>
            <Tag label={l.ratio} tone={l.passes ? 'success' : 'warning'} />
            <Body style={styles.lineLabel}>{l.label}</Body>
            <Caption tone="muted">{l.verdict}</Caption>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingVertical: space.sm },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { flexBasis: 120, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 0, padding: space.sm + 2, borderRadius: radius.control + 4, borderCurve: 'continuous' },
  // A wide bar of the colour across the card.
  swatch: { alignSelf: 'stretch', height: SWATCH, borderRadius: radius.control - 2, borderWidth: 1, marginBottom: space.sm },
  name: { fontFamily: fontFamilies.bodySemiBold },
  mono: { fontFamily: fontFamilies.mono },
  inkChoices: { flexDirection: 'row', gap: space.sm },
  inkPill: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 2 },
  lineLabel: { flexGrow: 1, flexShrink: 1, flexBasis: 200 },
  customSwatch: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  ink: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 160, gap: 2 },
  kicker: { letterSpacing: 0.8 },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
