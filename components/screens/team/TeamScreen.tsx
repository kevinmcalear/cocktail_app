import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Display, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { canManageTeam, canSeeTeam } from '@/lib/team';

import { TeamRoster } from './TeamRoster';

/**
 * My team, for the venue in the sidebar. Employee and above see who is on it;
 * an Admin also invites people, changes roles and removes them (TeamRoster).
 */
export function TeamScreen() {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const sidebar = useIsWideWeb();
  const home = useMode().mode === 'home';
  const { active } = useActiveVenue();
  const role = useEffectiveRole(active?.id ?? null);
  const visible = !home && !!active && canSeeTeam(role);
  const [inviting, setInviting] = useState(false);

  let body: ReactNode;
  if (home || !active) body = <Body tone="muted">My team is part of a venue. Switch to your bar to see it.</Body>;
  else if (!visible) body = <Body tone="muted">My team opens at Employee.</Body>;
  else body = <TeamRoster barId={active.id} barName={active.name} role={role} inviting={inviting} onCloseInvite={() => setInviting(false)} />;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (sidebar ? space.xxl : space.sm), paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl },
        ]}
      >
        {/* The venue is already in the sidebar and the chip, so no subtitle. */}
        <View style={styles.head}>
          <Display>My team</Display>
          {visible && canManageTeam(role) ? <Button label="Invite someone" icon="person.badge.plus" onPress={() => setInviting(true)} /> : null}
        </View>
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
});
