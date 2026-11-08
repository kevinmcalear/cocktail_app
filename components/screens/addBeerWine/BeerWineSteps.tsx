import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import {
  beerWineSketch, cleanPrice, glassChoices, REGIONS, startingAbv, stepAbv, STYLES, styleOf, TASTING, type BeerWineDraft,
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

/** A small-capitals label over what it labels ("BREWERY", "WHERE IT'S FROM"), as the boards set them. */
function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </View>
  );
}

/** Who brews it or makes it, then where it's from. */
export function MakerStep({ kind, draft, set, onDone }: BeerWineStepProps) {
  const label = kind === 'beer' ? 'Brewery' : 'Producer';
  return (
    <View style={styles.stack}>
      <Labelled label={label}>
        <Field
          label={label}
          hideLabel
          placeholder={kind === 'beer' ? 'e.g. Bellwoods' : 'e.g. Domaine Tempier'}
          value={draft.maker}
          onChangeText={(maker) => set({ maker })}
          autoFocus={!draft.maker}
          returnKeyType="next"
          onSubmitEditing={onDone}
          maxLength={80}
        />
      </Labelled>
      <Labelled label="Where it’s from">
        <View role="radiogroup" accessibilityLabel="Where it’s from" style={styles.chips}>
          {REGIONS[kind].map((r) => (
            <WizardChip key={r} label={r} selected={draft.region === r} onPress={() => set({ region: draft.region === r ? null : r })} />
          ))}
        </View>
        {draft.origin ? <Caption tone="muted">{`${draft.origin} · from the catalog`}</Caption> : null}
      </Labelled>
    </View>
  );
}

/** The style (it colours the drawing and picks its usual glass). */
export function StyleStep({ kind, draft, set }: BeerWineStepProps) {
  return (
    <View style={styles.stack}>
      <View role="radiogroup" accessibilityLabel={kind === 'beer' ? 'Style' : 'Kind'} style={styles.chips}>
        {STYLES[kind].map((st) => (
          // A new style starts from its own glass.
          <WizardChip key={st.name} label={st.name} selected={draft.style === st.name} onPress={() => set({ style: draft.style === st.name ? null : st.name, glassVariant: null })} />
        ))}
      </View>
      {draft.style ? <Caption tone="muted">{`${draft.style} draws its colour in the glass and picks the usual glass.`}</Caption> : null}
    </View>
  );
}

/** ABV as typed, with Less strong and Stronger by tenths and the style's usual strength between them. */
export function StrengthStep({ kind, draft, set, onDone }: BeerWineStepProps) {
  const usual = styleOf(kind, draft.style);
  const start = startingAbv(kind, draft.style);
  return (
    <View style={styles.stack}>
      <Labelled label="Strength, percent ABV">
        <Field
          label="Strength, percent ABV"
          hideLabel
          value={draft.abv}
          onChangeText={(abv) => set({ abv: abv.replace(/[^0-9.,]/g, '') })}
          keyboardType="decimal-pad"
          placeholder={`e.g. ${start}`}
          returnKeyType="next"
          onSubmitEditing={onDone}
          maxLength={5}
        />
      </Labelled>
      <Labelled label="Usual strengths">
        <View style={styles.chips}>
          <WizardChip kind="button" label="Less strong" onPress={() => set({ abv: stepAbv(draft.abv, -1, start) })} />
          {usual ? <WizardChip kind="radio" label={`${usual.abv}% · usual for ${usual.name.toLowerCase()}`} selected={draft.abv === String(usual.abv)} onPress={() => set({ abv: String(usual.abv) })} /> : null}
          <WizardChip kind="button" label="Stronger" onPress={() => set({ abv: stepAbv(draft.abv, 1, start) })} />
        </View>
      </Labelled>
    </View>
  );
}

/** The glass it's poured in, the style's usual one first; the drawing above changes with it. */
export function GlassStep({ kind, draft, set }: BeerWineStepProps) {
  const drawn = beerWineSketch(kind, draft).variant;
  return (
    <View style={styles.stack}>
      <View role="radiogroup" accessibilityLabel="Glass" style={styles.chips}>
        {glassChoices(kind, draft.style).map((g, i) => (
          <WizardChip key={g.key} label={g.label} selected={drawn ? drawn === g.key : i === 0} onPress={() => set({ glassVariant: g.key })} />
        ))}
      </View>
      <Caption tone="muted">The drawing above changes with the glass.</Caption>
    </View>
  );
}

/** Tasting words to tap (they lead the description) and a line of your own. */
export function NotesStep({ kind, draft, set }: BeerWineStepProps) {
  const toggle = (w: string) => set({ tasting: draft.tasting.includes(w) ? draft.tasting.filter((x) => x !== w) : [...draft.tasting, w] });
  return (
    <View style={styles.stack}>
      <Labelled label="Tasting words">
        <View role="group" accessibilityLabel="Tasting words" style={styles.chips}>
          {TASTING[kind].map((w) => (
            <WizardChip key={w} kind="checkbox" label={w} selected={draft.tasting.includes(w)} onPress={() => toggle(w)} />
          ))}
        </View>
      </Labelled>
      <Labelled label="In your words">
        <Field label="In your words" hideLabel hint="What a guest would want to know." value={draft.description} onChangeText={(description) => set({ description })} minLines={2} maxLength={500} />
      </Labelled>
    </View>
  );
}

/** What the venue charges: a beer's a number, a wine's by the glass or the bottle, in one line. */
export function PriceStep({ kind, draft, set, onDone }: BeerWineStepProps) {
  return (
    <Labelled label="Price">
      <Field
        label="Price"
        hideLabel
        placeholder={kind === 'beer' ? 'e.g. 9' : 'e.g. 18 a glass · 72 a bottle'}
        value={draft.price}
        onChangeText={(price) => set({ price: cleanPrice(kind, price) })}
        keyboardType={kind === 'beer' ? 'decimal-pad' : 'default'}
        autoFocus={!draft.price}
        returnKeyType="next"
        onSubmitEditing={onDone}
        maxLength={40}
      />
    </Labelled>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
