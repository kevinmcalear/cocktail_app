import { useState } from 'react';

import { useAgeCheck } from '@/hooks/useAgeCheck';

import { AgeGateSheet } from './AgeGateSheetLazy';

/**
 * Collecting, ranking and publishing your own drinks need a confirmed age.
 * `gate(action)` runs the action straight away once confirmed; otherwise it
 * asks first (the age check, or the under-age note), and runs it only after
 * a confirmed answer. Render `sheet` somewhere in the screen.
 */
export function useAgeGate() {
  const { data: status } = useAgeCheck();
  const [pending, setPending] = useState<{ run: () => void } | null>(null);
  const gate = (action: () => void) => (status === 'confirmed' ? action() : setPending({ run: action }));
  const sheet = pending ? (
    <AgeGateSheet
      onClose={() => setPending(null)}
      onConfirmed={() => {
        setPending(null);
        pending.run();
      }}
    />
  ) : null;
  return { gate, sheet, underAge: status === 'under_age' };
}
