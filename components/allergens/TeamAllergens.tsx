import { useState } from 'react';

import { useDrinkAllergens } from '@/hooks/useAllergens';
import { fromStaff } from '@/lib/allergenWords';
import type { SpecLine } from '@/lib/spec';

import { AllergenCheckSheet } from './AllergenCheckSheet';
import { AllergenList, AllergensFailed } from './AllergenList';

interface TeamAllergensProps {
  itemId: string;
  name: string;
  barId: string;
  barName: string | null;
  /** Edits drinks at its bar: the footer opens the check (board Loop-allergy, "The bar checks"). */
  canCheck: boolean;
  /** The spec's lines, for the check sheet's table. */
  lines: SpecLine[];
}

/** A bar drink's Allergens for its own team, read with the check's state, and the check for those who edit drinks. */
export function TeamAllergens({ itemId, name, barId, barName, canCheck, lines }: TeamAllergensProps) {
  const [checking, setChecking] = useState(false);
  const { data, isError } = useDrinkAllergens(itemId);
  if (isError) return <AllergensFailed />;
  // Still loading, or nothing to declare (no spec): no section rather than one about nothing.
  if (!data || (data.lines === 0 && !data.allergens.length)) return null;
  return (
    <>
      <AllergenList read={fromStaff(data)} barName={barName} staff onCheck={canCheck ? () => setChecking(true) : undefined} />
      {canCheck && checking ? <AllergenCheckSheet itemId={itemId} name={name} barId={barId} barName={barName} data={data} lines={lines} onClose={() => setChecking(false)} /> : null}
    </>
  );
}
