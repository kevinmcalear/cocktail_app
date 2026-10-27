import { useState, type ReactNode } from 'react';

import { BackbarTheme, BrandProvider } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIngredient } from '@/hooks/useIngredients';
import { useMode } from '@/hooks/useMode';
import { useItemPrep } from '@/hooks/usePrepCard';
import { useCanEditItem } from '@/hooks/useViewAs';
import { changeReason, type ChangeLine } from '@/lib/prepChange';

import { PrepVersionSheet } from './PrepVersionSheet';

/** The editor's form, as it stands at Save. */
export interface PrepForm {
  name: string;
  description: string;
  abv: string;
  lines: { ingredient_id: string; name: string; amount: string; unit: string }[];
}

interface OldRow {
  ingredient: { id?: string; name: string } | null;
  amount: string | number | null;
  unit: string | null;
}

const num = (v: string | number | null) => (v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Decided on the canvas: a prep other drinks use, or one that isn't yours to
 * change, asks at Save (prep-prep-edit-shared), not before editing. Call
 * `ask()` from Save: true means the question is up and the save waits on
 * it. Render `sheet` in the editor.
 */
export function useAskAtSave(id: string, form: PrepForm, save: () => void): { ask: () => boolean; sheet: ReactNode } {
  const [open, setOpen] = useState(false);
  const { data } = useIngredient(id);
  const { data: card } = useItemPrep(id);
  const item = data?.ingredient ?? null;
  const canEdit = useCanEditItem(item);
  const home = useMode().mode === 'home';
  const { venues, active } = useActiveVenue();
  const venue = home ? null : active;
  const brand = venues.find((v) => v.id === item?.bar_id) ?? venue;
  const drinks = data?.usedIn?.length ?? 0;
  const isPrep = form.lines.length > 0 || item?.ingredient_role === 'prep';
  const needed = !!item && isPrep && (drinks > 1 || !canEdit);

  const before: ChangeLine[] = ((data?.recipe ?? []) as OldRow[])
    .filter((r) => r.ingredient?.id)
    .map((r) => ({ ingredientId: r.ingredient!.id!, name: r.ingredient!.name, amount: num(r.amount), unit: r.unit || null }));
  const after: ChangeLine[] = form.lines.map((l) => ({ ingredientId: l.ingredient_id, name: l.name, amount: num(l.amount), unit: l.unit || null }));

  const sheet = open ? (
    <BackbarTheme>
      <BrandProvider accent={brand?.accent ?? undefined}>
        <PrepVersionSheet
          visible
          onClose={() => setOpen(false)}
          source={{
            id,
            name: form.name.trim() || item?.name || '',
            description: form.description.trim() || null,
            abv: form.abv ? Number(form.abv) : null,
            lines: form.lines.map((l) => ({ ingredientId: l.ingredient_id, amount: l.amount, unit: l.unit || null, note: null, optional: false })),
            card,
          }}
          drinks={drinks}
          venue={venue ? { id: venue.id, name: venue.name } : null}
          reason={changeReason(before, after)}
          onEditAll={canEdit ? save : undefined}
        />
      </BrandProvider>
    </BackbarTheme>
  ) : null;

  return {
    ask: () => {
      if (!needed) return false;
      setOpen(true);
      return true;
    },
    sheet,
  };
}
