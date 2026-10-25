import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Caption, DsText, Field, Headline, SketchTintPicker, Spec, Surface, Title, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { balanceOf, fixesFor, tasteWord } from '@/lib/balance';
import { formatPct, margin } from '@/lib/costing';
import { amountOf, type WizardDraft, type WizardLine } from '@/lib/drinkWizard';
import { menuNote } from '@/lib/menuNote';
import { formatMoney, priceMinor } from '@/lib/money';
import type { DraftLook } from '@/lib/sketch/draft';
import { useMenuDrinkSpecs } from '@/hooks/useDrinkDesk';
import type { PricingSettings } from '@/hooks/usePricing';

import { inputsFor } from './SketchHeader';
import { Eyebrow, WizardChip } from './WizardChrome';
import type { CatalogIngredient } from './IngredientSearch';

/**
 * The drink as it's written: its drawing, name and what's in it
 * (make-create-desktop, "The drink, as you go"), and the drawing's colour
 * under it: Auto, or a house watercolour that holds while the spec changes.
 */
export function DeskDrinkCard({ draft, look, seed, onTint }: { draft: WizardDraft; look: DraftLook; seed: string; onTint: (tint: string | null) => void }) {
  const ds = useDs();
  const empty = !look.glass && !look.lines.length && !look.methods?.length;
  const inputs = inputsFor(empty ? { ...look, glass: 'Coupe' } : look);
  const name = draft.name.trim() || 'New drink';
  const what = [...draft.lines, ...draft.garnishes].map((l) => l.name.toLowerCase()).join(', ');
  return (
    <View style={[styles.card, styles.paper, { backgroundColor: ds.c.paper }]}>
      <View style={styles.drink}>
        <View style={styles.sketch} role="img" aria-label={`Sketch of ${name}`}>
          <SketchDrawing inputs={inputs} seed={seed} detail="full" />
        </View>
        <View style={styles.flex}>
          <Title color={ds.c.sketchInk} numberOfLines={2}>
            {name}
          </Title>
          {what ? <Body color={ds.c.sketchInk}>{what.charAt(0).toUpperCase() + what.slice(1)}</Body> : <Caption color={ds.c.sketchInk}>Draws itself as you write the spec.</Caption>}
          {what ? <Caption color={withAlpha(ds.c.sketchInk, 0.7)} style={styles.guests}>What guests see</Caption> : null}
        </View>
      </View>
      {/* On paper: the light scheme's ink, so the picked swatch's ring shows. */}
      <BackbarTheme scheme="light">
        <View style={[styles.colour, { borderTopColor: withAlpha(ds.c.sketchInk, 0.16) }]}>
          <Eyebrow>Colour</Eyebrow>
          <SketchTintPicker inputs={inputs} seed={seed} value={draft.tint ?? null} onChange={onTint} frame={false} />
        </View>
      </BackbarTheme>
    </View>
  );
}

const DIMS = [
  ['strong', 'Strong'],
  ['sour', 'Sour'],
  ['sweet', 'Sweet'],
  ['bitter', 'Bitter'],
] as const;

