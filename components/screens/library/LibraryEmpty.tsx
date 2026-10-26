import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline } from '@/components/ds';
import { InviteTeamCard, useOpenTeam, useTeamCard } from '@/components/nav/TeamCard';
import { space } from '@/constants/tokens';
import { useBringIn } from '@/store/useBringIn';

/**
 * Library with nothing to show. A venue with no drinks at all says how to
 * add some, and an Admin alone on the team is asked to invite people
 * (venue-library-empty-admin). A filter that matches nothing just says so.
 */
export function LibraryEmpty({ barId, noDrinks, canAdd }: { barId: string | null; noDrinks: boolean; canAdd: boolean }) {
  const router = useRouter();
  const { alone } = useTeamCard(barId);
  const openTeam = useOpenTeam();
  if (!noDrinks || !barId) return <Body tone="muted">Nothing here yet.</Body>;
  return (
    <View style={styles.wrap}>
      <View style={styles.block}>
        <Headline role="heading">No drinks yet</Headline>
        <Body tone="muted">{canAdd ? 'Add your drinks one at a time, or upload a menu and we build them for you.' : 'The venue’s drinks show here once someone adds them.'}</Body>
        {canAdd ? (
          <View style={styles.actions}>
            <Button label="Add a drink" icon="plus" onPress={() => router.push(`/add-cocktail?barId=${barId}` as Href)} />
            <Button label="Upload a menu" variant="secondary" onPress={() => useBringIn.getState().openSheet()} />
          </View>
        ) : null}
      </View>
      {alone ? <InviteTeamCard onInvite={() => openTeam(true)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl, paddingTop: space.xl },
  block: { gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
