import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Tag, sheetIsDialog, useBreakpoint } from '@/components/ds';
import { ClaimDialog } from '@/components/screens/claim/ClaimDialogLazy';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyClaims, type Profile } from '@/hooks/useProfiles';
import { needsOnboarding } from '@/lib/onboarding';

/**
 * "Claim this page" on a bar's, maker's or supplier's page, or where its
 * claim stands. It goes to its own claim screen (/p/<id>/claim), on wide web
 * screens a dialog over the page, or for a bar to step 2 of venue setup,
 * where the team proves it's theirs. A person's page has This is me instead
 * (ThisIsMe). Opened from Setup, a bar's goes back to Setup, which ends and
 * opens venue setup (setUpBar in OnboardingScreen).
 */
export function ClaimProfile({ profile, label = 'Claim this profile' }: { profile: Profile; label?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const { data: claims } = useMyClaims(profile.id);
  const latest = claims?.[0];
  const wide = useBreakpoint() !== 'phone';
  const asDialog = sheetIsDialog && wide;
  const [dialog, setDialog] = useState(false);
  const open = () => (userId && asDialog ? setDialog(true) : router.push((userId ? `/p/${profile.id}/claim` : '/auth/login') as Href));
  const claimDialog = dialog ? <ClaimDialog profileRef={profile.id} name={profile.display_name} onClose={() => setDialog(false)} /> : null;
  if (latest?.status === 'pending') {
    return (
      <View style={styles.centered} role="status">
        <Tag label="Claim sent" />
        <Caption tone="muted" align="center">
          {latest.code ? 'Your code is on the claim screen.' : 'A moderator is checking it.'}
        </Caption>
        <Button label="See your claim" variant="secondary" onPress={open} />
        {claimDialog}
      </View>
    );
  }
  return (
    <View style={styles.centered}>
      {latest?.status === 'rejected' ? (
        <Caption tone="muted" align="center">
          Your last claim wasn’t approved. You can try another way.
        </Caption>
      ) : null}
      <Button
        label={label}
        variant="secondary"
        icon="checkmark"
        accessibilityHint="Prove you work here and take over this page"
        // A bar's claim opens its claim screen: a pending claim only, no venue until it's approved (Kevin, 3 Nov 2026).
        onPress={() => (userId && profile.kind === 'bar' ? claimBar(router, profile.id, needsOnboarding(user?.user_metadata)) : open())}
      />
      {claimDialog}
    </View>
  );
}

/**
 * A bar's claim: its claim screen, which sends a pending claim and makes
 * nothing else. The venue is made, with the claimant as its Admin, when a
 * moderator approves it (Kevin, 3 Nov 2026); venue setup comes after that.
 * During Setup it still goes back to Setup with the bar (?run=).
 */
export function claimBar(router: ReturnType<typeof useRouter>, profileId: string, inSetup: boolean) {
  if (inSetup) router.dismissTo(`/onboarding?run=${profileId}` as Href);
  else router.push(`/p/${profileId}/claim` as Href);
}

const styles = StyleSheet.create({
  centered: { gap: space.sm, alignItems: 'center' },
});
