import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body } from '@/components/ds';
import { InviteTeamCard, useOpenTeam, useTeamCard } from '@/components/nav/TeamCard';
import { CapsuleEmpty } from '@/components/screens/drinks/DrinksParts';
import { space } from '@/constants/tokens';
import type { StaffCapsule } from '@/lib/drinksTab';
import { useBringIn } from '@/store/useBringIn';

/**
 * The Drinks tab with nothing to show at a bar (Sta-drinks, Sta-capsules).
 * A capsule with nothing in it yet says what goes there and how to start:
 * Snap the menu (Bring in), Add a house-made, Snap the back bar
 * (`onSnapBottles`); with no right to add, just the line. An Admin alone on
 * the team is asked to invite people. A filter that matches nothing says so.
 */
export function DrinksEmpty({ barId, capsule, nothing, canAdd, onSnapBottles }: { barId: string | null; capsule: StaffCapsule; nothing: boolean; canAdd: boolean; onSnapBottles: () => void }) {
  const router = useRouter();
  const { alone } = useTeamCard(barId);
  const openTeam = useOpenTeam();
  if (!nothing || !barId) return <Body tone="muted">Nothing here yet.</Body>;
  const action = !canAdd ? null : capsule === 'drinks' ? () => useBringIn.getState().openSheet() : capsule === 'house' ? () => router.push(`/make-recipe?barId=${barId}` as Href) : onSnapBottles;
  return (
    <View style={styles.wrap}>
      <CapsuleEmpty capsule={capsule} onAction={action} />
      {alone && capsule === 'drinks' ? <InviteTeamCard onInvite={() => openTeam(true)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
});
