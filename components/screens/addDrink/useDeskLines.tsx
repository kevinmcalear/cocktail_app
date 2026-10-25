import { useState } from 'react';

import { useCapabilities } from '@/hooks/useCapabilities';
import { useDraftPacks, useLineMakers, useSetLineSupplier } from '@/hooks/useDrinkDesk';
import { usePricingSettings } from '@/hooks/usePricing';
import { useVenueIngredients } from '@/hooks/useVenueIngredients';
import { useSupplierSuggestionData, useVenueSuppliers } from '@/hooks/useVenueSuppliers';
import { perDrinkLines } from '@/lib/batchLines';
import { lineCostMinor } from '@/lib/costing';
import { density } from '@/lib/drinkMath';
import { amountOf, type WizardDraft, type WizardLine } from '@/lib/drinkWizard';
import { formatMoney, parseMoney } from '@/lib/money';
import { bottleKindRow } from '@/lib/newBottle';
import { pickSuppliers, regionHeading } from '@/lib/suppliers';

import { DeskCost, type DeskCostLine } from './DrinkDeskRail';
import type { CatalogIngredient } from './IngredientSearch';
import { NewBottleCard } from './NewBottleCard';
import { LineSupplier, SupplierPickList } from './SupplierPick';

interface DeskLinesArgs {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  barId: string | null;
  venueName: string;
  ingredients: readonly CatalogIngredient[];
  coreIds: ReadonlySet<string>;
  /** Prep or Costs: suppliers are theirs to see and set. */
  canBuy: boolean;
  /** Costs: pack prices. */
  canCost: boolean;
  currency: string;
}

/**
 * What the desktop page shows under each ingredient line: who brings it (a
 * chip that opens the pick under the line, board make-create-desktop step 7)
 * and what the pour costs; and the cost lines for the rail.
 */
