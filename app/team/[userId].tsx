import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { MemberPage } from '@/components/screens/team/MemberPage';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useCanManageStaff, useEffectiveRole } from '@/hooks/useViewAs';
import { canOpenMember, personName } from '@/lib/team';

/** A teammate's page on a phone (Kept-team, A person); on a desktop it sits beside Team's list. */
export default function TeamMemberRoute() {
  const ds = useDs();
  const router = useRouter();
  const myId = useUserId();
  const insets = useSafeAreaInsets();
  const column = usePageColumn();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { active } = useActiveVenue();
  const manage = useCanManageStaff(active?.id);
  const role = useEffectiveRole(active?.id ?? null);
  const members = useBarMembers(active && manage ? active.id : null);
  const member = members.data?.find((m) => m.user_id === userId) ?? null;
  const name = member ? personName(member) : 'Team';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/team' as Href));

  let body;
  if (!active || !manage) body = <Body tone="muted">Only people who manage the team open someone’s page.</Body>;
  else if (members.isLoading) body = <Caption tone="muted">Loading…</Caption>;
  else if (members.error) body = <Body tone="muted" role="alert">Couldn’t load the team. Check your connection and try again.</Body>;
  else if (!member) body = <Body tone="muted">They’re not on the team any more.</Body>;
  else if (!canOpenMember(member, myId, role)) body = <Body tone="muted">You can’t change this person here.</Body>;
  else body = <MemberPage barId={active.id} barName={active.name} member={member} role={role} onRemoved={back} />;

  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: name }} />
      <WebHead>
        <title>{name}</title>
      </WebHead>
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <ScrollView contentContainerStyle={[column, styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
          <PageHeader title="" onBack={back} crumbs={active ? [{ label: 'Team', href: '/team' as Href }] : undefined} />
          {body}
        </ScrollView>
      </View>
    </VenueBrandProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.lg },
});