/** Taste so far, from the same rules as the wizard's balance card, as five-step meters with a word each. */
export function DeskTaste({ lines, ingredients, onAdd }: { lines: readonly WizardLine[]; ingredients: readonly CatalogIngredient[]; onAdd: (name: string) => void }) {
  const ds = useDs();
  const parts = tasteParts(lines, ingredients);
  const balance = balanceOf(parts);
  const fixes = balance?.need ? fixesFor(balance.need, parts) : [];
  return (
    <Surface raised style={styles.card}>
      <Eyebrow>Taste</Eyebrow>
      {!balance ? (
        <Caption tone="muted">{lines.length ? 'Not enough we know in it yet to say.' : 'Fills in as you add ingredients.'}</Caption>
      ) : (
        <>
          {/* What guests would taste (m07, 24 Oct 2026); the balance hint stays as the reason for the fixes. */}
          <Headline style={styles.words}>{balance.words}</Headline>
          {DIMS.map(([dim, label]) => {
            const word = tasteWord(dim, balance[dim]);
            // Lit as the word reads: "none" is no segment, anything more at least one.
            const on = word === 'none' ? 0 : Math.max(1, Math.round(balance[dim] * 5));
            return (
              <View key={dim} style={styles.meter}>
                <Body style={styles.meterLabel}>{label}</Body>
                <View role="img" aria-label={`${label}: ${word}`} style={styles.segments}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <View key={i} style={[styles.segment, { backgroundColor: i < on ? ds.c.ink : ds.c.line }]} />
                  ))}
                </View>
                <Caption tone="muted" style={styles.meterWord}>
                  {word}
                </Caption>
              </View>
            );
          })}
          {balance.hint ? <Caption tone="muted">{balance.hint}</Caption> : null}
          {fixes.length ? (
            <View role="group" aria-label="To balance it" style={styles.chips}>
              {fixes.map((name) => (
                <WizardChip key={name} label={name} add kind="button" onPress={() => onAdd(name)} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </Surface>
  );
}

/** A spec's lines as the taste reads them: each with what it's a kind of. */
function tasteParts(lines: readonly WizardLine[], ingredients: readonly CatalogIngredient[]) {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  return lines.map((l) => ({ name: l.name, genericName: (l.id && byId.get(byId.get(l.id)?.generic_id ?? '')?.name) || null, amount: amountOf(l.amount), unit: l.unit || null }));
}

/** On the way to a menu: how the drink sits among its others ("On Winter menu it’s the lightest drink, and the only sherry one"). */
export function DeskMenuNote({ sectionId, menu, lines, ingredients }: { sectionId: string | null | undefined; menu: string | null; lines: readonly WizardLine[]; ingredients: readonly CatalogIngredient[] }) {
  const others = useMenuDrinkSpecs(menu ? sectionId : null).data;
  const note = menu && others ? menuNote(menu, tasteParts(lines, ingredients), others) : null;
  return note ? <Body>{note}</Body> : null;
}

export interface DeskCostLine {
  key: string;
  name: string;
  minor: number | null;
}

/** What it costs to make from the bar's pack prices, then the price and GP against the bar's target. */
export function DeskCost({ lines, pricing, price, onPrice }: { lines: DeskCostLine[]; pricing: PricingSettings | null; price: string; onPrice: (price: string) => void }) {
  const currency = pricing?.currency ?? 'GBP';
  const money = (minor: number) => formatMoney(minor, currency) ?? '';
  // The drink's price as typed ("19.50", "MP"); the margin reads the number in it.
  const minor = priceMinor(price, currency);
  const total = lines.reduce((n, l) => n + (l.minor ?? 0), 0);
  const missing = lines.filter((l) => l.minor == null).length;
  const m = pricing ? margin(total, minor, { taxRate: pricing.tax_rate, pricesIncludeTax: pricing.prices_include_tax }) : null;
  return (
    <Surface raised style={styles.card}>
      <Eyebrow>Cost</Eyebrow>
      {lines.length ? (
        <View role="list" aria-label="What each costs">
          {lines.map((l) => (
            <View key={l.key} role="listitem" style={styles.costRow}>
              <Body style={styles.flex} numberOfLines={1}>
                {l.name}
              </Body>
              <Spec tone={l.minor == null ? 'muted' : 'ink'}>{l.minor == null ? 'No price' : money(l.minor)}</Spec>
            </View>
          ))}
        </View>
      ) : (
        <Caption tone="muted">Adds up as you write the spec.</Caption>
      )}
      <View style={[styles.costRow, styles.total]}>
        <Body style={styles.flex}>Costs to make</Body>
        <Headline>{money(total)}</Headline>
      </View>
      {missing ? <Caption tone="muted">{`${missing === 1 ? 'One line has' : `${missing} lines have`} no price yet, so it costs more than this.`}</Caption> : null}
      <View style={styles.priceRow}>
        <View style={styles.flex}>
          <Field
            label="Price"
            value={price}
            onChangeText={onPrice}
            placeholder="12.00 or MP"
            hint={price.trim() && minor == null ? 'No number in it: no margin worked out.' : undefined}
          />
        </View>
        {m ? (
          <View style={styles.gp}>
            <Caption tone="muted">{pricing?.target_gp != null ? `GP · target ${Math.round(pricing.target_gp)}%` : 'GP'}</Caption>
            <DsText variant="title" tone={pricing?.target_gp != null && m.gp < pricing.target_gp ? 'accent' : 'ink'}>
              {formatPct(m.gp)}
            </DsText>
            <Caption tone="muted">{`Makes ${money(Math.round(m.profitMinor))}`}</Caption>
          </View>
        ) : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  paper: { padding: space.lg, borderRadius: radius.card + 6 },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  colour: { gap: space.xs, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  sketch: { width: 130, height: 160 },
  flex: { flex: 1 },
  card: { gap: space.sm },
  words: { fontFamily: fontFamilies.instrument },
  guests: { fontFamily: fontFamilies.mono, letterSpacing: 1, textTransform: 'uppercase' },
  meter: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  meterLabel: { width: 64 },
  meterWord: { width: 72 },
  segments: { flex: 1, flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: 8, borderRadius: radius.pill },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  total: { paddingTop: space.sm },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg, paddingTop: space.sm },
  gp: { alignItems: 'flex-end' },
});
