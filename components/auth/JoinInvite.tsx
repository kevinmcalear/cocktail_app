import { Button, Text, YStack } from 'tamagui';

import { AuthShell, type AuthBrand } from '@/components/auth/AuthShell';
import { useAuth } from '@/ctx/AuthContext';
import { useAcceptInvite, useRemoveInvite, type BarInvite } from '@/hooks/useBarInvites';
import { roleLabel } from '@/lib/roles';

/**
 * On a venue's staff link: the signed-in person has an invite to this venue.
 * Joining turns it into a membership (accept_bar_invite); declining removes it.
 */
export function JoinInvite({ invite, venueName, brand }: { invite: BarInvite; venueName: string; brand: AuthBrand }) {
  const { user } = useAuth();
  const accept = useAcceptInvite(invite.bar_id);
  const decline = useRemoveInvite(invite.bar_id);
  const busy = accept.isPending || decline.isPending;
  const failed = accept.error || decline.error;

  return (
    <AuthShell
      brand={brand}
      title={`Join ${venueName}`}
      subtitle={`${venueName} invited ${user?.email ?? 'you'} to the team as ${roleLabel(invite.role_level)}.`}
    >
      <YStack gap="$3">
        {failed ? (
          <Text fontSize="$3" color="$red10" role="alert">
            Couldn’t save that. Check your connection and try again.
          </Text>
        ) : null}
        <Button backgroundColor="$color8" height="$4" disabled={busy} opacity={busy ? 0.6 : 1} onPress={() => accept.mutate()}>
          <Text color="$backgroundStrong" fontWeight="700" fontSize="$4">
            {accept.isPending ? 'Joining…' : 'Join the team'}
          </Text>
        </Button>
        <Button chromeless height="$4" disabled={busy} onPress={() => decline.mutate(invite.id)}>
          <Text color="$color11" fontWeight="600" fontSize="$4">
            No thanks
          </Text>
        </Button>
      </YStack>
    </AuthShell>
  );
}
