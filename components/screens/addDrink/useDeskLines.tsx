import { useState } from 'react';

import { useDraftPacks, useLineMakers, useSetLineSupplier } from '@/hooks/useDrinkDesk';
import { useVenueIngredients } from '@/hooks/useVenueIngredients';
import { useSupplierSuggestionData, useVenueSuppliers } from '@/hooks/useVenueSuppliers';
import { perDrinkLines } from '@/lib/batchLines';
import { lineCostMinor } from '@/lib/costing';
import { density } from '@/lib/drinkMath';
import { amountOf, type WizardDraft, type WizardLine } from '@/lib/drinkWizard';
import { formatMoney } from '@/lib/money';
import { pickSuppliers, regionHeading } from '@/lib/suppliers';

import type { DeskCostLine } from './DrinkDeskRail';
import type { CatalogIngredient } from './IngredientSearch';
import { LineSupplier, SupplierPickList } from './SupplierPick';

interface DeskLinesArgs {
  draft: WizardDraft;
  barId: string | null;
  venueName: string;
  ingredients: readonly CatalogIngredient[];
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
export function useDeskLines({ draft, barId, venueName, ingredients, canBuy, canCost, currency }: DeskLinesArgs) {
  // A batch costs what one drink's own pours do.
  const costed = [...perDrinkLines(draft.lines), ...draft.garnishes];
  const ids = costed.flatMap((l) => (l.id ? [l.id] : []));
  const packs = useDraftPacks(barId, ids, canBuy).data ?? [];
  const pack = (l: WizardLine) => packs.find((k) => k.itemId === l.id) ?? null;
  const cost = (l: WizardLine) => {
    const k = pack(l);
    return canCost && k?.costMinor != null && k.amount && k.unit ? lineCostMinor(amountOf(l.amount), l.unit, { amount: k.amount, unit: k.unit, costMinor: k.costMinor }, density(l.name, null)) : null;
  };
  const costLines: DeskCostLine[] = costed.map((l) => ({ key: l.key, name: l.name, minor: cost(l) }));
  const price = (l: WizardLine) => {
    const minor = cost(l);
    return minor != null ? formatMoney(minor, currency) : null;
  };
  const row = (id: string | null) => (id ? ingredients.find((i) => i.id === id) ?? null : null);

  // The pick open under one line, and what it ranks from: the venue's suppliers, what they bring, and the pages that list the bottle's maker here.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = draft.lines.find((l) => l.key === openKey && l.id) ?? null;
  const openId = open?.id ?? null;
  const suppliers = useVenueSuppliers(canBuy ? barId : null).data ?? [];
  const bought = useVenueIngredients(openId && canBuy ? barId : null).data ?? [];
  const makers = useLineMakers(openId ? [openId] : [], !!openId).data;
  const makerId = (openId && makers?.[openId]) || null;
  const carrying = useSupplierSuggestionData(openId ? barId : null, makerId ? [makerId] : undefined).data;
  const save = useSetLineSupplier(barId);

  const pickFor = (l: WizardLine) => {
    const carriers = new Set((carrying?.lines ?? []).filter((x) => x.makerId === makerId).map((x) => x.page.id));
    return pickSuppliers(
      { id: l.id!, makerId, kindId: row(l.id)?.generic_id ?? null },
      suppliers.map((s) => ({ id: s.id, name: s.name, order_by: s.order_by, items: s.items, pageId: s.page?.id ?? null })),
      bought.map((b) => ({ id: b.id, name: b.name, makerId: b.makerId, kindId: row(b.id)?.generic_id ?? null, supplierId: b.supplierId })),
      carriers,
      carrying?.regions[0] ? regionHeading(carrying.regions[0]) : null
    );
  };

  const lineDetail = (l: WizardLine) => {
    if (!canBuy) return null;
    // A house prep is made, not bought: no supplier to pick.
    if (l.prep || l.later || l.technique || row(l.id)?.ingredient_role === 'prep') return <LineSupplier line={l.name} supplier="Made here" price={price(l)} />;
    if (!l.id) return null;
    const on = openKey === l.key;
    return <LineSupplier line={l.name} supplier={pack(l)?.supplier ?? null} price={price(l)} open={on} onPress={() => setOpenKey(on ? null : l.key)} />;
  };
  const lineBelow = (l: WizardLine) =>
    open && l.key === open.key ? (
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

  return { costLines, lineDetail, lineBelow };
}
