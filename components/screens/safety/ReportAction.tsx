import { useState } from 'react';

import { GlassButton } from '@/components/ds';
import { useSignedIn } from '@/ctx/AuthContext';

import type { ReportChoice } from './ReportSheet';
import { ReportSheet } from './ReportSheetLazy';

/** A "Report" pill that opens the sheet. Signed in only: reports need an account. */
export function ReportAction({ subject, targets, onMedia }: { subject: string; targets: ReportChoice[]; onMedia?: boolean }) {
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);
  if (!signedIn || !targets.length) return null;
  return (
    <>
      <GlassButton accessibilityLabel={`Report ${subject}`} label="Report" icon="flag" onMedia={onMedia} onPress={() => setOpen(true)} />
      {open ? <ReportSheet subject={subject} targets={targets} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
