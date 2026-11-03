import { StyleSheet, View } from 'react-native';

import { Caption, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAskToJoin, useMyJoinRequest } from '@/hooks/useJoinRequests';
import type { Profile } from '@/hooks/useProfiles';

/**
 * A claimed bar's page, for someone not on its team: "Work here? Ask to join",
 * which its Admin answers. Its own module so the bar page's first load doesn't
 * carry the join hooks (ClaimLine loads it lazily).
 */
export function StaffDoor({ profile, barId, onFind }: { profile: Profile; barId: string; onFind?: () => void }) {
  const asked = useMyJoinRequest(barId).data;
  const ask = useAskToJoin();
  return (
    <View style={styles.line}>
      <Caption tone="muted">Work here?</Caption>
      {asked ? (
        <Caption tone="muted">{asked.declined_at ? 'The team said no.' : 'You asked to join.'}</Caption>
      ) : (
        <TextLink label={ask.isPending ? 'Asking…' : 'Ask to join'} accessibilityHint={`Asks ${profile.display_name}’s Admin to add you to the team`} onPress={() => ask.mutate(profile.id)} />
      )}
      {onFind ? <Caption tone="muted">·</Caption> : null}
      {onFind ? <TextLink label="Find your name" accessibilityHint="Opens the people listed here" onPress={onFind} /> : null}
      {ask.error ? (
        <Caption tone="accent" role="alert">
          {ask.error.message}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm },
});
