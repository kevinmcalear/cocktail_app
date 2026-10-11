import { useState } from 'react';

import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { PageVisibilityChoice } from '@/components/screens/publishing/PageVisibilityChoice';
import { useSaveClaimSetup } from '@/hooks/useBarClaims';
import { useBarPublishing, useSetPublish } from '@/hooks/usePublishing';
import type { ProfileClaim } from '@/hooks/useProfiles';
import type { PageVisibility } from '@/lib/pageVisibility';

interface Props {
  barId: string | null;
  name: string;
  claim: ProfileClaim | null;
  writable: boolean;
  onDone: () => void;
}

/**
 * Step 6: who outside the venue sees its page (the Publishing choice). Picked
 * before approval it waits on the claim and takes over when it's approved
 * (b19); once the page is the venue's it saves straight away.
 */
export function VisibilityStep(props: Props) {
  if (props.writable && props.barId) return <FromVenue {...props} barId={props.barId} />;
  return <Choose {...props} current={props.claim?.setup?.page_visibility ?? 'description'} />;
}

/** The venue's own page: start from what it has now. */
function FromVenue(props: Props & { barId: string }) {
  const publishing = useBarPublishing(props.barId);
  if (!publishing.data) return <SetupPage>{null}</SetupPage>;
  return <Choose {...props} current={publishing.data.pageVisibility} />;
}

function Choose({ barId, name, claim, writable, onDone, current }: Props & { current: PageVisibility }) {
  const setPublish = useSetPublish(barId);
  const saveSetup = useSaveClaimSetup();
  const pending = !writable && claim?.status === 'pending';
  const [value, setValue] = useState<PageVisibility | null>(null);
  const shown = value ?? current;
  const busy = setPublish.isPending || saveSetup.isPending;

  const save = () => {
    // While the claim waits the choice is always kept, even the default: approving otherwise starts the page Locked.
    if (pending && claim) return saveSetup.mutate({ claimId: claim.id, setup: { page_visibility: shown } }, { onSuccess: onDone });
    if (!value || value === current) return onDone();
    if (writable) setPublish.mutate({ level: 'page', visibility: value }, { onSuccess: onDone });
    else onDone();
  };
  const note = pending
    ? `Today ${name}’s page is unclaimed, so it shows drink names and descriptions. This takes over once your claim is approved. Any single drink can still be kept private from its own page, and you can change this in Publishing.`
    : writable
      ? 'Any single drink can still be kept private from its own page, and you can change this in Publishing.'
      : 'This applies once your bar’s page is claimed. Any single drink can still be kept private from its own page.';

  return (
    <SetupPage footer={<SetupFooter pending={busy} onPress={save} onSkip={onDone} />}>
      <PageVisibilityChoice bare venueName={name} value={shown} onChange={setValue} disabled={busy} error={(setPublish.error ?? saveSetup.error)?.message ?? null} note={note} />
    </SetupPage>
  );
}
