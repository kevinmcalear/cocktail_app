import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
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
  const column = usePageColumn();
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
        contentContainerStyle={[column, styles.content, { paddingBottom: insets.bottom + space.xxxl }]}
      >
        <PageHeader
          title="My team"
          action={visible && canManageTeam(role) ? <Button label="Invite someone" icon="person.badge.plus" onPress={() => setInviting(true)} /> : null}
        />
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl },
});
