import { useState } from 'react';

import { useCapabilities } from '@/hooks/useCapabilities';
import { useDraftPacks } from '@/hooks/useDrinkDesk';
import { usePricingSettings, useShownCurrency } from '@/hooks/usePricing';
import { perDrinkLines } from '@/lib/batchLines';
import { lineCostMinor } from '@/lib/costing';
import { density } from '@/lib/drinkMath';
import { amountOf, type WizardDraft, type WizardLine } from '@/lib/drinkWizard';
import { formatAmount, parseMoney } from '@/lib/money';
import { prepCostMinor } from '@/lib/prepCost';
import { bottleKindRow } from '@/lib/newBottle';
import { venueParts } from '@/lib/suppliers';

import { DeskCost, type DeskCostLine } from './DrinkDeskRail';
import type { CatalogIngredient } from './IngredientSearch';
import { NewBottleCard } from './NewBottleCard';
import { LineDetail } from './LineDetail';

interface DeskLinesArgs {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  barId: string | null;
  venueName: string;
  ingredients: readonly CatalogIngredient[];
  coreIds: ReadonlySet<string>;
  /** Prep or Costs: a new bottle's card is theirs to fill in. */
  canBuy: boolean;
  /** Costs: pack prices. */
  canCost: boolean;
  /** Null: none known yet, so no symbol (useShownCurrency). */
  currency: string | null;
  /** "Pommeau, adding" in the cost lines while its card is open (the desktop rail sits beside it). */
  adding?: boolean;
}

/**
 * What the desktop page shows under each ingredient line: what the pour
 * costs, and a new bottle's card under its line; and the cost lines for the
 * rail. Not who brings each line: that's the run sheet's question (Eddie and
 * Kevin, 26 Oct).
 */
export function useDeskLines({ draft, set, barId, venueName, ingredients, coreIds, canBuy, canCost, currency, adding = true }: DeskLinesArgs) {
  // A batch costs what one drink's own pours do.
  const costed = [...perDrinkLines(draft.lines), ...draft.garnishes];
  // A house prep being written costs from its parts, so their packs are read too (m08).
  // Its recipe's lines start as names ("Sugar"): the catalog row of that name stands in.
  // Every row of that name (a kind and the bar's own bottle can share one): the priced one wins.
  const partIds = (p: { id: string | null; name: string }) => (p.id ? [p.id] : ingredients.filter((i) => i.name?.toLowerCase() === p.name.trim().toLowerCase()).map((i) => i.id));
  const ids = costed.flatMap((l) => (l.id ? [l.id] : !l.prep ? [] : l.prep.lines.flatMap(partIds)));
  const packs = useDraftPacks(barId, ids, canBuy).data ?? [];
  const pack = (l: WizardLine) => packs.find((k) => k.itemId === l.id) ?? null;
  const packOf = (part: { id: string | null; name: string }) => {
    const mine = partIds(part);
    const k = packs.find((p) => mine.includes(p.itemId) && p.costMinor != null && p.amount && p.unit);
    return k?.costMinor != null && k.amount && k.unit ? { amount: k.amount, unit: k.unit, costMinor: k.costMinor } : null;
  };
  const cost = (l: WizardLine) => {
    // A new bottle counts from the pack typed on its card.
    const b = !l.id ? l.bottle : null;
    const typed = b && Number(b.packAmount.replace(',', '.')) > 0 && b.packPrice.trim() ? parseMoney(b.packPrice, currency ?? '') : null;
    if (b) return canCost && typed != null ? lineCostMinor(amountOf(l.amount), l.unit, { amount: Number(b.packAmount.replace(',', '.')), unit: b.packUnit, costMinor: typed }, density(l.name, null)) : null;
    if (!l.id && l.prep) return canCost ? (prepCostMinor(l.prep, { amount: amountOf(l.amount), unit: l.unit }, packOf)?.pourMinor ?? null) : null;
    const k = pack(l);
    return canCost && k?.costMinor != null && k.amount && k.unit ? lineCostMinor(amountOf(l.amount), l.unit, { amount: k.amount, unit: k.unit, costMinor: k.costMinor }, density(l.name, null)) : null;
  };
  // The new bottle whose card is open under its line.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const costLines: DeskCostLine[] = costed.map((l) => ({ key: l.key, name: adding && l.bottle && l.key === openKey ? `${l.name}, adding` : l.name, minor: cost(l) }));
  const price = (l: WizardLine) => {
    const minor = cost(l);
    return minor != null ? formatAmount(minor, currency) : null;
  };
  const row = (id: string | null) => (id ? ingredients.find((i) => i.id === id) ?? null : null);

  const lineDetail = (l: WizardLine) => {
    if (!canBuy) return null;
    // A house prep is made, not bought: no supplier to pick.
    if (l.prep || l.later || l.technique || row(l.id)?.ingredient_role === 'prep') return <LineDetail tag={l.id ? undefined : 'House'} words="Made here" price={price(l)} />;
    if (l.id) return <LineDetail price={price(l)} />;
    if (!l.bottle) return null;
    // A new bottle's chip opens its card under the line.
    const on = openKey === l.key;
    return <LineDetail line={l.name} tag="New" price={price(l)} open={on} onPress={() => setOpenKey(on ? null : l.key)} />;
  };
  const core = ingredients.filter((i) => coreIds.has(i.id));
  const setBottle = (key: string, bottle: WizardLine['bottle']) => set({ lines: draft.lines.map((x) => (x.key === key ? { ...x, bottle } : x)) });
  const lineBelow = (l: WizardLine) =>
    l.key === openKey && !l.id && l.bottle ? (
      <NewBottleCard
        name={l.name}
        bottle={l.bottle}
        venueName={venueName}
        kindId={(kind) => bottleKindRow(l.name, kind, core, ingredients)?.id ?? null}
        canCost={canCost}
        onChange={(bottle) => setBottle(l.key, bottle)}
        onAdd={() => setOpenKey(null)}
        onNameOnly={() => {
          setBottle(l.key, undefined);
          setOpenKey(null);
        }}
      />
    ) : null;

  /** A new bottle just added from the field: its card opens under its line. */
  const onNewBottle = canBuy ? (key: string) => setOpenKey(key) : undefined;
  return { costLines, lineDetail, lineBelow, onNewBottle };
}

/**
 * The same venue parts on a phone (m01, decided 24 Oct 2026): a new bottle's
 * card under its line on the ingredients step, and what it costs on review.
 * Prep or Costs see the new bottle's card; Costs see prices.
 * Null `barId` (at home, or the desktop page, which has its own) turns it off.
 */
export function useVenueLines(args: Omit<DeskLinesArgs, 'canBuy' | 'canCost' | 'currency'>) {
  const { canBuy, canCost } = venueParts(args.barId, useCapabilities(args.barId).data);
  const pricing = usePricingSettings(canCost ? args.barId : null).data ?? null;
  const currency = useShownCurrency(args.barId, canCost);
  // On review the card isn't on screen, so nothing reads "adding".
  const { costLines, lineDetail, lineBelow, onNewBottle } = useDeskLines({ ...args, canBuy, canCost, currency, adding: false });
  return {
    /** For IngredientsStep. */
    lines: { lineDetail, lineBelow, onNewBottle },
    /** For review: the cost card, with the price and GP. */
    cost: canCost ? <DeskCost lines={costLines} pricing={pricing} currency={currency} price={args.draft.price ?? ''} onPrice={(price) => args.set({ price })} /> : null,
  };
}
