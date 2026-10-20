import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { isUnclaimed, useMyPersonClaim, type Profile } from '@/hooks/useProfiles';
import { needsOnboarding } from '@/lib/onboarding';

/**
 * "See your name? Tap it." under a bar's header (find-yourself step 2), for
 * anyone signed in who hasn't claimed a person's page: the credits below are
 * links to it. While the bar is unclaimed, "I run Pale Moth" opens venue
 * setup at its claim step.
 * ponytail: venue setup isn't open during Setup (its guard sends it back),
 * so "I run" waits until Setup is done; letting it through is an auth-flow change.
 */
export function SeeYourName({ profile }: { profile: Profile }) {
  const ds = useDs();
  const router = useRouter();
  const { user } = useAuth();
  const { data: claim, isPending } = useMyPersonClaim();
  if (!user || isPending || claim) return null;
  const runIt = isUnclaimed(profile) && !needsOnboarding(user.user_metadata);
  return (
    <View style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
      <View style={styles.text}>
        <Headline role="heading">See your name? Tap it.</Headline>
        <Body tone="muted">Every drink credited to you is on your page, from every bar.</Body>
      </View>
      {runIt ? <Button label={`I run ${profile.display_name}`} variant="secondary" dense onPress={() => router.push(`/venue-setup?claim=${profile.id}` as Href)} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  text: { flexGrow: 1, flexShrink: 1, flexBasis: 220, gap: space.xs },
  button: { alignSelf: 'flex-start' },
});
