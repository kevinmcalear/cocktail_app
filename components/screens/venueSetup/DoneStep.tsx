import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, TextLink, useDs, type IconName } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { SetupHead } from '@/components/screens/onboarding/SetupParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Venue } from '@/hooks/useActiveVenue';
import { GROUND_TINTS, displayFaces, radius, space } from '@/constants/tokens';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useBarInvites, useSendInviteEmail } from '@/hooks/useBarInvites';
import { useBarPublishing } from '@/hooks/usePublishing';
import type { ProfileClaim } from '@/hooks/useProfiles';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import { faceFromDb, normalizeHex } from '@/lib/brand';
import { colourName } from '@/lib/brandColours';
import { withAlpha } from '@/lib/color';
import { PAGE_COPY, type PageVisibility } from '@/lib/pageVisibility';
import { namesLine, onItsWay, type ClaimState } from '@/lib/venueSetup';

import { SetupBanner } from './SetupBanner';

/** How the claim is being checked, in a few words. */
const CLAIM_LINE = { email: 'Work email', instagram: 'A code sent from the bar’s Instagram', phone: 'A call to the bar', note: 'A call to the bar' } as const;

/** The summary's mark: the venue's logo with a check in the accent beside it. */
export function DoneMark({ venue }: { venue: Venue }) {
  const ds = useDs();
  return (
    <View style={styles.head} aria-hidden>
      <VenueMark venue={venue} size={64} />
      <View style={[styles.badge, { backgroundColor: ds.accentFill.fill }]}>
        <IconSymbol name="checkmark" size={16} color={ds.accentFill.text} />
      </View>
    </View>
  );
}

/** One line of the summary: still on its way (a dashed ring) or done (a tinted check). */
function Line({ icon, title, line, end, waiting }: { icon: IconName; title: string; line: string; end?: ReactNode; waiting?: boolean }) {
  const ds = useDs();
  return (
    <View role="listitem" style={[styles.line, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.mark, waiting ? { borderColor: ds.c.lineStrong, borderWidth: 1, borderStyle: 'dashed' } : { backgroundColor: withAlpha(ds.accentText, 0.18) }]}>
        <IconSymbol name={icon} size={13} color={waiting ? ds.c.ink : ds.accentText} />
      </View>
      <View style={styles.flex}>
        <DsText variant="body">{title}</DsText>
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
  const tint = `${GROUND_TINTS.find((t) => normalizeHex(t.hex) === normalizeHex(brand?.ground_tint ?? ''))?.label ?? 'Standard'} ground`;
  const accent = brand?.primary_color ? normalizeHex(brand.primary_color) : null;
  // "Rust, Instrument Serif, Walnut ground": the colour by name, as the Look step showed it.
  const look = brand ? [accent ? colourName(accent) : 'App colours', displayFaces[faceFromDb(brand.display_face)].label, tint].join(', ') : '';

  return (
    <SetupPage footer={<SetupFooter label="Open Tonight" onPress={onOpen} />}>
      {count ? (
        <>
          <SetupHead>On its way</SetupHead>
          <View role="list" style={styles.list}>
            {claimState === 'pending' && claim ? (
              <Line waiting icon="lock.shield.fill" title="Claim being checked" line={`${CLAIM_LINE[claim.method]}. Usually within a day.`} />
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
            {waitingFiles ? <Line waiting icon="arrow.clockwise" title="Spec book waiting" line="We’ll tap you when it’s ready to check." /> : null}
          </View>
        </>
      ) : null}
      <SetupHead>Done</SetupHead>
      <View role="list" style={styles.list}>
        <Line icon="checkmark" title="You’re Admin" line={name} />
        {facts ? <Line icon="checkmark" title="Location and hours" line={[facts.address_line, facts.locality ?? facts.city].filter(Boolean).join(', ') || 'Typed by you'} /> : null}
        {brand ? <Line icon="checkmark" title="Look" line={look} /> : null}
        <Line icon="checkmark" title="Who sees your page" line={claimState === 'pending' ? `${PAGE_COPY[shown].label}, once the claim is approved` : PAGE_COPY[shown].label} />
      </View>
      {count ? (
        <>
          <SetupHead>On Tonight</SetupHead>
          <SetupBanner count={count} />
        </>
      ) : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  mark: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  badge: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
