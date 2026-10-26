import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, GlassButton, Headline, PressableScale, sheetIsDialog, useBreakpoint, useDs, type IconName } from '@/components/ds';
import { ClaimDialog } from '@/components/screens/claim/ClaimDialog';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { isUnclaimed, useMyClaims, useMyPersonClaim, type Profile } from '@/hooks/useProfiles';
import { useMyBlocks, useProfileUserId, useSetBlocked } from '@/hooks/useSafety';
import { needsOnboarding } from '@/lib/onboarding';
import { parseProfileRef } from '@/lib/profiles';

import { claimBar } from '../profile/ClaimProfile';

import { useHideBarToggle } from '../kept/useHideBarToggle';

import { ReportSheet } from './ReportSheet';

export const BLOCK_EFFECT = 'You won’t see each other’s drinks, rankings or profile. They aren’t told you blocked them.';

/**
 * "More" on someone else's profile: report it, and for a person, block
 * them; for a bar, hide it from your Discover. Signed in only. Bars can be
 * reported but not blocked: blocks are between people. The claim prompts
 * lead it (Q33, approved 26 Oct 2026), so the page itself stays quiet.
 */
export function ProfileSafety({ profile }: { profile: Profile }) {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [sheet, setSheet] = useState<'menu' | 'report' | 'block' | 'claim' | null>(null);
  const claims = useClaimRows(profile, () => setSheet(null), () => setSheet('claim'));
  const { data: userId } = useProfileUserId(profile.kind === 'person' ? profile.id : null);
  const setBlocked = useSetBlocked();
  const hiding = useHideBarToggle(profile.id, profile.display_name);
  // Not on my own profile, or on a private one (only its owners see those).
  if (!myId || userId === myId || !profile.is_public) return null;
  const name = `@${profile.handle}`;
  const canBlock = profile.kind === 'person' && !!userId;
  const bar = profile.kind === 'bar';
  const does = [claims.length ? 'claim' : null, bar ? (hiding.hidden ? 'show in Discover' : 'hide from Discover') : null, 'report', canBlock ? 'block' : null].filter(Boolean).join(', ');

  return (
    <>
      <GlassButton accessibilityLabel={`More for ${name}: ${does}`} icon="ellipsis" onPress={() => setSheet('menu')} />
      {sheet === 'menu' ? (
        <MenuSheet visible onClose={() => setSheet(null)} title={profile.display_name} subtitle={name}>
          {claims.length ? <View>{claims.map((c) => <ClaimRow key={c.label} {...c} />)}</View> : null}
          {bar ? (
            <Button
              label={hiding.hidden ? 'Show in Discover' : 'Hide from Discover'}
              icon={hiding.hidden ? 'eye' : 'eye.slash'}
              variant="secondary"
              onPress={() => {
                setSheet(null);
                hiding.toggle();
              }}
            />
          ) : null}
          <Button label={`Report ${name}`} icon="flag" variant="secondary" onPress={() => setSheet('report')} />
          {canBlock ? <Button label={`Block ${name}`} variant="secondary" onPress={() => setSheet('block')} /> : null}
        </MenuSheet>
      ) : null}
      {sheet === 'claim' ? <ClaimDialog profileRef={profile.id} name={profile.display_name} onClose={() => setSheet(null)} /> : null}
      {sheet === 'report' ? (
        <ReportSheet subject={name} targets={[{ label: name, target: { kind: 'profile', profileId: profile.id } }]} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'block' && userId ? (
        <MenuSheet
          visible
          onClose={() => setSheet(null)}
          title={`Block ${name}?`}
          footer={
            <>
              {setBlocked.error ? (
                <Caption tone="accent" role="alert">
                  Couldn’t block them. Check your connection and try again.
                </Caption>
              ) : null}
              <Button
                label={setBlocked.isPending ? 'Blocking…' : `Block ${name}`}
                disabled={setBlocked.isPending}
                onPress={() => setBlocked.mutate({ userId, blocked: true }, { onSuccess: () => setSheet(null) })}
              />
            </>
          }
        >
          <Body>{BLOCK_EFFECT}</Body>
          <Body tone="muted">You can unblock them any time from Settings, under Blocked people.</Body>
        </MenuSheet>
      ) : null}
    </>
  );
}

interface ClaimRowProps {
  icon: IconName;
  label: string;
  detail: string;
  onPress: () => void;
}

/**
 * More's claim rows (w2-bar-pages Q33): a bar's "Is this your bar?" and, on a
 * phone, "Worked here?" (its People tab); a person's "Is this you?" (its
 * claim sheet); a maker's or supplier's "Claim this page". Each closes More
 * first. None once a claim is on its way, or on a claimed page.
 */
function useClaimRows(profile: Profile, close: () => void, dialog: () => void): ClaimRowProps[] {
  const router = useRouter();
  const { user } = useAuth();
  const phone = useBreakpoint() === 'phone';
  const latest = useMyClaims(user ? profile.id : null).data?.[0];
  const { data: person, isPending } = useMyPersonClaim();
  const unclaimed = isUnclaimed(profile);
  const sent = latest?.status === 'pending';
  const name = profile.display_name;
  const then = (go: () => void) => () => {
    close();
    go();
  };
  if (!user) return [];
  if (profile.kind === 'bar') {
    const rows: (ClaimRowProps | null)[] = [
      unclaimed && !sent ? { icon: 'building.2', label: 'Is this your bar?', detail: `Claim ${name} and set it up`, onPress: then(() => claimBar(router, profile.id, needsOnboarding(user.user_metadata))) } : null,
      phone && !isPending && !person ? { icon: 'person.crop.circle', label: 'Worked here?', detail: 'Find your name in its credits', onPress: then(() => router.setParams({ tab: 'people' })) } : null,
    ];
    return rows.filter((r): r is ClaimRowProps => !!r);
  }
  if (!unclaimed) return [];
  if (profile.kind === 'person') return sent ? [] : [{ icon: 'person.crop.circle', label: 'Is this you?', detail: `Claim ${name}’s page and the drinks credited to it`, onPress: then(() => router.setParams({ claim: '1' })) }];
  // A maker's or supplier's claim screen, as a dialog over the page on wide web (ClaimProfile).
  const open = then(() => (sheetIsDialog && !phone ? dialog() : router.push(`/p/${profile.id}/claim` as Href)));
  if (sent) return [{ icon: 'checkmark.seal.fill', label: 'See your claim', detail: 'Your claim is being checked', onPress: open }];
  return [{ icon: 'checkmark.seal.fill', label: profile.kind === 'maker' ? 'Make this?' : 'Your company?', detail: 'Claim this page', onPress: open }];
}

/** A claim row in More: an icon, what it asks, and what it does (w2-bar-pages Q33). */
function ClaimRow({ icon, label, detail, onPress }: ClaimRowProps) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`${label} ${detail}`} onPress={onPress} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <IconSymbol name={icon} size={20} color={ds.c.ink} />
      <View style={styles.rowText}>
        <Body>{label}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
    </PressableScale>
  );
}

