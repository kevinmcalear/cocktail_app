import { StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAcceptInvite, useRemoveInvite, type MyInvite } from '@/hooks/useBarInvites';

/**
 * Onboarding's first page for someone a venue invited: join (the short setup
 * follows) or decline (the invite goes, and the usual setup runs).
 */
export function InviteStep({ invite, onJoined, onDeclined }: { invite: MyInvite; onJoined: () => void; onDeclined: () => void }) {
  const accept = useAcceptInvite(invite.bar_id);
  const decline = useRemoveInvite(invite.bar_id);
  const busy = accept.isPending || decline.isPending;
  return (
    <View style={styles.stack}>
      {accept.error || decline.error ? (
        <Caption tone="accent" role="alert">
          Couldn’t save that. Check your connection and try again.
        </Caption>
      ) : null}
      <Button label={accept.isPending ? 'Joining…' : 'Join the team'} disabled={busy} onPress={() => accept.mutate(undefined, { onSuccess: onJoined })} />
      <Button label="No thanks" variant="ghost" disabled={busy} onPress={() => decline.mutate(invite.id, { onSuccess: onDeclined })} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
});
