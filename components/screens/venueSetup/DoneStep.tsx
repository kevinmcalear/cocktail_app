import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, TextLink, useDs, type IconName } from '@/components/ds';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GROUND_TINTS, displayFaces, radius, space } from '@/constants/tokens';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useBarInvites, useSendInviteEmail } from '@/hooks/useBarInvites';
import { useBarPublishing } from '@/hooks/usePublishing';
import type { ProfileClaim } from '@/hooks/useProfiles';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import { faceFromDb, normalizeHex } from '@/lib/brand';
import { METHOD_COPY } from '@/lib/claimVerification';
import { PAGE_COPY, type PageVisibility } from '@/lib/pageVisibility';
import { namesLine, onItsWay, type ClaimState } from '@/lib/venueSetup';

import { SetupBanner } from './SetupBanner';

function Line({ icon, title, line, end, waiting }: { icon: IconName; title: string; line: string; end?: ReactNode; waiting?: boolean }) {
  const ds = useDs();
  return (
    <View role="listitem" style={styles.line}>
      <View style={[styles.mark, { backgroundColor: waiting ? ds.c.raised : ds.accentFill.fill }]}>
        <IconSymbol name={icon} size={14} color={waiting ? ds.c.ink : ds.accentFill.text} />
      </View>
      <View style={styles.flex}>
        <DsText variant="headline">{title}</DsText>
        <Caption tone="muted">{line}</Caption>
      </View>
      {end}
    </View>
  );
}

/**
 * The summary (canvas make-venue-done): what's on its way (the claim, the
 * invites nobody's taken up, what's waiting to be read) and what's done.
 */
export function DoneStep({
  barId,
  profileId,
  name,
  claim,
  claimState,
  waitingFiles,
  onOpen,
}: {
  barId: string;
  profileId: string | null;
  name: string;
  claim: ProfileClaim | null;
  claimState: ClaimState;
  waitingFiles: number;
  onOpen: () => void;
}) {
  const invites = useBarInvites(barId).data ?? [];
  const resend = useSendInviteEmail(barId);
  const brand = useVenueBrand(barId).data;
  const facts = useBarFacts(profileId).data;
  const visibility = (useBarPublishing(barId).data?.pageVisibility ?? null) as PageVisibility | null;
  const held = claimState === 'pending' ? claim?.setup?.page_visibility : null;
  // Approval starts the page Locked unless setup kept a choice on the claim.
  const shown = claimState === 'pending' ? (held ?? 'locked') : (visibility ?? 'locked');
  const names = invites.map((i) => i.name?.trim().split(/\s+/)[0] || i.email);
  const count = onItsWay({ claim: claimState, invites: invites.length, waitingFiles });
  const tint = GROUND_TINTS.find((t) => normalizeHex(t.hex) === normalizeHex(brand?.ground_tint ?? ''))?.label ?? 'Standard ground';
  const look = brand ? [brand.primary_color ? normalizeHex(brand.primary_color) : 'App colours', displayFaces[faceFromDb(brand.display_face)].label, tint].join(', ') : '';

  return (
    <SetupPage footer={<SetupFooter label="Open Tonight" onPress={onOpen} />}>
      {count ? (
        <>
          <Headline role="heading">On its way</Headline>
          <View role="list" style={styles.list}>
            {claimState === 'pending' && claim ? (
              <Line waiting icon="clock.arrow.circlepath" title="Claim being checked" line={`${METHOD_COPY[claim.method === 'note' ? 'phone' : claim.method].short}. Usually within a day.`} />
            ) : null}
            {invites.length ? (
              <Line
                waiting
                icon="envelope"
                title={invites.length === 1 ? 'One invite sent' : `${invites.length} invites sent`}
                line={`${namesLine(names)} ${invites.length === 1 ? 'hasn’t' : 'haven’t'} joined yet.`}
                end={<TextLink label={resend.isPending ? 'Sending…' : 'Resend'} onPress={() => invites.forEach((i) => resend.mutate(i.email))} />}
              />
            ) : null}
            {waitingFiles ? <Line waiting icon="doc.text" title="Spec book waiting" line="We read it when you open Bring in. You check every drink before it’s saved." /> : null}
          </View>
        </>
      ) : null}
      <Headline role="heading">Done</Headline>
      <View role="list" style={styles.list}>
        <Line icon="checkmark" title="You’re Admin" line={name} />
        {facts ? <Line icon="checkmark" title="Location and hours" line={[facts.address_line, facts.locality ?? facts.city].filter(Boolean).join(', ') || 'Typed by you'} /> : null}
        {brand ? <Line icon="checkmark" title="Look" line={look} /> : null}
        <Line icon="checkmark" title="Who sees your page" line={claimState === 'pending' ? `${PAGE_COPY[shown].label}, once the claim is approved` : PAGE_COPY[shown].label} />
      </View>
      {count ? (
        <>
          <Headline role="heading">On Tonight</Headline>
          <SetupBanner count={count} />
        </>
      ) : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mark: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
