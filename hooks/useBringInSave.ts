import { useMutation } from '@tanstack/react-query';

import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useRecordBringIn } from '@/hooks/useBringInBatches';
import { useSetMissingPrices, useVenueBottle, type VenueBottle } from '@/hooks/useBulk';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { useShelfEdit } from '@/hooks/useHomeBar';
import { useCreateMenu, type HomeNight } from '@/hooks/useMenuMutations';
import { useMyProfile } from '@/hooks/useMyProfile';
import { emptySummary, type BatchKind, type BatchSummary } from '@/lib/bringInBatch';
import { plainDbMessage } from '@/lib/dbError';
import { sketchLook, type WizardDraft } from '@/lib/drinkWizard';
import { blankSection } from '@/lib/menuLayout';
import { applyMenuPaste, type PlacedGroup } from '@/lib/paste';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { supabase } from '@/lib/supabase';
import type { MenuDrink } from '@/types/menus';

/** A drink to make: the wizard draft, and which of its new ingredients are house preps. */
export interface DrinkToMake {
  draft: WizardDraft;
  prepNames: string[];
}

export type MenuRowToSave = { section: string | null; drink: MenuDrink } | { section: string | null; make: DrinkToMake; price: string | null };

export type BringInSaveInput = { source: string } & (
  | { kind: 'recipes'; drinks: DrinkToMake[] }
  | { kind: 'menu'; name: string; night: HomeNight | null; rows: MenuRowToSave[]; prices: { id: string; price: string }[] }
  | { kind: 'bottles'; shelf: string[]; venue: VenueBottle[]; had: number }
);

/** What Brought in shows. Plain JSON. */
export interface SavedBringIn {
  batchId: string | null;
  kind: BatchKind;
  title: string;
  source: string;
  menuId: string | null;
  drinkIds: string[];
  summary: BatchSummary;
  createdAt: string;
  warnings: string[];
}

const newDrinkItem = (id: string, name: string, price: string | null): MenuDrink => ({ id, name, kind: 'cocktail', line: '', price, imageUrl: null, isSketch: true, glass: null });

/**
 * Saves a checked bring-in in one go (a menu with the drinks it needs, the
 * recipes, or the bottles) through the app's own saves, then records it as
 * one batch so Brought in can undo it all until tomorrow. Nothing from the
 * file becomes a picture: each new drink keeps the drawing of its spec (as
 * the wizard saves it), and a menu gets the bar's own cover, drawn from its
 * drinks, until someone picks a cover photo in the menu builder.
 */
export function useBringInSave(barId: string | null) {
  const createDrink = useCreateDrink();
  const createMenu = useCreateMenu();
  const glasses = useBarGlassware(barId).data;
  const prices = useSetMissingPrices();
  const shelf = useShelfEdit();
  const record = useRecordBringIn();
  const me = useMyProfile().data ?? null;
  const venueBottle = useVenueBottle(barId);

  return useMutation({
    mutationFn: async (input: BringInSaveInput): Promise<SavedBringIn> => {
      const summary = emptySummary(input.kind);
      const itemIds: string[] = [];
      const drinkIds: string[] = [];
      const warnings: string[] = [];
      let menuId: string | null = null;
      let title = '';

      const make = async ({ draft, prepNames }: DrinkToMake): Promise<string> => {
        // The bar's own glass drawings, as the recipe check drew it.
        const variants = (glasses ?? []).filter((g) => g.is_default && g.variant).map((g) => g.variant as string);
        const sketch = draftSketchInputs(sketchLook(draft, variants));
        const result = await createDrink.mutateAsync({ draft, barId: barId, myProfileId: me?.id ?? null, sketch });
        warnings.push(...result.warnings);
        itemIds.push(result.id);
        drinkIds.push(result.id);
        summary.drinksNew += 1;
        const preps = new Set(prepNames.map((n) => n.toLowerCase()));
        const withRecipe = new Set(draft.lines.filter((l) => l.prep).map((l) => l.name.toLowerCase()));
        for (const made of result.created ?? []) {
          itemIds.push(made.id);
          const prep = preps.has(made.name.toLowerCase()) || withRecipe.has(made.name.toLowerCase());
          if (prep) {
            summary.preps.push(made.name);
            if (!withRecipe.has(made.name.toLowerCase())) {
              summary.prepsNoRecipe.push(made);
              await supabase.from('items').update({ ingredient_role: 'prep' }).eq('id', made.id).is('ingredient_role', null);
            }
          } else summary.ingredients.push(made.name);
        }
        if (draft.lines.length && draft.lines.every((l) => !l.amount.trim() && l.unit !== 'top')) summary.noAmounts += 1;
        return result.id;
      };

      try {
        if (input.kind === 'recipes') {
          for (const drink of input.drinks) await make(drink);
          title = input.drinks.length === 1 ? input.drinks[0].draft.name : `${input.drinks.length} recipes`;
        }
        if (input.kind === 'menu') {
          const groups: PlacedGroup[] = [];
          const newPrices: { id: string; price: string }[] = [];
          for (const row of input.rows) {
            let drink: MenuDrink;
            if ('drink' in row) {
              drink = row.drink;
              summary.drinksHad += 1;
            } else {
              const id = await make(row.make);
              drink = newDrinkItem(id, row.make.draft.name, row.price);
              if (row.price) newPrices.push({ id, price: row.price });
            }
            const last = groups[groups.length - 1];
            if (last && last.name === row.section) last.drinks.push(drink);
            else groups.push({ name: row.section, drinks: [drink] });
          }
          if (input.prices.length || newPrices.length) await prices.mutateAsync([...input.prices, ...newPrices]);
          const layout = applyMenuPaste({ name: input.name, coverUrl: null, coverPosition: 50, sections: [blankSection()] }, null, groups);
          menuId = await createMenu.mutateAsync({ barId: barId, layout, night: input.night ?? undefined });
          title = input.name;
        }
        if (input.kind === 'bottles') {
          if (input.shelf.length) await shelf.add.mutateAsync(input.shelf);
          for (const bottle of input.venue) itemIds.push(await venueBottle.add.mutateAsync(bottle));
          summary.bottles = input.shelf.length + input.venue.length;
          summary.drinksHad = input.had;
          title = `${summary.bottles} ${summary.bottles === 1 ? 'bottle' : 'bottles'}`;
        }
      } catch (e) {
        // What was made before the failure is still recorded, so it can be undone.
        const message = plainDbMessage(e) ?? (e instanceof Error ? e.message : 'Couldn’t save it all.');
        if (!itemIds.length && !menuId) throw new Error(message);
        warnings.push(`Saved part of it, then stopped. ${message}`);
      }

      const batchId = await record.mutateAsync({
        barId: barId,
        source: input.source,
        title: title || 'Brought in',
        menuId,
        itemIds,
        shelfIds: input.kind === 'bottles' ? input.shelf : [],
        prices: input.kind === 'menu' ? input.prices : [],
        summary,
      });
      return { batchId, kind: input.kind, title: title || 'Brought in', source: input.source, menuId, drinkIds, summary, createdAt: new Date().toISOString(), warnings };
    },
    onError: () => {},
  });
}
