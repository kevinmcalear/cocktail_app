import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { RadioCard } from '@/components/screens/publishing/RadioCard';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import { useSaveClaimSetup } from '@/hooks/useBarClaims';
import { useBarPublishing, useSetPublish } from '@/hooks/usePublishing';
import type { ProfileClaim } from '@/hooks/useProfiles';
import { PAGE_COPY, PAGE_VISIBILITIES, type PageVisibility } from '@/lib/pageVisibility';
import type { HeldSetup } from '@/store/useVenueSetup';

import { SetupRoles } from './SetupRoles';

interface Props {
  barId: string | null;
  name: string;
  claim: ProfileClaim | null;
  writable: boolean;
  /** Kept with the setup before there's a claim. */
  held: HeldSetup | undefined;
  onHold: (change: HeldSetup) => void;
  onDone: () => void;
}

/**
 * Who sees what: outside the venue, its page (the Publishing choice, made
 * compact); inside, what each role can do (E29, SetupRoles). The page choice is picked
 * before there's a claim it's kept with the setup and goes onto the claim
 * when it's sent; while the claim waits it waits on the claim and takes over
 * when it's approved (b19); once the page is the venue's it saves straight away.
 */
export function VisibilityStep(props: Props) {
  if (props.writable && props.barId) return <FromVenue {...props} barId={props.barId} />;
  // A claim not sent or still waiting isn't verified yet, so Private stays closed.
  const pending = props.claim?.status === 'pending';
  return <Choose {...props} current={(pending ? props.claim?.setup?.page_visibility : props.held?.page_visibility) ?? 'description'} privateAllowed={false} />;
}

/** The venue's own page: start from what it has now. */
function FromVenue(props: Props & { barId: string }) {
  const publishing = useBarPublishing(props.barId);
  if (!publishing.data) return <SetupPage>{null}</SetupPage>;
  return <Choose {...props} current={publishing.data.pageVisibility} privateAllowed={publishing.data.privateAllowed} />;
}

function Choose({ barId, name, claim, writable, onHold, onDone, current, privateAllowed }: Props & { current: PageVisibility; privateAllowed: boolean }) {
  const setPublish = useSetPublish(barId);
  const saveSetup = useSaveClaimSetup();
  const pending = !writable && claim?.status === 'pending';
  const [value, setValue] = useState<PageVisibility | null>(null);
  const shown = value ?? current;
  const busy = setPublish.isPending || saveSetup.isPending;

  const save = () => {
    // While the claim waits the choice is always kept, even the default: approving otherwise starts the page at Menu.
    if (pending && claim) return saveSetup.mutate({ claimId: claim.id, setup: { page_visibility: shown } }, { onSuccess: onDone });
    // Before a claim it's kept the same way, and goes onto the claim when it's sent.
    if (!writable) {
      onHold({ page_visibility: shown });
      return onDone();
    }
    if (!value || value === current) return onDone();
    setPublish.mutate({ level: 'page', visibility: value }, { onSuccess: onDone });
  };
  const error = (setPublish.error ?? saveSetup.error)?.message ?? null;
  const note = pending
    ? `Today ${name}’s page is unclaimed, so it shows its menu: photos, descriptions and ingredients without amounts. This takes over once your claim is approved. Any single drink can still be kept private from its own page, and you can change this in Publishing once every 30 days.`
    : writable
      ? 'Any single drink can still be kept private from its own page, and you can change this in Publishing.'
      : `Kept with your setup. It takes over once we’ve checked ${name} is yours (the last step); until then its page stays as it is. Any single drink can still be kept private from its own page.`;

  return (
    <SetupPage footer={<SetupFooter pending={busy} onPress={save} />}>
      <View style={styles.group}>
        <SectionHeading>{`Outside ${name} · your page`}</SectionHeading>
        <View role="radiogroup" accessibilityLabel="Who sees your page" style={styles.group}>
          {PAGE_VISIBILITIES.map((v) => {
            const closed = v === 'private' && !privateAllowed;
            return <RadioCard key={v} label={PAGE_COPY[v].label} selected={shown === v} disabled={busy || closed} onPress={() => setValue(v)} />;
          })}
        </View>
        <Caption tone="muted">{`${PAGE_COPY[shown].label}: ${PAGE_COPY[shown].detail}${privateAllowed ? '' : ' Private opens once your claim is verified.'}`}</Caption>
        {error ? <Caption tone="accent" role="alert">{error}</Caption> : null}
        <Caption tone="muted">{note}</Caption>
      </View>
      {barId ? <SetupRoles barId={barId} name={name} /> : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
});