/**
 * Shown on a profile link to someone I've blocked (their profile is hidden
 * from me), so it doesn't look like it vanished, and it can be undone here.
 * Anyone else's missing profile shows `children`.
 */
export function BlockedProfileNote({ profileRef, children }: { profileRef: string | string[] | undefined; children: ReactNode }) {
  const router = useRouter();
  const ref = parseProfileRef(profileRef);
  const { data: blocks } = useMyBlocks();
  const setBlocked = useSetBlocked();
  const blocked = ref && blocks?.find((b) => ('id' in ref ? b.profile_id === ref.id : b.handle === ref.handle));
  if (!blocked) return <>{children}</>;
  const name = blocked.handle ? `@${blocked.handle}` : 'this person';
  return (
    <View style={styles.note} role="status">
      <Headline role="heading">{`You blocked ${name}`}</Headline>
      <Body>{BLOCK_EFFECT}</Body>
      {setBlocked.error ? (
        <Caption tone="accent" role="alert">
          Couldn’t unblock them. Check your connection and try again.
        </Caption>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={setBlocked.isPending ? 'Unblocking…' : `Unblock ${name}`}
          variant="secondary"
          disabled={setBlocked.isPending}
          onPress={() => setBlocked.mutate({ userId: blocked.blocked_id, blocked: false })}
        />
        <Button label="Blocked people" variant="ghost" onPress={() => router.push('/settings/blocked')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md + 2, minHeight: 60, paddingVertical: space.xs + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
});
