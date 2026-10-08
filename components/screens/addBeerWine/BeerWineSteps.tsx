import { StyleSheet, TextInput, View } from 'react-native';

import { Caption, Field, GlassVariantPicker, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, radius, space, type } from '@/constants/tokens';
import {
  beerWineSketch, fullDescription, glassFor, REGIONS, stepAbv, strengthChips, STYLES, styleOf, TASTING, type BeerWineDraft,
} from '@/lib/beerWineWizard';
import type { DrinkKind } from '@/lib/drinkKinds';

import { Eyebrow, WizardChip } from '../addDrink/WizardChrome';

export interface BeerWineStepProps {
  kind: DrinkKind;
  draft: BeerWineDraft;
  set: (change: Partial<BeerWineDraft>) => void;
  /** Return in a one-line field moves on. */
  onDone?: () => void;
}

/** The brewery or producer. */
export function MakerStep({ kind, draft, set, onDone }: BeerWineStepProps) {
  return (
    <Field
      label={kind === 'beer' ? 'Brewery' : 'Producer'}
      placeholder={kind === 'beer' ? 'e.g. Bellwoods' : 'e.g. Domaine Tempier'}
      value={draft.maker}
      onChangeText={(maker) => set({ maker })}
      autoFocus={!draft.maker}
      returnKeyType="next"
      onSubmitEditing={onDone}
      maxLength={80}
    />
  );
}

/** The style (it colours the drawing and picks its usual glass), then where it's from. */
export function StyleStep({ kind, draft, set }: BeerWineStepProps) {
  return (
    <View style={styles.stack}>
      <View role="radiogroup" accessibilityLabel={kind === 'beer' ? 'Style' : 'Kind'} style={styles.chips}>
        {STYLES[kind].map((st) => (
          // A new style starts from its own glass.
          <WizardChip key={st.name} label={st.name} selected={draft.style === st.name} onPress={() => set({ style: draft.style === st.name ? null : st.name, glassVariant: null })} />
        ))}
      </View>
      <View style={styles.group}>
        <Eyebrow>Where from?</Eyebrow>
        <View role="radiogroup" accessibilityLabel="Where it's from" style={styles.chips}>
          {REGIONS[kind].map((r) => (
            <WizardChip key={r} label={r} selected={draft.region === r} onPress={() => set({ region: draft.region === r ? null : r })} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** ABV: a big number to type, − and + by tenths, and the usual strengths for the style. */
export function StrengthStep({ kind, draft, set }: BeerWineStepProps) {
  const ds = useDs();
  const chips = strengthChips(kind, draft.style);
  const usual = styleOf(kind, draft.style);
  return (
    <View style={styles.stack}>
      <View style={styles.strength}>
        <Round icon="minus" label="Less strong" onPress={() => set({ abv: stepAbv(draft.abv, -1, chips[0]) })} />
        <View style={styles.abv}>
          <TextInput
            value={draft.abv}
            onChangeText={(abv) => set({ abv: abv.replace(/[^0-9.,]/g, '') })}
            keyboardType="decimal-pad"
            placeholder="–"
            placeholderTextColor={ds.c.faint}
            aria-label="Strength, percent ABV"
            maxLength={5}
            style={[styles.abvInput, type.title, { fontFamily: displayFaces[ds.displayFace].regular, color: ds.c.ink }]}
          />
          <Caption tone="muted">% ABV</Caption>
        </View>
        <Round icon="plus" label="Stronger" onPress={() => set({ abv: stepAbv(draft.abv, 1, chips[0]) })} />
      </View>
      <View role="radiogroup" accessibilityLabel="Usual strengths" style={styles.chips}>
        {chips.map((n, i) => (
          <WizardChip key={n} label={`${n}%`} selected={draft.abv === String(n)} suggested={i === 0 && !!usual && !draft.abv} onPress={() => set({ abv: String(n) })} />
        ))}
      </View>
      {usual ? <Caption tone="muted">{`${usual.name} is usually around ${usual.abv}%.`}</Caption> : null}
    </View>
  );
}

/** The glass's drawings side by side, the style's usual one marked. */
export function GlassStep({ kind, draft, set }: BeerWineStepProps) {
  const inputs = beerWineSketch(kind, draft);
  const usual = styleOf(kind, draft.style);
  const glass = glassFor(kind, draft.style);
  const notes = usual && usual.variant.startsWith(`${glass}_`) ? { [usual.variant]: `Usual for ${usual.name.toLowerCase()}` } : undefined;
  return (
    <GlassVariantPicker
      glass={glass}
      inputs={inputs}
      seed={kind}
      value={inputs.variant}
      onChange={(glassVariant) => set({ glassVariant })}
      notes={notes}
      accessibilityLabel="Glass"
    />
  );
}

/** Tasting words to tap (they lead the description) and a line of your own. */
export function NotesStep({ kind, draft, set }: BeerWineStepProps) {
  const toggle = (w: string) => set({ tasting: draft.tasting.includes(w) ? draft.tasting.filter((x) => x !== w) : [...draft.tasting, w] });
  const reads = fullDescription(draft);
  return (
    <View style={styles.stack}>
      <View role="group" accessibilityLabel="Tasting words" style={styles.chips}>
        {TASTING[kind].map((w) => (
          <WizardChip key={w} kind="checkbox" label={w} selected={draft.tasting.includes(w)} onPress={() => toggle(w)} />
        ))}
      </View>
      <Field label="In your words" hint="What a guest would want to know." value={draft.description} onChangeText={(description) => set({ description })} minLines={2} maxLength={500} />
      {reads ? <Caption tone="muted">{`Reads: ${reads}`}</Caption> : null}
    </View>
  );
}

/** What the venue charges. */
export function PriceStep({ draft, set, onDone }: BeerWineStepProps) {
  return <Field label="Price" placeholder="e.g. 9" value={draft.price} onChangeText={(price) => set({ price: price.replace(/[^0-9.,]/g, '') })} keyboardType="decimal-pad" autoFocus={!draft.price} onSubmitEditing={onDone} maxLength={8} />;
}

function Round({ icon, label, onPress }: { icon: 'minus' | 'plus'; label: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale onPress={onPress} role="button" accessibilityLabel={label} style={[styles.round, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name={icon} size={20} color={ds.c.ink} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  strength: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl },
  round: { width: layout.minTapTarget + 12, height: layout.minTapTarget + 12, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  abv: { alignItems: 'center' },
  abvInput: { width: 140, textAlign: 'center', padding: 0 },
});
