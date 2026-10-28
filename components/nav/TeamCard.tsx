import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useCanManageStaff, useEffectiveRole } from '@/hooks/useViewAs';
import { canSeeTeam } from '@/lib/team';

/**
 * Whether My team shows for this venue, and whether the viewer is an Admin
 * with nobody else on it yet (then the card asks them to invite people).
 */
export function useTeamCard(barId: string | null) {
  const role = useEffectiveRole(barId);
  const see = !!barId && canSeeTeam(role);
  const manage = useCanManageStaff(barId);
  const members = useBarMembers(see ? barId : null).data;
  const invited = useBarInvites(barId ?? '', see && manage);
  const invites = invited.data ?? [];
  // Decided only once both have loaded, so a team with invites out never flashes Invite your team.
  const alone = manage && !!members && members.length <= 1 && invited.isSuccess && invites.length === 0;
  return { see, manage, members, invites, alone };
}

/** Opens My team; `invite` opens its invite sheet too. */
export function useOpenTeam(before?: () => void) {
  const router = useRouter();
  return (invite = false) => {
    before?.();
    router.push((invite ? '/team?invite=1' : '/team') as Href);
  };
}

/** "Invite your team", for an Admin who is the only one on it (nav-switcher-team-alone, venue-library-empty-admin). */
export function InviteTeamCard({ onInvite }: { onInvite: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <View style={[styles.tile, { backgroundColor: ds.c.surface }]}>
        <IconSymbol name="place.team" size={20} color={ds.c.ink} />
      </View>
      <View style={styles.text}>
        <Body style={styles.strong}>Invite your team</Body>
        <Caption tone="muted">Only you so far. Each person sees what their role opens.</Caption>
      </View>
      <Button label="Invite" accessibilityLabel="Invite your team" onPress={onInvite} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  tile: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
