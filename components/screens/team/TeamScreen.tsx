import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import { useCanManageStaff, useEffectiveRole } from '@/hooks/useViewAs';
import { lookSet } from '@/lib/setupChecklist';
import { canSeeTeam } from '@/lib/team';
import { useVenueSetup } from '@/store/useVenueSetup';

import { TeamRoster } from './TeamRoster';

/**
 * My team, for the venue in the sidebar. Employee and above see who is on it;
 * an Admin also invites people, changes roles and removes them (TeamRoster).
 * `?invite=1` opens straight on Invite. Invite waits for How it looks, as
 * the checklist's Your team does, so every email wears the venue's logo,
 * colour and font (invite-team-last, call 2): until then it opens Brand.
 */
export function TeamScreen() {
  const ds = useDs();
  const router = useRouter();
  const wide = useIsWideWeb();
  const insets = useSafeAreaInsets();
  const column = usePageColumn();
  const home = useMode().mode === 'home';
  const { active } = useActiveVenue();
  const role = useEffectiveRole(active?.id ?? null);
  const visible = !home && !!active && canSeeTeam(role);
  const manage = useCanManageStaff(active?.id);
  // /team?invite=1 (the venue sheet's and empty Library's Invite your team) opens the invite sheet.
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const brand = useVenueBrand(visible && manage ? active?.id : null);
  const run = useVenueSetup((s) => (active ? s.runs[active.id] : undefined));
  // Only a loaded brand holds Invite back; if it fails to load, the gate steps aside.
  const looks = !brand.data || lookSet(brand.data, run);
  const [asked, setInviting] = useState(invite === '1');
  const inviting = asked && looks;
  const startInvite = () => (looks ? setInviting(true) : router.push(`/settings/bar/${active!.id}/brand` as Href));

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
          onBack={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
          action={visible && manage ? <Button label={wide ? 'Invite someone' : 'Invite'} accessibilityLabel="Invite someone" icon="person.badge.plus" onPress={startInvite} /> : null}
        />
        {visible && manage && !looks ? <Caption tone="muted">{`Set how ${active?.name} looks first: the invite wears its logo, colour and font.`}</Caption> : null}
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl },
});
