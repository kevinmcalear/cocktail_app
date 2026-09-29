import { useEffect, useRef, useState } from 'react';

import { Button, Caption } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { useAgeCheck } from '@/hooks/useAgeCheck';

import { AgeCheckForm, UnderAgeNote } from './AgeCheckForm';

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

function AgeGateSheet({ onClose, onConfirmed }: { onClose: () => void; onConfirmed: () => void }) {
  const { data: status, isError } = useAgeCheck();
  // Once confirmed (on submit, or when the check finishes loading), carry on
  // with what they were doing. Once only.
  const done = useRef(false);
  useEffect(() => {
    if (status === 'confirmed' && !done.current) {
      done.current = true;
      onConfirmed();
    }
  }, [status, onConfirmed]);

  const underAge = status === 'under_age';
  return (
    <MenuSheet
      visible
      onClose={onClose}
      title={underAge ? 'Not available' : 'Check your age'}
      footer={underAge ? <Button label="OK" variant="secondary" onPress={onClose} /> : undefined}
    >
      {underAge ? (
        <UnderAgeNote />
      ) : status === 'unknown' ? (
        <AgeCheckForm />
      ) : (
        <Caption tone="muted">{isError ? "Couldn't check your account. Close this and try again." : 'Checking…'}</Caption>
      )}
    </MenuSheet>
  );
}