export function useDeskLines({ draft, set, barId, venueName, ingredients, coreIds, canBuy, canCost, currency }: DeskLinesArgs) {
  // A batch costs what one drink's own pours do.
  const costed = [...perDrinkLines(draft.lines), ...draft.garnishes];
  const ids = costed.flatMap((l) => (l.id ? [l.id] : []));
  const packs = useDraftPacks(barId, ids, canBuy).data ?? [];
  const pack = (l: WizardLine) => packs.find((k) => k.itemId === l.id) ?? null;
  const cost = (l: WizardLine) => {
    // A new bottle counts from the pack typed on its card.
    const b = !l.id ? l.bottle : null;
    const typed = b && Number(b.packAmount.replace(',', '.')) > 0 && b.packPrice.trim() ? parseMoney(b.packPrice, currency) : null;
    if (b) return canCost && typed != null ? lineCostMinor(amountOf(l.amount), l.unit, { amount: Number(b.packAmount.replace(',', '.')), unit: b.packUnit, costMinor: typed }, density(l.name, null)) : null;
    const k = pack(l);
    return canCost && k?.costMinor != null && k.amount && k.unit ? lineCostMinor(amountOf(l.amount), l.unit, { amount: k.amount, unit: k.unit, costMinor: k.costMinor }, density(l.name, null)) : null;
  };
  // The pick (or a new bottle's card) open under one line.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const costLines: DeskCostLine[] = costed.map((l) => ({ key: l.key, name: l.bottle && l.key === openKey ? `${l.name}, adding` : l.name, minor: cost(l) }));
  const price = (l: WizardLine) => {
    const minor = cost(l);
    return minor != null ? formatMoney(minor, currency) : null;
  };
  const row = (id: string | null) => (id ? ingredients.find((i) => i.id === id) ?? null : null);

  // What the pick ranks from: the venue's suppliers, what they bring, and the pages that list the bottle's maker here.
  const open = draft.lines.find((l) => l.key === openKey && (l.id || l.bottle)) ?? null;
  const openId = open?.id ?? null;
  const suppliers = useVenueSuppliers(canBuy ? barId : null).data ?? [];
  const bought = useVenueIngredients(open && canBuy ? barId : null).data ?? [];
  const makers = useLineMakers(openId ? [openId] : [], !!openId).data;
  const makerId = (openId && makers?.[openId]) || null;
  const carrying = useSupplierSuggestionData(openId ? barId : null, makerId ? [makerId] : undefined).data;
  const save = useSetLineSupplier(barId);

  const pickFor = (l: WizardLine) => {
    const carriers = new Set((carrying?.lines ?? []).filter((x) => x.makerId === makerId).map((x) => x.page.id));
    return pickSuppliers(
      l.id ? { id: l.id, makerId, kindId: row(l.id)?.generic_id ?? null } : { id: l.key, makerId: null, kindId: l.bottle?.kindId ?? null },
      suppliers.map((s) => ({ id: s.id, name: s.name, order_by: s.order_by, items: s.items, pageId: s.page?.id ?? null })),
      bought.map((b) => ({ id: b.id, name: b.name, makerId: b.makerId, kindId: row(b.id)?.generic_id ?? null, supplierId: b.supplierId })),
      carriers,
      carrying?.regions[0] ? regionHeading(carrying.regions[0]) : null
    );
  };

  const lineDetail = (l: WizardLine) => {
    if (!canBuy) return null;
    // A house prep is made, not bought: no supplier to pick.
    if (l.prep || l.later || l.technique || row(l.id)?.ingredient_role === 'prep') return <LineSupplier line={l.name} tag={l.id ? undefined : 'House'} supplier="Made here" price={price(l)} />;
    const on = openKey === l.key;
    const toggle = () => setOpenKey(on ? null : l.key);
    if (!l.id) return l.bottle ? <LineSupplier line={l.name} tag="New" supplier={l.bottle.supplier?.name ?? null} price={price(l)} open={on} onPress={toggle} hint="Opens the new bottle under the line" /> : null;
    return <LineSupplier line={l.name} supplier={pack(l)?.supplier ?? null} price={price(l)} open={on} onPress={toggle} />;
  };
  const core = ingredients.filter((i) => coreIds.has(i.id));
  const setBottle = (key: string, bottle: WizardLine['bottle']) => set({ lines: draft.lines.map((x) => (x.key === key ? { ...x, bottle } : x)) });
  const lineBelow = (l: WizardLine) =>
    open && l.key === open.key && !l.id && l.bottle ? (
      <NewBottleCard
        name={l.name}
        bottle={l.bottle}
        venueName={venueName}
        suppliers={pickFor(l)}
        kindId={(kind) => bottleKindRow(l.name, kind, core, ingredients)?.id ?? null}
        canCost={canCost}
        onChange={(bottle) => setBottle(l.key, bottle)}
        onAdd={() => setOpenKey(null)}
        onNameOnly={() => {
          setBottle(l.key, undefined);
          setOpenKey(null);
        }}
      />
    ) : open && l.key === open.key ? (
      <SupplierPickList
        line={l.name}
        venueName={venueName}
        pick={pickFor(l)}
        current={pack(l)?.supplierId ?? null}
        busy={save.isPending}
        failed={save.isError}
        onPick={(supplier) => save.mutate({ itemId: l.id!, supplier }, { onSuccess: () => setOpenKey(null) })}
      />
    ) : null;

  /** A new bottle just added from the field: its card opens under its line. */
  const onNewBottle = canBuy ? (key: string) => setOpenKey(key) : undefined;
  return { costLines, lineDetail, lineBelow, onNewBottle };
}

/**
 * The same venue parts on a phone (m01, decided 24 Oct 2026): who brings
 * each line and a new bottle's card under it on the ingredients step, and
 * what it costs on review. Prep or Costs see suppliers; Costs see prices.
 * Null `barId` (at home, or the desktop page, which has its own) turns it off.
 */
export function useVenueLines(args: Omit<DeskLinesArgs, 'canBuy' | 'canCost' | 'currency'>) {
  const caps = useCapabilities(args.barId).data;
  const canCost = !!args.barId && !!caps?.includes('costs');
  const canBuy = canCost || (!!args.barId && !!caps?.includes('prep'));
  const pricing = usePricingSettings(canCost ? args.barId : null).data ?? null;
  const { costLines, lineDetail, lineBelow, onNewBottle } = useDeskLines({ ...args, canBuy, canCost, currency: pricing?.currency ?? 'GBP' });
  return {
    /** For IngredientsStep. */
    lines: { lineDetail, lineBelow, onNewBottle },
    /** For review: the cost card, with the price and GP. */
    cost: canCost ? <DeskCost lines={costLines} pricing={pricing} price={args.draft.price ?? ''} onPrice={(price) => args.set({ price })} /> : null,
  };
}
