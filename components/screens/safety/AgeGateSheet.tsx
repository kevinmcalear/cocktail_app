import { useEffect, useRef } from 'react';

import { Button, Caption } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { useAgeCheck } from '@/hooks/useAgeCheck';

import { AgeCheckForm, UnderAgeNote } from './AgeCheckForm';

export type AgeGateSheetProps = { onClose: () => void; onConfirmed: () => void };

/** useAgeGate's sheet (AgeGate.tsx): the age check, or the under-age note. */
export function AgeGateSheet({ onClose, onConfirmed }: AgeGateSheetProps) {
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
